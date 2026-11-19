import {
  SYNC_TABLES, SYNC_SCHEMA_VERSION, PULL_FIRST_ID, pullPageSql, serverUpsertSql, serverRowValues, pullSql, rowStoreId, PUSH_LIMITS, type SyncTable,
} from '@surtivox/database';
import { handleMarketPrices } from './marketPrices.ts';

export interface Env {
  DB: D1Database;
  QUOTA_DAILY_ROWS?: string;
  QUOTA_GLOBAL_ROWS?: string;
  PULL_MAX_PAGE?: string;
}

export const DEFAULT_QUOTA_DAILY_ROWS = 10_000;
export const DEFAULT_QUOTA_GLOBAL_ROWS = 85_000;
export const ESTIMATED_WRITES_PER_ROW = 2;
export const USAGE_TOTAL_ID = '*';
export const DEFAULT_PULL_MAX_PAGE = 5_000;

const positiveInt = (raw: string | undefined, fallback: number) => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
};

const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

function secondsToNextUtcDay(now: number): number {
  const d = new Date(now);
  return Math.max(1, Math.ceil((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now) / 1000));
}

async function usedToday(env: Env, storeId: string, day: string): Promise<number | null> {
  try {
    const row = await env.DB.prepare('SELECT rows FROM store_usage WHERE store_id = ? AND day = ?').bind(storeId, day).first<{ rows: number }>();
    return row?.rows ?? 0;
  } catch {
    return null;
  }
}

async function addUsage(env: Env, day: string, entries: Array<[string, number]>): Promise<void> {
  const positive = entries.filter(([, rows]) => rows > 0);
  if (positive.length === 0) return;
  try {
    const stmt = env.DB.prepare(
      'INSERT INTO store_usage (store_id, day, rows) VALUES (?, ?, ?) ON CONFLICT(store_id, day) DO UPDATE SET rows = rows + excluded.rows',
    );
    await env.DB.batch(positive.map(([id, rows]) => stmt.bind(id, day, rows)));
  } catch {
    return;
  }
}

export function rowsWrittenBy(results: unknown): number {
  if (!Array.isArray(results)) return 0;
  let total = 0;
  for (const result of results) {
    const meta = (result as { meta?: { rows_written?: unknown; changes?: unknown } } | null)?.meta;
    const written = Number(meta?.rows_written);
    if (meta?.rows_written !== undefined && Number.isFinite(written) && written >= 0) { total += written; continue; }
    const changes = Number(meta?.changes);
    if (Number.isFinite(changes) && changes > 0) total += changes * ESTIMATED_WRITES_PER_ROW;
  }
  return total;
}

type Row = Record<string, unknown>;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
};

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...CORS, ...extra } });

function bearer(req: Request): string {
  return (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
}

const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const ATTEMPT_FREE = 5;
const BLOCK_BASE_MS = 60 * 1000;
const BLOCK_MAX_MS = 60 * 60 * 1000;
const KIT_TOKEN = /^[0-9a-f]{64}$/;

const encoder = new TextEncoder();

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  let out = '';
  for (const byte of new Uint8Array(digest)) out += byte.toString(16).padStart(2, '0');
  return out;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function storeForToken(env: Env, token: string): Promise<string | null> {
  if (!token) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare('SELECT store_id, key_hash FROM shop_keys WHERE key_hash = ?')
    .bind(hash).first<{ store_id: string; key_hash: string }>();
  if (row && constantTimeEqual(row.key_hash, hash)) return row.store_id;
  const legacy = await env.DB.prepare('SELECT store_id FROM sync_tokens WHERE token = ?').bind(token).first<{ store_id: string }>();
  if (!legacy) return null;
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO shop_keys (store_id, key_hash, created_at) VALUES (?, ?, ?)').bind(legacy.store_id, hash, Date.now()),
    env.DB.prepare('DELETE FROM sync_tokens WHERE token = ?').bind(token),
  ]);
  return legacy.store_id;
}

