import {
  canAcceptVote,
  consensusWinner,
  isValidEan,
  isValidInstallId,
  parseMinContributors,
  validateItem,
  type CatalogVote,
} from './validation.ts';

interface D1RunResult {
  success: boolean;
  meta?: { changes?: number };
}

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  run(): Promise<D1RunResult>;
}

interface D1Database {
  prepare(sql: string): D1Statement;
}

interface Env {
  DB: D1Database;
  CATALOG_SALT?: string;
  CATALOG_MIN_CONTRIBUTORS?: string;
}

interface CatalogRow {
  barcode: string;
  name: string;
  presentation: string | null;
  contributors: number;
}

interface VoteRow {
  name_norm: string;
  name_display: string;
  presentation: string | null;
  contributor_hash: string;
  created_at: number;
}

const MAX_ITEMS = 20;
const MAX_PER_DAY = 200;

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function dayStart(now: number): number {
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

async function contributorHash(installId: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}${installId}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function rebuildCatalog(db: D1Database, barcode: string, minContributors: number, now: number): Promise<void> {
  const result = await db.prepare(
    'SELECT name_norm, name_display, presentation, contributor_hash, created_at FROM catalog_votes WHERE barcode=?',
  ).bind(barcode).all<VoteRow>();
  const votes: CatalogVote[] = (result.results ?? []).map((row) => ({
    nameNorm: row.name_norm,
    nameDisplay: row.name_display,
    presentation: row.presentation,
    contributorHash: row.contributor_hash,
    createdAt: row.created_at,
  }));
  const winner = consensusWinner(votes, minContributors);
  if (!winner) return;
  await db.prepare(
    `INSERT INTO catalog_products (barcode,name,presentation,contributors,updated_at)
     VALUES (?,?,?,?,?)
     ON CONFLICT(barcode) DO UPDATE SET
       name=excluded.name,
       presentation=excluded.presentation,
       contributors=excluded.contributors,
       updated_at=excluded.updated_at`,
  ).bind(barcode, winner.name, winner.presentation, winner.contributors, now).run();
}

async function catalogLookup(db: D1Database, request: Request): Promise<Response> {
  const code = new URL(request.url).searchParams.get('code')?.trim() ?? '';
  if (!isValidEan(code)) return json({ error: 'invalid_code' }, 400);
  const row = await db.prepare(
    'SELECT barcode,name,presentation,contributors FROM catalog_products WHERE barcode=?',
  ).bind(code).first<CatalogRow>();
  if (!row) return json({ found: false });
  return json(
    { found: true, name: row.name, presentation: row.presentation ?? undefined, contributors: row.contributors },
    200,
    { 'cache-control': 'public, max-age=3600' },
  );
}

async function catalogContribute(env: Env, request: Request, now: number): Promise<Response> {
  if (!env.CATALOG_SALT) return json({ error: 'catalog_unavailable' }, 503);
  let body: { install_id?: unknown; items?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }
  if (!isValidInstallId(body.install_id) || !Array.isArray(body.items)) {
    return json({ error: 'invalid_request' }, 400);
  }
  if (body.items.length > MAX_ITEMS) return json({ error: 'invalid_request' }, 400);

  const hash = await contributorHash(body.install_id, env.CATALOG_SALT);
  const day = dayKey(now);
  const dayFloor = dayStart(now);
  const limitRow = await env.DB.prepare(
    'SELECT count FROM contribution_limits WHERE contributor_hash=? AND day=?',
  ).bind(hash, day).first<{ count: number }>();
  let dailyCount = limitRow?.count ?? 0;
  const minContributors = parseMinContributors(env.CATALOG_MIN_CONTRIBUTORS);
  let accepted = 0;
  let rejected = 0;

  for (const raw of body.items) {
    const item = raw && typeof raw === 'object' ? validateItem(raw as Record<string, unknown>) : null;
    if (!item) {
      rejected += 1;
      continue;
    }
    const existingName = await env.DB.prepare(
      'SELECT name_norm FROM catalog_votes WHERE barcode=? AND contributor_hash=? AND created_at>=? LIMIT 1',
    ).bind(item.code, hash, dayFloor).first<{ name_norm: string }>();
    const canAccept = canAcceptVote({
      dailyCount,
      maxPerDay: MAX_PER_DAY,
      votedDifferentNameToday: Boolean(existingName && existingName.name_norm !== item.nameNorm),
    });
    if (!canAccept) {
      rejected += 1;
      continue;
    }
    const inserted = await env.DB.prepare(
      `INSERT OR IGNORE INTO catalog_votes
        (barcode,name_norm,name_display,presentation,contributor_hash,created_at)
       VALUES (?,?,?,?,?,?)`,
    ).bind(item.code, item.nameNorm, item.name, item.presentation, hash, now).run();
    if ((inserted.meta?.changes ?? 0) === 0) {
      rejected += 1;
      continue;
    }
    dailyCount += 1;
    await env.DB.prepare(
      `INSERT INTO contribution_limits (contributor_hash,day,count) VALUES (?,?,?)
       ON CONFLICT(contributor_hash,day) DO UPDATE SET count=excluded.count`,
    ).bind(hash, day, dailyCount).run();
    accepted += 1;
    await rebuildCatalog(env.DB, item.code, minContributors, now);
  }

  return json({ accepted, rejected });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') return json({ ok: true });
    if (url.pathname === '/catalog/lookup' && request.method === 'GET') return catalogLookup(env.DB, request);
    if (url.pathname === '/catalog/contribute' && request.method === 'POST') return catalogContribute(env, request, Date.now());
    return json({ error: 'not_found' }, 404);
  },
};
