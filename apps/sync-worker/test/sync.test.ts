import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { chunkPushRows } from '@surtivox/database';
import worker from '../src/index.ts';

type Param = string | number | null;

class FakeStatement {
  private readonly db: DatabaseSync;
  private readonly sql: string;
  private readonly params: Param[];
  constructor(db: DatabaseSync, sql: string, params: Param[] = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  bind(...params: Param[]): FakeStatement { return new FakeStatement(this.db, this.sql, params); }
  async first<T>(): Promise<T | null> { return (this.db.prepare(this.sql).get(...this.params) as T | undefined) ?? null; }
  async all<T>(): Promise<{ results: T[] }> { return { results: this.db.prepare(this.sql).all(...this.params) as T[] }; }
  async run(): Promise<{ success: boolean; meta: { changes: number } }> {
    const result = this.db.prepare(this.sql).run(...this.params);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

function fakeD1(db: DatabaseSync) {
  return {
    prepare: (sql: string) => new FakeStatement(db, sql),
    batch: async (statements: FakeStatement[]) => {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const statement of statements) out.push(await statement.run());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

function server() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const env = { DB: fakeD1(db) } as never;
  const call = async (path: string, token: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') => {
    const res = await worker.fetch(new Request(`https://sync.test${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json() as Record<string, any> };
  };
  return { db, call };
}

const TOKEN_A = 'AAAAAAAAAAAAAAAA';
const TOKEN_B = 'BBBBBBBBBBBBBBBB';
const TOKEN_A2 = 'CCCCCCCCCCCCCCCC';

const store = (id: string, name: string, at = 1000) => ({
  id, name, currency_code: 'COP', currency_locale: 'es-CO', currency_decimals: 0,
  created_at: at, updated_at: at, device_id: 'd', version: 1,
});
const product = (id: string, storeId: string, name: string, at = 1000, version = 1) => ({
  id, store_id: storeId, name, cost_price: 0, selling_price: 100, unit: 'unit', track_inventory: 1, tax_bps: 0, active: 1,
  created_at: at, updated_at: at, device_id: 'd', version,
});
const sale = (id: string, storeId: string) => ({
  id, store_id: storeId, invoice_no: `INV-${id}`, status: 'completed', subtotal: 100, discount_total: 0, tax_total: 0,
  grand_total: 100, sold_at: 1, created_at: 1, updated_at: 1, device_id: 'd', version: 1,
});
const saleItem = (id: string, saleId: string) => ({
  id, sale_id: saleId, product_name_snapshot: 'x', unit_cost: 0, unit_price: 100, quantity: 1, discount: 0, tax: 0,
  line_total: 100, created_at: 1, device_id: 'd',
});

test('register binds the first token of a store and is idempotent', async () => {
  const { call } = server();
  assert.equal((await call('/sync/register', TOKEN_A, { storeId: 's1' })).status, 200);
  assert.equal((await call('/sync/register', TOKEN_A, { storeId: 's1' })).status, 200);
});

test('register refuses a second token for a store that is already claimed', async () => {
  const { call, db } = server();
  await call('/sync/register', TOKEN_A, { storeId: 's1' });
  const attack = await call('/sync/register', TOKEN_B, { storeId: 's1' });
  assert.equal(attack.status, 403);
  assert.equal(attack.body.error, 'store_already_claimed');
  assert.equal((await call('/sync/pull?since=0', TOKEN_B)).status, 401);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM sync_tokens').get() as { n: number }).n, 1);
});

test('register refuses to move a token to another store and rejects malformed input', async () => {
  const { call } = server();
  await call('/sync/register', TOKEN_A, { storeId: 's1' });
  assert.equal((await call('/sync/register', TOKEN_A, { storeId: 's2' })).status, 409);
  assert.equal((await call('/sync/register', 'short', { storeId: 's3' })).status, 400);
  assert.equal((await call('/sync/register', TOKEN_B, { storeId: "s3'; DROP TABLE x;--" })).status, 400);
  assert.equal((await call('/sync/register', TOKEN_B, {})).status, 400);
});

test('push cannot overwrite or move a row owned by another store', async () => {
  const { call, db } = server();
  await call('/sync/register', TOKEN_A, { storeId: 's1' });
  await call('/sync/register', TOKEN_B, { storeId: 's2' });
  await call('/sync/push', TOKEN_A, { tables: { stores: [store('s1', 'A')], products: [product('p1', 's1', 'Arroz')] } });
  await call('/sync/push', TOKEN_B, { tables: { stores: [store('s2', 'B')], products: [product('p1', 's2', 'Robado', 9999, 9)] } });
  const row = db.prepare("SELECT store_id, name FROM products WHERE id='p1'").get() as { store_id: string; name: string };
  assert.deepEqual({ ...row }, { store_id: 's1', name: 'Arroz' });
});

test('push rejects rows without a store_id or claiming another store', async () => {
  const { call, db } = server();
  await call('/sync/register', TOKEN_A, { storeId: 's1' });
  const missing = { ...product('p2', 's1', 'Sin tienda') } as Record<string, unknown>;
  delete missing.store_id;
  await call('/sync/push', TOKEN_A, { tables: { stores: [store('s9', 'Ajena')], products: [missing, product('p3', 's9', 'Ajeno')] } });
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n, 0);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM stores').get() as { n: number }).n, 0);
});

test('child rows are accepted only under a parent that belongs to the pushing store', async () => {
  const { call, db } = server();
  await call('/sync/register', TOKEN_A, { storeId: 's1' });
  await call('/sync/register', TOKEN_B, { storeId: 's2' });
  await call('/sync/push', TOKEN_A, { tables: { sales: [sale('a1', 's1')], sale_items: [saleItem('i1', 'a1')] } });
  await call('/sync/push', TOKEN_B, { tables: { sale_items: [saleItem('i2', 'a1'), saleItem('i3', 'ghost')] } });
  const ids = (db.prepare('SELECT id FROM sale_items ORDER BY id').all() as { id: string }[]).map((r) => r.id);
  assert.deepEqual(ids, ['i1']);
});

test('pull returns only the token store and older pushes never overwrite newer rows', async () => {
  const { call } = server();
  await call('/sync/register', TOKEN_A, { storeId: 's1' });
  await call('/sync/register', TOKEN_B, { storeId: 's2' });
  await call('/sync/push', TOKEN_A, { tables: { products: [product('p1', 's1', 'Nuevo', 2000, 2)] } });
  await call('/sync/push', TOKEN_A, { tables: { products: [product('p1', 's1', 'Viejo', 1000, 1)] } });
  await call('/sync/push', TOKEN_B, { tables: { products: [product('p9', 's2', 'De B')] } });
  const pulled = await call('/sync/pull?since=0', TOKEN_A);
  assert.deepEqual(pulled.body.tables.products.map((r: { name: string }) => r.name), ['Nuevo']);
  assert.equal((await call('/sync/pull?since=0', TOKEN_A2)).status, 401);
});

test('push rejects oversized payloads and too many rows before touching the database', async () => {
  const { call, db } = server();
  await call('/sync/register', TOKEN_A, { storeId: 's1' });
  const many = Array.from({ length: 501 }, (_, i) => product(`p${i}`, 's1', 'x'));
  const rows = await call('/sync/push', TOKEN_A, { tables: { products: many } });
  assert.equal(rows.status, 413);
  assert.equal(rows.body.error, 'too_many_rows');
  const big = await call('/sync/push', TOKEN_A, { tables: { products: [product('p1', 's1', 'x'.repeat(1_100_000))] } });
  assert.equal(big.status, 413);
  assert.equal(big.body.error, 'payload_too_large');
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n, 0);
});

test('push accepts exactly the maximum number of rows', async () => {
  const { call, db } = server();
  await call('/sync/register', TOKEN_A, { storeId: 's1' });
  const rows = Array.from({ length: 500 }, (_, i) => product(`p${i}`, 's1', 'x'));
  assert.equal((await call('/sync/push', TOKEN_A, { tables: { products: rows } })).status, 200);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n, 500);
});

test('push answers 400 for malformed bodies and ignores non object rows instead of failing', async () => {
  const { call, db } = server();
  await call('/sync/register', TOKEN_A, { storeId: 's1' });
  assert.equal((await call('/sync/push', TOKEN_A, {})).status, 400);
  assert.equal((await call('/sync/push', TOKEN_A, { tables: [] })).status, 400);
  assert.equal((await call('/sync/push', TOKEN_A, { tables: { products: 'x' } })).status, 400);
  const res = await call('/sync/push', TOKEN_A, { tables: { products: [null, 7, [], product('p1', 's1', 'Ok')] } });
  assert.equal(res.status, 200);
  assert.equal(res.body.applied, 1);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n, 1);
});

test('what the app batcher produces is always accepted by the worker, with parents before children', async () => {
  const { call, db } = server();
  await call('/sync/register', TOKEN_A, { storeId: 's1' });
  const sales = Array.from({ length: 700 }, (_, i) => sale(`s${i}`, 's1'));
  const items = sales.map((s, i) => saleItem(`i${i}`, s.id));
  const products = Array.from({ length: 300 }, (_, i) => product(`p${i}`, 's1', `Producto ${i} ${'ñ'.repeat(200)}`));
  const batches = chunkPushRows([
    { name: 'stores', rows: [store('s1', 'A')] },
    { name: 'products', rows: products },
    { name: 'sales', rows: sales },
    { name: 'sale_items', rows: items },
  ]);
  assert.ok(batches.length > 3);
  for (const tables of batches) assert.equal((await call('/sync/push', TOKEN_A, { tables })).status, 200);
  const count = (t: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
  assert.equal(count('products'), 300);
  assert.equal(count('sales'), 700);
  assert.equal(count('sale_items'), 700);
});
