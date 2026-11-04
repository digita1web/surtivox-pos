import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  MIGRATIONS, runMigrations, type SqlExecutor,
  SYNC_TABLES, upsertSql, serverUpsertSql, serverRowValues, rowValues, pullSql, changedSinceSql, stripLocalOnly,
} from '../src/index.ts';

type Row = Record<string, unknown>;
type Param = string | number | null;

function adapter(db: DatabaseSync): SqlExecutor {
  return { exec: async (s) => { db.exec(s); }, select: async <T>(s: string) => db.prepare(s).all() as T[] };
}
async function makeDb() { const db = new DatabaseSync(':memory:'); await runMigrations(adapter(db), MIGRATIONS); return db; }
const tableOf = (n: string) => SYNC_TABLES.find((t) => t.name === n)!;
const products = tableOf('products');

const store = { id: 's1', name: 'Tienda', currency_code: 'COP', currency_locale: 'es-CO', currency_decimals: 0, created_at: 0, updated_at: 100, device_id: 'A', version: 1 };
const product = (name: string, price: number, updated: number, version: number, imageUri: string | null = null): Row => ({
  id: 'p1', store_id: 's1', category_id: null, name, sku: null, barcode: null, cost_price: 0, selling_price: price,
  unit: 'unit', track_inventory: 1, low_stock_threshold: null, tax_bps: 0, image_uri: imageUri, active: 1,
  created_at: 0, updated_at: updated, deleted_at: null, device_id: 'x', version,
});

function deviceInsert(db: DatabaseSync, name: string, row: Row) {
  const t = tableOf(name);
  db.prepare(upsertSql(t)).run(...(rowValues(t, row) as Param[]));
}
function devicePush(db: DatabaseSync, since: number, strip = true) {
  const tables: Record<string, Row[]> = {};
  for (const t of SYNC_TABLES) {
    const rows = db.prepare(changedSinceSql(t)).all(since) as Row[];
    if (rows.length) tables[t.name] = strip ? rows.map((r) => stripLocalOnly(t, r)) : rows;
  }
  return tables;
}
function serverPush(server: DatabaseSync, tables: Record<string, Row[]>) {
  for (const t of SYNC_TABLES) for (const row of tables[t.name] ?? []) {
    server.prepare(serverUpsertSql(t)).run(...(serverRowValues(t, row, 's1') as Param[]));
  }
}
function devicePull(db: DatabaseSync, server: DatabaseSync) {
  for (const t of SYNC_TABLES) {
    for (const row of server.prepare(pullSql(t)).all('s1', 0) as Row[]) db.prepare(upsertSql(t)).run(...(rowValues(t, row) as Param[]));
  }
}
const image = (db: DatabaseSync) => (db.prepare("SELECT image_uri FROM products WHERE id='p1'").get() as { image_uri: string | null }).image_uri;
const name = (db: DatabaseSync) => (db.prepare("SELECT name, selling_price FROM products WHERE id='p1'").get() as { name: string; selling_price: number });

test('stripLocalOnly and rowValues never let a local file path leave or enter', () => {
  assert.equal(stripLocalOnly(products, product('A', 1, 1, 1, 'file:///a.webp')).image_uri, null);
  const idx = products.columns.indexOf('image_uri');
  assert.equal(rowValues(products, product('A', 1, 1, 1, 'file:///a.webp'))[idx], null);
  const sales = tableOf('sales');
  const row = { id: 's', note: 'x' };
  assert.equal(stripLocalOnly(sales, row), row);
});

test('the server never stores a device path, even from a client that does not strip it', async () => {
  const A = await makeDb(), server = await makeDb();
  deviceInsert(A, 'stores', store);
  deviceInsert(A, 'products', product('Cola', 5000, 100, 1));
  A.prepare("UPDATE products SET image_uri='file:///data/user/0/app/files/products/a.webp' WHERE id='p1'").run();
  serverPush(server, devicePush(A, 0, false));
  assert.equal(image(server), null);
  assert.equal(name(server).name, 'Cola');
});

test('a newer edit from another device keeps the local photo reference', async () => {
  const A = await makeDb(), B = await makeDb(), server = await makeDb();
  deviceInsert(A, 'stores', store);
  deviceInsert(A, 'products', product('Cola', 5000, 100, 1));
  A.prepare("UPDATE products SET image_uri='file:///A/products/a.webp' WHERE id='p1'").run();
  serverPush(server, devicePush(A, 0));
  devicePull(B, server);
  assert.equal(image(B), null);

  B.prepare("UPDATE products SET image_uri='file:///B/products/b.webp' WHERE id='p1'").run();
  deviceInsert(B, 'products', product('Cola 500', 5500, 300, 2, 'file:///B/products/b.webp'));
  assert.equal(image(B), 'file:///B/products/b.webp');
  serverPush(server, devicePush(B, 0));
  devicePull(A, server);

  assert.deepEqual({ ...name(A) }, { name: 'Cola 500', selling_price: 5500 });
  assert.equal(image(A), 'file:///A/products/a.webp');
  assert.equal(image(B), 'file:///B/products/b.webp');
  assert.equal(image(server), null);
});

test('a product created on another device arrives without a photo instead of a broken path', async () => {
  const A = await makeDb(), B = await makeDb(), server = await makeDb();
  deviceInsert(A, 'stores', store);
  deviceInsert(A, 'products', product('Cola', 5000, 100, 1, 'file:///A/products/a.webp'));
  assert.equal(image(A), null);
  A.prepare("UPDATE products SET image_uri='file:///A/products/a.webp' WHERE id='p1'").run();
  serverPush(server, devicePush(A, 0));
  devicePull(B, server);
  assert.equal(image(B), null);
  assert.equal(name(B).name, 'Cola');
});
