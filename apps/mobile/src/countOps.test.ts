import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '@surtivox/database';
import type { SaleOpsDatabase } from './saleOps.ts';
import { closeCountOn, countLinesOn, expectedStockOn, lastCountAtOn, openCountOn, recordCountOn, type CountIds } from './countOps.ts';
import { countDiff, diffLabel, parseCounted } from './stockCount.ts';

type Param = string | number | null;

function testDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const m of MIGRATIONS) db.exec(m.sql);
  const store = db.prepare('INSERT INTO stores (id,name,currency_code,currency_locale,currency_decimals,created_at,updated_at,device_id) VALUES (?,?,?,?,?,?,?,?)');
  store.run('s1', 'Tienda', 'COP', 'es-CO', 0, 0, 0, 'd1');
  store.run('s2', 'Otra', 'COP', 'es-CO', 0, 0, 0, 'd1');
  const product = db.prepare('INSERT INTO products (id,store_id,name,cost_price,selling_price,track_inventory,created_at,updated_at,device_id) VALUES (?,?,?,?,?,?,?,?,?)');
  product.run('p1', 's1', 'Arroz', 1000, 2000, 1, 0, 0, 'd1');
  product.run('p2', 's1', 'Bolsa', 0, 100, 0, 0, 0, 'd1');
  product.run('p3', 's1', 'Muestra', 0, 0, 1, 0, 0, 'd1');
  product.run('p9', 's2', 'Ajeno', 500, 900, 1, 0, 0, 'd1');
  const staff = db.prepare("INSERT INTO staff (id,store_id,name,role,pin_salt,pin_hash,created_at,updated_at,device_id) VALUES (?, 's1', ?, ?, 'x', 'y', 0, 0, 'd1')");
  staff.run('e1', 'Ana', 'manager');
  staff.run('e2', 'Luis', 'owner');
  const move = db.prepare("INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,created_at,device_id) VALUES (?,?,?,'opening_stock',?,0,'d1')");
  move.run('o1', 's1', 'p1', 10);
  move.run('o3', 's1', 'p3', 4);
  return db;
}

