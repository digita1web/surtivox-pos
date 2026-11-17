import {
  SYNC_TABLES, SYNC_SCHEMA_VERSION, upsertSql, rowValues, changedSinceSql, stripLocalOnly, chunkPushRows,
  serverSchemaOf, tablesAddedAfter, type PushTableRows, type SyncTable,
} from '@surtivox/database';
import type { SQLiteDatabase } from 'expo-sqlite';
import { NUMBERED_TABLES, resolveNumberCollision } from './numberCollision.ts';

export type SyncDb = Pick<SQLiteDatabase, 'getAllAsync' | 'getFirstAsync' | 'runAsync' | 'execAsync' | 'withTransactionAsync'>;

export type SyncRequest = (path: string, init: { method: 'GET' | 'POST'; body?: string }) => Promise<any>;

export interface SyncCursors {
  last_pushed_at: number;
  last_pulled_at: number;
  synced_schema: number;
}

export const OVERLAP_MS = 30_000;

export const SERVER_OUTDATED_MESSAGE =
  'El servidor de la nube necesita actualizarse antes de sincronizar esta versión de la app. Tus datos siguen guardados en este teléfono.';

export async function serverSchemaOn(request: SyncRequest): Promise<number> {
  return serverSchemaOf(await request('/health', { method: 'GET' }));
}

export async function assertServerSchemaOn(request: SyncRequest): Promise<void> {
  if ((await serverSchemaOn(request)) < SYNC_SCHEMA_VERSION) throw new Error(SERVER_OUTDATED_MESSAGE);
}

export async function pushChangesOn(db: SyncDb, request: SyncRequest, since: number, tables: readonly SyncTable[] = SYNC_TABLES): Promise<number> {
  const collected: PushTableRows[] = [];
  let maxTime = since;
  const from = Math.max(0, since - OVERLAP_MS);
  for (const t of tables) {
    const rows = await db.getAllAsync<Record<string, unknown>>(changedSinceSql(t), [from]);
    if (rows.length === 0) continue;
    collected.push({ name: t.name, rows: rows.map((r) => stripLocalOnly(t, r)) });
    for (const r of rows) {
      const ts = Number(r[t.timeColumn]);
      if (Number.isFinite(ts) && ts > maxTime) maxTime = ts;
    }
  }
  const batches = chunkPushRows(collected);
  if (batches.length === 0) return since;
  for (const batch of batches) await request('/sync/push', { method: 'POST', body: JSON.stringify({ tables: batch }) });
  return maxTime;
}

export async function applyPullOn(
  db: SyncDb,
  payload: { tables: Record<string, Record<string, unknown>[]> },
  tables: readonly SyncTable[] = SYNC_TABLES,
): Promise<number> {
  let applied = 0;
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      for (const t of tables) {
        const rows = payload.tables[t.name];
        if (!Array.isArray(rows)) continue;
        const sql = upsertSql(t);
        const numbered = NUMBERED_TABLES.find((n) => n.table === t.name);
        for (const row of rows) {
          if (numbered) await resolveNumberCollision(db, numbered.table, numbered.column, row);
          await db.runAsync(sql, rowValues(t, row) as (string | number | null)[]);
          applied++;
        }
      }
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
  return applied;
}

export const PULL_PAGE_ROWS = 2_000;
export const MAX_PULL_PAGES = 5_000;

export interface PulledPayload {
  tables: Record<string, Record<string, unknown>[]>;
  cursor: number | null;
}

export async function pullAllOn(request: SyncRequest, since: number, tables?: readonly string[]): Promise<PulledPayload> {
  const merged: Record<string, Record<string, unknown>[]> = {};
  let cursor: number | null = null;
  let after: string | null = null;
  for (let page = 0; page < MAX_PULL_PAGES; page++) {
    const query = `since=${since}${tables ? `&tables=${tables.join(',')}` : ''}&limit=${PULL_PAGE_ROWS}${after ? `&after=${encodeURIComponent(after)}` : ''}`;
    const body = await request(`/sync/pull?${query}`, { method: 'GET' });
    if (!body || typeof body.tables !== 'object' || body.tables === null) throw new Error('La nube devolvió una respuesta inválida.');
    for (const [name, rows] of Object.entries(body.tables as Record<string, unknown>)) {
      if (Array.isArray(rows)) (merged[name] ??= []).push(...(rows as Record<string, unknown>[]));
    }
    if (typeof body.cursor === 'number') cursor = Math.max(cursor ?? body.cursor, body.cursor);
    if (body.more !== true) return { tables: merged, cursor };
    if (typeof body.next !== 'string' || body.next === after) throw new Error('La nube devolvió una paginación inválida.');
    after = body.next;
  }
  throw new Error('La descarga desde la nube tiene demasiadas páginas.');
}

export async function pullChangesOn(db: SyncDb, request: SyncRequest, since: number): Promise<number> {
  const from = Math.max(0, since - OVERLAP_MS);
  const payload = await pullAllOn(request, from);
  await applyPullOn(db, payload);
  return payload.cursor ?? since;
}

export async function backfillOn(db: SyncDb, request: SyncRequest, syncedSchema: number): Promise<number> {
  const missing = tablesAddedAfter(syncedSchema);
  if (missing.length === 0) return Math.max(syncedSchema, SYNC_SCHEMA_VERSION);
  const payload = await pullAllOn(request, 0, missing.map((t) => t.name));
  await applyPullOn(db, payload, missing);
  return SYNC_SCHEMA_VERSION;
}

export async function syncCycleOn(db: SyncDb, request: SyncRequest, state: SyncCursors): Promise<SyncCursors> {
  await assertServerSchemaOn(request);
  const last_pushed_at = await pushChangesOn(db, request, state.last_pushed_at);
  const last_pulled_at = await pullChangesOn(db, request, state.last_pulled_at);
  const synced_schema = await backfillOn(db, request, state.synced_schema);
  return { last_pushed_at, last_pulled_at, synced_schema };
}
