import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '@surtivox/database';
import type { SaleOpsDatabase } from './saleOps.ts';
import { closeCountOn, openCountOn, recordCountOn, type CountIds } from './countOps.ts';
import { NEUTRAL_NOTE, countReportHtml, countReportOn, countReportText, countStaffOn } from './countReport.ts';

type Param = string | number | null;

function testDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO stores (id,name,currency_code,currency_locale,currency_decimals,created_at,updated_at,device_id) VALUES ('s1','Tienda','COP','es-CO',0,0,0,'d1')").run();
  const product = db.prepare("INSERT INTO products (id,store_id,name,cost_price,selling_price,track_inventory,created_at,updated_at,device_id) VALUES (?, 's1', ?, ?, 0, 1, 0, 0, 'd1')");
  product.run('p1', 'Arroz', 1000);
  product.run('p2', 'Aceite <1L>', 5000);
  product.run('p3', 'Sal', 300);
  const staff = db.prepare("INSERT INTO staff (id,store_id,name,role,pin_salt,pin_hash,created_at,updated_at,device_id) VALUES (?, 's1', ?, 'manager', 'x', 'y', 0, 0, 'd1')");
  staff.run('e1', 'Ana');
  staff.run('e2', 'Luis');
  const move = db.prepare("INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,created_at,device_id) VALUES (?, 's1', ?, 'opening_stock', ?, 0, 'd1')");
  move.run('o1', 'p1', 10);
  move.run('o2', 'p2', 4);
  move.run('o3', 'p3', 6);
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
const at = (ms: number): CountIds => ({ newId: () => `id-${++serial}`, deviceId: 'd1', now: () => ms });

async function scenario() {
  const db = testDb();
  const a = adapter(db);
  const k1 = await openCountOn(a, at(1000), 's1', 'e1');
  await recordCountOn(a, at(1100), k1, 'p1', 7);
  await recordCountOn(a, at(1200), k1, 'p1', 8);
  await recordCountOn(a, at(1300), k1, 'p2', 5);
  await recordCountOn(a, at(1400), k1, 'p3', 6);
  await closeCountOn(a, at(1500), k1);
  db.prepare("UPDATE products SET cost_price=9999 WHERE id='p1'").run();
  const k2 = await openCountOn(a, at(5000), 's1', 'e2');
  await recordCountOn(a, at(5100), k2, 'p1', 10);
  await closeCountOn(a, at(5200), k2);
  const k3 = await openCountOn(a, at(9000), 's1', null);
  await recordCountOn(a, at(9100), k3, 'p3', 2);
  return { db, a, k1, k2, k3 };
}

const ALL = { from: 0, to: 100_000 };

test('the report nets recounts per count, separates shortage from surplus and values at the cost of the count', async () => {
  const { a, k1 } = await scenario();
  const r = await countReportOn(a, 's1', ALL);
  const p1 = r.products.find((p) => p.productId === 'p1')!;
  assert.deepEqual({ ...p1 }, { productId: 'p1', name: 'Arroz', shortUnits: 2, shortValue: 2000, overUnits: 2, overValue: 19998 });
  const p2 = r.products.find((p) => p.productId === 'p2')!;
  assert.equal(p2.overUnits, 1);
  assert.equal(p2.shortUnits, 0);
  assert.ok(!r.products.some((p) => p.productId === 'p3' && p.shortUnits === 0 && p.overUnits === 0));
  const c1 = r.counts.find((c) => c.countId === k1)!;
  assert.deepEqual({ products: c1.products, shortUnits: c1.shortUnits, shortValue: c1.shortValue, overUnits: c1.overUnits, overValue: c1.overValue, staffName: c1.staffName },
    { products: 3, shortUnits: 2, shortValue: 2000, overUnits: 1, overValue: 5000, staffName: 'Ana' });
  assert.deepEqual(r.counts.map((c) => c.staffName), [null, 'Luis', 'Ana']);
  assert.deepEqual({ ...r.totals }, { shortUnits: 6, shortValue: 3200, overUnits: 3, overValue: 24998, productsCounted: 3, counts: 3 });
});

test('the report filters by date range and by who counted', async () => {
  const { a } = await scenario();
  const early = await countReportOn(a, 's1', { from: 0, to: 2000 });
  assert.equal(early.totals.counts, 1);
  assert.equal(early.totals.shortUnits, 2);
  const luis = await countReportOn(a, 's1', { ...ALL, staffId: 'e2' });
  assert.deepEqual(luis.counts.map((c) => c.staffName), ['Luis']);
  assert.equal(luis.totals.overUnits, 2);
  const nobody = await countReportOn(a, 's1', { ...ALL, staffId: null });
  assert.equal(nobody.totals.counts, 1);
  assert.equal(nobody.products[0]!.name, 'Sal');
  assert.equal((await countReportOn(a, 's1', { from: 20_000, to: 30_000 })).totals.counts, 0);
  assert.deepEqual((await countStaffOn(a, 's1')).map((s) => ({ ...s })), [{ id: 'e1', name: 'Ana' }, { id: 'e2', name: 'Luis' }]);
});

test('the shared text is neutral and the PDF escapes product names', async () => {
  const { a } = await scenario();
  const r = await countReportOn(a, 's1', ALL);
  const opts = { storeName: 'Tienda Don Pepe', periodLabel: 'Últimos 30 días', staffLabel: 'Todos', money: (m: number) => `$${m}` };
  const text = countReportText(r, opts);
  assert.match(text, /Faltante: 6 unidades · \$3200 a costo/);
  assert.match(text, /Sobrante: 3 unidades · \$24998 a costo/);
  assert.match(text, /- Sal: 4 unidades · \$1200/);
  assert.ok(text.endsWith(NEUTRAL_NOTE));
  for (const word of [/rob[oóa]/i, /culpa/i, /sospech/i, /responsable de la p[eé]rdida/i]) assert.doesNotMatch(text, word);
  assert.match(countReportText(r, { ...opts, maxLines: 1 }), /… y 1 más/);
  const html = countReportHtml(r, { ...opts, dateOf: (ms) => `d${ms}` });
  assert.match(html, /Aceite &lt;1L&gt;/);
  assert.doesNotMatch(html, /Aceite <1L>/);
  assert.match(html, /Sin empleado/);
});

test('a count with no differences says so', async () => {
  const db = testDb();
  const a = adapter(db);
  const k = await openCountOn(a, at(1000), 's1', 'e1');
  await recordCountOn(a, at(1100), k, 'p1', 10);
  const r = await countReportOn(a, 's1', ALL);
  assert.equal(r.products.length, 0);
  assert.equal(r.totals.productsCounted, 1);
  assert.match(countReportText(r, { storeName: 'T', periodLabel: 'Hoy', staffLabel: 'Ana', money: String }), /Todo lo contado coincide con el sistema/);
});