interface AttemptRow { failures: number; window_start: number; blocked_until: number }

function attemptBucket(req: Request): string {
  return `ip:${(req.headers.get('CF-Connecting-IP') ?? 'unknown').slice(0, 64)}`;
}

async function readAttempts(env: Env, bucket: string): Promise<AttemptRow | null> {
  return env.DB.prepare('SELECT failures, window_start, blocked_until FROM kit_attempts WHERE bucket = ?').bind(bucket).first<AttemptRow>();
}

async function recordFailure(env: Env, bucket: string, current: AttemptRow | null): Promise<void> {
  const now = Date.now();
  const fresh = !current || now - current.window_start > ATTEMPT_WINDOW_MS;
  const failures = fresh ? 1 : current.failures + 1;
  const windowStart = fresh ? now : current.window_start;
  const blockedUntil = failures >= ATTEMPT_FREE
    ? now + Math.min(BLOCK_BASE_MS * 2 ** (failures - ATTEMPT_FREE), BLOCK_MAX_MS)
    : 0;
  await env.DB.prepare(
    `INSERT INTO kit_attempts (bucket, failures, window_start, blocked_until) VALUES (?, ?, ?, ?)
     ON CONFLICT(bucket) DO UPDATE SET failures = excluded.failures, window_start = excluded.window_start, blocked_until = excluded.blocked_until`,
  ).bind(bucket, failures, windowStart, blockedUntil).run();
}

const VALID_STORE_ID = /^[A-Za-z0-9_-]{1,128}$/;