function adapter(db: DatabaseSync): SaleOpsDatabase {
  return {
    getFirstAsync: async (sql: string, params: readonly Param[] = []) => db.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql: string, params: readonly Param[] = []) => db.prepare(sql).all(...params),
    runAsync: async (sql: string, params: readonly Param[] = []) => {
      const r = db.prepare(sql).run(...params);
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    withTransactionAsync: async (task: () => Promise<void>) => {
      db.exec('BEGIN');
      try { await task(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  } as unknown as SaleOpsDatabase;
}

let serial = 0;

function ids(start = 1000): CountIds {
  let t = start;
  return { newId: () => `id-${++serial}`, deviceId: 'd1', now: () => ++t };
}

const stock = (db: DatabaseSync, id: string) => Number((db.prepare('SELECT COALESCE(SUM(quantity_delta),0) AS n FROM stock_movements WHERE product_id=?').get(id) as { n: number }).n);
const movements = (db: DatabaseSync) => db.prepare('SELECT * FROM stock_movements ORDER BY id').all().map((r) => ({ ...r }));
const count = (db: DatabaseSync, sql: string) => Number((db.prepare(sql).get() as { n: number }).n);

test('countDiff separates shortage, surplus and no difference and values units at cost', () => {
  assert.deepEqual(countDiff(10, 7, 1000), { delta: -3, kind: 'faltante', units: 3, value: 3000 });
  assert.deepEqual(countDiff(10, 12, 1000), { delta: 2, kind: 'sobrante', units: 2, value: 2000 });
  assert.deepEqual(countDiff(5, 5, 1000), { delta: 0, kind: 'sin_diferencia', units: 0, value: 0 });
  assert.deepEqual(countDiff(-2, 5, 300), { delta: 7, kind: 'sobrante', units: 7, value: 2100 });
  assert.equal(countDiff(4, 1, 0).value, 0);
  assert.equal(countDiff(4, 1, -50).value, 0);
});

test('parseCounted accepts only whole non negative quantities', () => {
  assert.equal(parseCounted(' 12 '), 12);
  assert.equal(parseCounted('0'), 0);
  for (const bad of ['', '-1', '1.5', '1,5', 'abc', '12345678']) assert.equal(parseCounted(bad), null, bad);
});

test('diffLabel uses neutral wording', () => {
  assert.equal(diffLabel({ kind: 'faltante', units: 1 }), 'Faltante: 1 unidad');
  assert.equal(diffLabel({ kind: 'sobrante', units: 3 }), 'Sobrante: 3 unidades');
  assert.equal(diffLabel({ kind: 'sin_diferencia', units: 0 }), 'Sin diferencia');
});

test('a shortage inserts one adjustment linked to the count and leaves old movements untouched', async () => {
  const db = testDb();
  const before = movements(db);
  const a = adapter(db);
  const k = await openCountOn(a, ids(), 's1', 'e1');
  const r = await recordCountOn(a, ids(2000), k, 'p1', 7);
  assert.equal(r.expected, 10);
  assert.equal(r.kind, 'faltante');
  assert.equal(r.value, 3000);
  assert.equal(stock(db, 'p1'), 7);
  const after = movements(db);
  assert.deepEqual(after.filter((m) => before.some((b) => b.id === m.id)), before);
  const adj = after.find((m) => m.id === r.movementId)!;
  assert.equal(adj.type, 'adjustment');
  assert.equal(adj.quantity_delta, -3);
  assert.equal(adj.reference_type, 'stock_count');
  assert.equal(adj.reference_id, k);
  const line = db.prepare('SELECT * FROM stock_count_lines WHERE id=?').get(r.lineId) as Record<string, unknown>;
  assert.equal(line.unit_cost, 1000);
  assert.equal(line.movement_id, r.movementId);
  assert.equal((db.prepare('SELECT staff_id FROM stock_counts WHERE id=?').get(k) as { staff_id: string }).staff_id, 'e1');
});

test('a surplus adds stock and no difference records the line without a movement', async () => {
  const db = testDb();
  const a = adapter(db);
  const k = await openCountOn(a, ids(), 's1', null);
  const over = await recordCountOn(a, ids(2000), k, 'p1', 12);
  assert.equal(over.delta, 2);
  assert.equal(stock(db, 'p1'), 12);
  const moves = count(db, 'SELECT COUNT(*) AS n FROM stock_movements');
  const same = await recordCountOn(a, ids(3000), k, 'p3', 4);
  assert.equal(same.kind, 'sin_diferencia');
  assert.equal(same.movementId, null);
  assert.equal(count(db, 'SELECT COUNT(*) AS n FROM stock_movements'), moves);
  assert.equal(count(db, 'SELECT COUNT(*) AS n FROM stock_count_lines'), 2);
});

test('the expected stock is read at confirm time, so a sale during the count is not counted as missing', async () => {
  const db = testDb();
  const a = adapter(db);
  const k = await openCountOn(a, ids(), 's1', 'e1');
  assert.equal(await expectedStockOn(a, 'p1'), 10);
  db.prepare("INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,created_at,device_id) VALUES ('v1','s1','p1','sale',-1,5,'d1')").run();
  const r = await recordCountOn(a, ids(2000), k, 'p1', 9);
  assert.equal(r.expected, 9);
  assert.equal(r.kind, 'sin_diferencia');
});

test('counting the same product again adjusts from the stock left by the first count', async () => {
  const db = testDb();
  const a = adapter(db);
  const k = await openCountOn(a, ids(), 's1', 'e1');
  await recordCountOn(a, ids(2000), k, 'p1', 7);
  const again = await recordCountOn(a, ids(3000), k, 'p1', 8);
  assert.equal(again.expected, 7);
  assert.equal(again.delta, 1);
  assert.equal(stock(db, 'p1'), 8);
  assert.deepEqual((await countLinesOn(a, k)).map((l) => l.counted_qty), [8, 7]);
});

test('invalid counts are rejected and leave nothing behind', async () => {
  const db = testDb();
  const a = adapter(db);
  const k = await openCountOn(a, ids(), 's1', 'e1');
  const snapshot = () => [count(db, 'SELECT COUNT(*) AS n FROM stock_movements'), count(db, 'SELECT COUNT(*) AS n FROM stock_count_lines')];
  const start = snapshot();
  await assert.rejects(recordCountOn(a, ids(), k, 'p1', -1), /entero/);
  await assert.rejects(recordCountOn(a, ids(), k, 'p1', 1.5), /entero/);
  await assert.rejects(recordCountOn(a, ids(), k, 'p2', 3), /no controla inventario/);
  await assert.rejects(recordCountOn(a, ids(), k, 'p9', 3), /no existe en esta tienda/);
  await assert.rejects(recordCountOn(a, ids(), 'nada', 'p1', 3), /no existe/);
  db.prepare("UPDATE products SET deleted_at=1 WHERE id='p3'").run();
  await assert.rejects(recordCountOn(a, ids(), k, 'p3', 3), /no existe en esta tienda/);
  assert.equal(await closeCountOn(a, ids(), k), true);
  await assert.rejects(recordCountOn(a, ids(), k, 'p1', 3), /ya se terminó/);
  assert.deepEqual(snapshot(), start);
});

test('an open count is resumed by the same person and a closed one starts fresh', async () => {
  const db = testDb();
  const a = adapter(db);
  const k1 = await openCountOn(a, ids(), 's1', 'e1');
  assert.equal(await openCountOn(a, ids(), 's1', 'e1'), k1);
  const other = await openCountOn(a, { ...ids(), newId: () => 'otro' }, 's1', 'e2');
  assert.notEqual(other, k1);
  const noStaff = await openCountOn(a, { ...ids(), newId: () => 'sin' }, 's1', null);
  assert.equal(await openCountOn(a, ids(), 's1', null), noStaff);
  assert.equal(await closeCountOn(a, ids(), k1), true);
  assert.equal(await closeCountOn(a, ids(), k1), false);
  const v = db.prepare('SELECT status, closed_at, version FROM stock_counts WHERE id=?').get(k1) as Record<string, unknown>;
  assert.equal(v.status, 'closed');
  assert.equal(v.version, 2);
  assert.ok(Number(v.closed_at) > 0);
  assert.notEqual(await openCountOn(a, { ...ids(), newId: () => 'nuevo' }, 's1', 'e1'), k1);
});

test('lastCountAt is the latest counted line of the store', async () => {
  const db = testDb();
  const a = adapter(db);
  assert.equal(await lastCountAtOn(a, 's1'), null);
  const k = await openCountOn(a, ids(), 's1', 'e1');
  assert.equal(await lastCountAtOn(a, 's1'), null);
  await recordCountOn(a, ids(5000), k, 'p1', 10);
  assert.equal(await lastCountAtOn(a, 's1'), 5001);
  assert.equal(await lastCountAtOn(a, 's2'), null);
});

test('search finds tracked products by name without accents, barcode or sku', async () => {
  const { searchCountable, productForCode } = await import('./stockCount.ts');
  const list = [
    { id: 'a', name: 'Café Águila Roja 250 g', barcode: '7702032', sku: 'CAF1', track_inventory: 1 },
    { id: 'b', name: 'Bolsa plástica', barcode: '111', sku: null, track_inventory: 0 },
    { id: 'c', name: 'Cafetera', barcode: null, sku: null },
  ];
  assert.deepEqual(searchCountable(list, 'cafe aguila').map((p) => p.id), ['a']);
  assert.deepEqual(searchCountable(list, 'CAFE').map((p) => p.id), ['a', 'c']);
  assert.deepEqual(searchCountable(list, '7702032').map((p) => p.id), ['a']);
  assert.deepEqual(searchCountable(list, 'caf1').map((p) => p.id), ['a']);
  assert.deepEqual(searchCountable(list, 'bolsa'), []);
  assert.deepEqual(searchCountable(list, '  '), []);
  assert.equal(productForCode(list, '7702032')?.id, 'a');
  assert.equal(productForCode(list, '111'), null);
  assert.equal(productForCode(list, ''), null);
});

test('periodRange covers today from midnight, rolling windows and everything', async () => {
  const { periodRange } = await import('./stockCount.ts');
  const now = new Date(2026, 10, 16, 15, 30).getTime();
  assert.deepEqual(periodRange('hoy', now), { from: new Date(2026, 10, 16).getTime(), to: now + 1 });
  assert.equal(periodRange('7d', now).from, now - 7 * 86_400_000);
  assert.equal(periodRange('30d', now).from, now - 30 * 86_400_000);
  assert.deepEqual(periodRange('todo', now), { from: 0, to: now + 1 });
});
