import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS, SYNC_SCHEMA_VERSION, SYNC_TABLES, tablesUpTo } from '@surtivox/database';
import worker from '../../sync-worker/src/index.ts';
import { fakeD1 } from '../../sync-worker/test/support.ts';
import {
  SERVER_OUTDATED_MESSAGE, applyPullOn, pushChangesOn, syncCycleOn, type SyncDb, type SyncRequest,
} from './syncFlow.ts';

type Param = string | number | null;

const TOKEN = 'TIENDAPRUEBA2345';
const T0 = Date.now() - 600_000;
const T1 = T0 + 120_000;
const FRESH = { last_pushed_at: 0, last_pulled_at: 0, synced_schema: 1 };

function device(migrations: readonly { id: string; sql: string }[] = MIGRATIONS): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const m of migrations) db.exec(m.sql);
  return db;
}

function on(db: DatabaseSync): SyncDb {
  return {
    getAllAsync: async (sql: string, params: readonly Param[] = []) => db.prepare(sql).all(...params),
    getFirstAsync: async (sql: string, params: readonly Param[] = []) => db.prepare(sql).get(...params) ?? null,
    runAsync: async (sql: string, params: readonly Param[] = []) => {
      const r = db.prepare(sql).run(...params);
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    execAsync: async (sql: string) => { db.exec(sql); },
    withTransactionAsync: async (task: () => Promise<void>) => {
      db.exec('BEGIN');
      try { await task(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  } as unknown as SyncDb;
}

function cloud() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../sync-worker/schema.sql', import.meta.url), 'utf8'));
  const env = { DB: fakeD1(db) } as never;
  const paths: string[] = [];
  const request: SyncRequest = async (path, init) => {
    paths.push(path);
    const res = await worker.fetch(new Request(`https://sync.test${path}`, {
      method: init.method,
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' },
      body: init.body,
    }), env);
    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`);
    return body;
  };
  return { db, request, paths };
}

function seedShopWithCount(db: DatabaseSync): void {
  db.prepare('INSERT INTO stores (id,name,currency_code,currency_locale,currency_decimals,created_at,updated_at,device_id) VALUES (?,?,?,?,?,?,?,?)')
    .run('s1', 'Tienda Don Pepe', 'COP', 'es-CO', 0, T0, T0, 'dA');
  db.prepare('INSERT INTO products (id,store_id,name,cost_price,selling_price,track_inventory,created_at,updated_at,device_id) VALUES (?,?,?,?,?,?,?,?,?)')
    .run('p1', 's1', 'Arroz', 1000, 2000, 1, T0, T0, 'dA');
  db.prepare("INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,created_at,device_id) VALUES ('m0','s1','p1','opening_stock',10,?,'dA')").run(T0);
  db.prepare("INSERT INTO stock_counts (id,store_id,status,started_at,closed_at,created_at,updated_at,device_id) VALUES ('k1','s1','closed',?,?,?,?,'dA')").run(T0, T0, T0, T0);
  db.prepare("INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,reference_type,reference_id,created_at,device_id) VALUES ('m1','s1','p1','adjustment',-2,'stock_count','k1',?,'dA')").run(T0);
  db.prepare("INSERT INTO stock_count_lines (id,count_id,product_id,product_name_snapshot,expected_qty,counted_qty,unit_cost,movement_id,created_at,device_id) VALUES ('l1','k1','p1','Arroz',10,8,1000,'m1',?,'dA')").run(T0);
  db.prepare('INSERT INTO products (id,store_id,name,cost_price,selling_price,track_inventory,created_at,updated_at,device_id) VALUES (?,?,?,?,?,?,?,?,?)')
    .run('p2', 's1', 'Panela', 800, 1500, 1, T1, T1, 'dA');
}

const stockOf = (db: DatabaseSync, id: string) =>
  Number((db.prepare('SELECT COALESCE(SUM(quantity_delta),0) AS n FROM stock_movements WHERE product_id=?').get(id) as { n: number }).n);
const countOf = (db: DatabaseSync, table: string) => Number((db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n);

async function shopOnline() {
  const server = cloud();
  const a = device();
  seedShopWithCount(a);
  await server.request('/sync/register', { method: 'POST', body: JSON.stringify({ storeId: 's1' }) });
  await syncCycleOn(on(a), server.request, FRESH);
  return { server, a };
}

test('a count made offline reaches a second device with its lines and the same stock', async () => {
  const { server } = await shopOnline();
  assert.equal(countOf(server.db, 'stock_counts'), 1);
  assert.equal(countOf(server.db, 'stock_count_lines'), 1);

  const b = device();
  const next = await syncCycleOn(on(b), server.request, FRESH);
  assert.equal(next.synced_schema, SYNC_SCHEMA_VERSION);
  assert.equal(stockOf(b, 'p1'), 8);
  const line = b.prepare("SELECT expected_qty, counted_qty, unit_cost, movement_id FROM stock_count_lines WHERE id='l1'").get() as Record<string, unknown>;
  assert.deepEqual({ ...line }, { expected_qty: 10, counted_qty: 8, unit_cost: 1000, movement_id: 'm1' });
});

test('the new app refuses to push to a Worker that predates the count tables', async () => {
  const server = cloud();
  const a = device();
  seedShopWithCount(a);
  const oldWorker: SyncRequest = async (path, init) =>
    path === '/health' ? { ok: true, service: 'surtivox-sync', tables: 15 } : server.request(path, init);
  await assert.rejects(syncCycleOn(on(a), oldWorker, FRESH), { message: SERVER_OUTDATED_MESSAGE });
  assert.equal(countOf(server.db, 'products'), 0);
  assert.equal(countOf(server.db, 'stock_counts'), 0);
});

test('an old APK keeps syncing with the new Worker and sees the adjusted stock', async () => {
  const { server } = await shopOnline();
  const old = device(MIGRATIONS.filter((m) => m.id < '0012'));
  const oldTables = tablesUpTo(1);
  assert.equal(oldTables.length, SYNC_TABLES.length - 2);
  assert.ok(!oldTables.some((t) => t.name.startsWith('stock_count')));

  const payload = await server.request('/sync/pull?since=0', { method: 'GET' });
  assert.ok(Array.isArray(payload.tables.stock_counts));
  await applyPullOn(on(old), payload, oldTables);
  assert.equal(stockOf(old, 'p1'), 8);
  await pushChangesOn(on(old), server.request, 0, oldTables);
  assert.equal(countOf(server.db, 'stock_counts'), 1);
});

test('a device upgraded from the old APK backfills counts its old cursor already skipped', async () => {
  const { server } = await shopOnline();
  const upgrade = async (syncedSchema: number) => {
    const db = device(MIGRATIONS.filter((m) => m.id < '0012'));
    const payload = await server.request('/sync/pull?since=0', { method: 'GET' });
    await applyPullOn(on(db), payload, tablesUpTo(1));
    assert.equal(payload.cursor, T1);
    for (const m of MIGRATIONS.filter((x) => x.id >= '0012')) db.exec(m.sql);
    const state = { last_pushed_at: T1, last_pulled_at: T1, synced_schema: syncedSchema };
    return { db, next: await syncCycleOn(on(db), server.request, state) };
  };

  const skipped = await upgrade(SYNC_SCHEMA_VERSION);
  assert.equal(countOf(skipped.db, 'stock_counts'), 0, 'sin backfill el cursor viejo salta el conteo');

  const before = server.paths.length;
  const fixed = await upgrade(1);
  assert.equal(fixed.next.synced_schema, SYNC_SCHEMA_VERSION);
  assert.equal(countOf(fixed.db, 'stock_counts'), 1);
  assert.equal(countOf(fixed.db, 'stock_count_lines'), 1);
  assert.equal(server.paths.slice(before).filter((p) => p.includes('tables=')).length, 1);

  const again = server.paths.length;
  await syncCycleOn(on(fixed.db), server.request, fixed.next);
  assert.equal(server.paths.slice(again).filter((p) => p.includes('tables=')).length, 0);
});