const bind = (v: unknown[]) => v as (string | number | null)[];

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === '/' || url.pathname === '/health') {
      return json({ ok: true, service: 'surtivox-sync', tables: SYNC_TABLES.length, schemaVersion: SYNC_SCHEMA_VERSION });
    }

    if (url.pathname === '/market-prices') {
      return handleMarketPrices(req);
    }

    const token = bearer(req);
    const bucket = attemptBucket(req);
    const attempts = await readAttempts(env, bucket);
    if (attempts && attempts.blocked_until > Date.now()) {
      const wait = Math.max(1, Math.ceil((attempts.blocked_until - Date.now()) / 1000));
      return json({ error: 'too_many_attempts', retryAfter: wait }, 429, { 'retry-after': String(wait) });
    }

    // Bind a token to a store the first time a device connects. Idempotent for
    // the same (token, store); refuses to point an existing token elsewhere.
    if (url.pathname === '/sync/register' && req.method === 'POST') {
      const body = await req.json<{ storeId?: string }>().catch(() => ({} as { storeId?: string }));
      const storeId = body.storeId;
      if (!token || !storeId) return json({ error: 'token and storeId are required' }, 400);
      if (!VALID_STORE_ID.test(storeId) || token.length < 12 || token.length > 256) {
        return json({ error: 'invalid_request' }, 400);
      }
      const existing = await storeForToken(env, token);
      if (existing && existing !== storeId) return json({ error: 'token already bound to another store' }, 409);
      if (!existing) {
        const claimed = await env.DB.prepare(
          `INSERT OR IGNORE INTO shop_keys (store_id, key_hash, created_at)
           SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM shop_keys WHERE store_id = ?)
             AND NOT EXISTS (SELECT 1 FROM sync_tokens WHERE store_id = ?)`,
        ).bind(storeId, await sha256Hex(token), Date.now(), storeId, storeId).run();
        if ((claimed.meta?.changes ?? 0) !== 1 && (await storeForToken(env, token)) !== storeId) {
          await recordFailure(env, bucket, attempts);
          return json({ error: 'store_already_claimed' }, 403);
        }
      }
      return json({ ok: true, storeId });
    }

    if (url.pathname === '/sync/rotate' && req.method === 'POST') {
      const body = await req.json<{ newToken?: unknown }>().catch(() => ({} as { newToken?: unknown }));
      const newToken = typeof body.newToken === 'string' ? body.newToken : '';
      if (!KIT_TOKEN.test(newToken)) return json({ error: 'invalid_request' }, 400);
      const newHash = await sha256Hex(newToken);
      const current = await storeForToken(env, token);
      if (!current) {
        const already = await env.DB.prepare('SELECT store_id FROM shop_keys WHERE key_hash = ?').bind(newHash).first<{ store_id: string }>();
        if (already) return json({ ok: true, rotated: false });
        await recordFailure(env, bucket, attempts);
        return json({ error: 'unauthorized' }, 401);
      }
      if ((await sha256Hex(token)) === newHash) return json({ ok: true, rotated: false });
      try {
        const result = await env.DB.prepare(
          'UPDATE shop_keys SET key_hash = ?, rotated_at = ? WHERE store_id = ? AND key_hash = ?',
        ).bind(newHash, Date.now(), current, await sha256Hex(token)).run();
        if ((result.meta?.changes ?? 0) !== 1) return json({ error: 'conflict' }, 409);
      } catch {
        return json({ error: 'conflict' }, 409);
      }
      return json({ ok: true, rotated: true });
    }

    const storeId = await storeForToken(env, token);
    if (!storeId) {
      await recordFailure(env, bucket, attempts);
      return json({ error: 'unauthorized' }, 401);
    }

    // Upsert rows uploaded by a device. Parents before children; cross-store
    // rows are rejected. Mutable rows resolve by last-writer-wins (in the SQL);
    // append rows are inserted only if absent.
    if (url.pathname === '/sync/push' && req.method === 'POST') {
      const declared = Number(req.headers.get('content-length') ?? '0');
      if (declared > PUSH_LIMITS.maxBytes) return json({ error: 'payload_too_large' }, 413);
      const text = await req.text();
      if (new TextEncoder().encode(text).length > PUSH_LIMITS.maxBytes) return json({ error: 'payload_too_large' }, 413);
      let body: { tables?: unknown };
      try { body = JSON.parse(text) as { tables?: unknown }; } catch { return json({ error: 'invalid_request' }, 400); }
      if (typeof body.tables !== 'object' || body.tables === null || Array.isArray(body.tables)) {
        return json({ error: 'invalid_request' }, 400);
      }
      const tables = body.tables as Record<string, unknown>;
      let total = 0;
      for (const t of SYNC_TABLES) {
        const rows = tables[t.name];
        if (rows !== undefined && !Array.isArray(rows)) return json({ error: 'invalid_request' }, 400);
        total += rows?.length ?? 0;
      }
      if (total > PUSH_LIMITS.maxRows) return json({ error: 'too_many_rows' }, 413);
      const now = Date.now();
      const day = utcDay(now);
      const retry = { 'retry-after': String(secondsToNextUtcDay(now)) };
      const estimate = total * ESTIMATED_WRITES_PER_ROW;
      const quota = positiveInt(env.QUOTA_DAILY_ROWS, DEFAULT_QUOTA_DAILY_ROWS);
      const globalQuota = positiveInt(env.QUOTA_GLOBAL_ROWS, DEFAULT_QUOTA_GLOBAL_ROWS);
      const used = quota > 0 ? await usedToday(env, storeId, day) : null;
      if (used !== null && used + estimate > quota) {
        return json({ error: 'quota_exceeded', scope: 'store', limit: quota, used }, 429, retry);
      }
      const usedByAll = globalQuota > 0 ? await usedToday(env, USAGE_TOTAL_ID, day) : null;
      if (usedByAll !== null && usedByAll + estimate > globalQuota) {
        return json({ error: 'quota_exceeded', scope: 'cloud' }, 429, retry);
      }
      const statements = [] as D1PreparedStatement[];
      for (const t of SYNC_TABLES) {
        const rows = tables[t.name] as Row[] | undefined;
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const stmt = env.DB.prepare(serverUpsertSql(t));
        for (const row of rows) {
          if (typeof row !== 'object' || row === null || Array.isArray(row)) continue;
          if (t.scope.kind !== 'parent' && rowStoreId(t, row) !== storeId) continue;
          statements.push(stmt.bind(...bind(serverRowValues(t, row, storeId))));
        }
      }
      const written = statements.length ? rowsWrittenBy(await env.DB.batch(statements)) : 0;
      if (quota > 0 || globalQuota > 0) await addUsage(env, day, [[storeId, written], [USAGE_TOTAL_ID, written]]);
      return json({ ok: true, applied: statements.length, serverTime: Date.now() });
    }

    // Return this store's rows changed after `since`. The cursor is the newest
    // row time seen, so the device asks for strictly newer rows next time.
    if (url.pathname === '/sync/pull' && req.method === 'GET') {
      const since = Number(url.searchParams.get('since') ?? '0') || 0;
      const only = url.searchParams.get('tables');
      const wanted = only ? new Set(only.split(',')) : null;
      const tables = SYNC_TABLES.filter((t) => !wanted || wanted.has(t.name));
      const limitParam = url.searchParams.get('limit');
      if (limitParam !== null) {
        const max = positiveInt(env.PULL_MAX_PAGE, DEFAULT_PULL_MAX_PAGE) || DEFAULT_PULL_MAX_PAGE;
        const limit = Math.min(max, Math.max(1, positiveInt(limitParam, max) || max));
        const afterRaw = url.searchParams.get('after');
        let after: { table: string; time: number; id: string } | null = null;
        if (afterRaw !== null) {
          const [table, time, ...rest] = afterRaw.split('|');
          const id = rest.join('|');
          if (!table || !tables.some((t) => t.name === table) || !Number.isFinite(Number(time)) || !id) return json({ error: 'invalid_request' }, 400);
          after = { table, time: Number(time), id };
        }
        const out: Record<string, Row[]> = {};
        let cursor = since;
        let remaining = limit;
        let next: string | null = null;
        let started = after === null;
        for (let i = 0; i < tables.length; i++) {
          const t = tables[i]!;
          let keyTime = since;
          let keyId = PULL_FIRST_ID;
          if (!started) {
            if (t.name !== after!.table) continue;
            started = true;
            keyTime = after!.time;
            keyId = after!.id;
          }
          const res = await env.DB.prepare(pullPageSql(t)).bind(storeId, keyTime, keyTime, keyId, remaining + 1).all<Row>();
          const rows = res.results ?? [];
          const page = rows.length > remaining ? rows.slice(0, remaining) : rows;
          out[t.name] = page;
          for (const r of page) {
            const ts = Number(r[t.timeColumn]);
            if (Number.isFinite(ts) && ts > cursor) cursor = ts;
          }
          remaining -= page.length;
          if (rows.length > page.length) {
            const last = page[page.length - 1]!;
            next = `${t.name}|${Number(last[t.timeColumn])}|${String(last['id'])}`;
            break;
          }
          if (remaining === 0 && i + 1 < tables.length) {
            next = `${tables[i + 1]!.name}|${since}|${PULL_FIRST_ID}`;
            break;
          }
        }
        return json({ ok: true, tables: out, cursor, more: next !== null, next });
      }
      const out: Record<string, Row[]> = {};
      let cursor = since;
      for (const t of tables) {
        const res = await env.DB.prepare(pullSql(t)).bind(storeId, since).all<Row>();
        const rows = res.results ?? [];
        out[t.name] = rows;
        for (const r of rows) {
          const ts = Number(r[(t as SyncTable).timeColumn]);
          if (Number.isFinite(ts) && ts > cursor) cursor = ts;
        }
      }
      return json({ ok: true, tables: out, cursor });
    }

    return json({ error: 'not found' }, 404);
  },
};
