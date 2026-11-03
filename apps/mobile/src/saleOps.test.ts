import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '@surtivox/database';
import { assertReturnable, voidSaleOn, type SaleOpsDatabase } from './saleOps.ts';

type Param = string | number | null;

function testDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const migration of MIGRATIONS) db.exec(migration.sql);
  const now = Date.now();
  db.prepare('INSERT INTO stores (id,name,currency_code,currency_locale,currency_decimals,created_at,updated_at,device_id) VALUES (?,?,?,?,?,?,?,?)')
    .run('s1', 'Tienda', 'COP', 'es-CO', 0, now, now, 'd1');
  db.prepare('INSERT INTO customers (id,store_id,name,created_at,updated_at,device_id) VALUES (?,?,?,?,?,?)')
    .run('c1', 's1', 'Cliente', now, now, 'd1');
  const product = db.prepare('INSERT INTO products (id,store_id,name,cost_price,selling_price,track_inventory,created_at,updated_at,device_id) VALUES (?,?,?,?,?,?,?,?,?)');
  product.run('p1', 's1', 'Arroz', 1000, 2000, 1, now, now, 'd1');
  product.run('p2', 's1', 'Borrador', 0, 500, 0, now, now, 'd1');
  return db;
}

function adapter(db: DatabaseSync): SaleOpsDatabase {
  return {
    getFirstAsync: async (sql: string, params: readonly Param[] = []) => db.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql: string, params: readonly Param[] = []) => db.prepare(sql).all(...params),
    runAsync: async (sql: string, params: readonly Param[] = []) => {
      const result = db.prepare(sql).run(...params);
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    withTransactionAsync: async (task: () => Promise<void>) => {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  } as unknown as SaleOpsDatabase;
}

function insertSale(db: DatabaseSync, opts: { customer: boolean }): void {
  const now = Date.now();
  db.prepare("INSERT INTO sales (id,store_id,invoice_no,customer_id,status,subtotal,grand_total,sold_at,created_at,updated_at,device_id) VALUES ('sale1','s1','INV-0001',?,'completed',2500,2500,?,?,?,'d1')")
    .run(opts.customer ? 'c1' : null, now, now, now);
  const item = db.prepare('INSERT INTO sale_items (id,sale_id,product_id,product_name_snapshot,unit_price,quantity,line_total,created_at,device_id) VALUES (?,?,?,?,?,?,?,?,?)');
  item.run('i1', 'sale1', 'p1', 'Arroz', 2000, 1, 2000, now, 'd1');
  item.run('i2', 'sale1', 'p2', 'Borrador', 500, 1, 500, now, 'd1');
  const move = db.prepare("INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,reference_type,reference_id,created_at,device_id) VALUES (?,?,?,'sale',-1,'sale','sale1',?,'d1')");
  move.run('m1', 's1', 'p1', now);
  if (opts.customer) {
    db.prepare("INSERT INTO customer_ledger (id,store_id,customer_id,type,amount,reference_type,reference_id,created_at,device_id) VALUES ('l1','s1','c1','sale',2500,'sale','sale1',?,'d1')").run(now);
  }
}

function ids() {
  let n = 0;
  return { newId: () => `id-${++n}`, deviceId: 'd1' };
}

const stock = (db: DatabaseSync) => Number((db.prepare("SELECT COALESCE(SUM(quantity_delta),0) AS n FROM stock_movements WHERE product_id='p1'").get() as { n: number }).n);
const balance = (db: DatabaseSync) => Number((db.prepare("SELECT COALESCE(SUM(amount),0) AS n FROM customer_ledger WHERE customer_id='c1'").get() as { n: number }).n);

test('voidSale restores tracked stock once, skips untracked and zeroes the credit balance', async () => {
  const db = testDb();
  insertSale(db, { customer: true });
  await voidSaleOn(adapter(db), ids(), 's1', 'sale1');
  assert.equal(stock(db), 0);
  assert.equal(balance(db), 0);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM stock_movements WHERE product_id='p2'").get() as { n: number }).n, 0);
  assert.equal((db.prepare("SELECT status FROM sales WHERE id='sale1'").get() as { status: string }).status, 'void');
});

test('voidSale twice is rejected and adds no second movement or ledger entry', async () => {
  const db = testDb();
  insertSale(db, { customer: true });
  const a = adapter(db);
  await voidSaleOn(a, ids(), 's1', 'sale1');
  await assert.rejects(voidSaleOn(a, ids(), 's1', 'sale1'), /ya está anulada/);
  assert.equal(stock(db), 0);
  assert.equal(balance(db), 0);
  assert.equal((db.prepare("SELECT version FROM sales WHERE id='sale1'").get() as { version: number }).version, 2);
});

test('concurrent voidSale calls apply exactly one void', async () => {
  const db = testDb();
  insertSale(db, { customer: true });
  const a = adapter(db);
  const results = await Promise.allSettled([voidSaleOn(a, ids(), 's1', 'sale1'), voidSaleOn(a, ids(), 's1', 'sale1')]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(stock(db), 0);
  assert.equal(balance(db), 0);
});

test('voidSale rejects a sale from another store and one that has returns', async () => {
  const db = testDb();
  insertSale(db, { customer: false });
  const a = adapter(db);
  await assert.rejects(voidSaleOn(a, ids(), 's2', 'sale1'), /No se encontró/);
  db.prepare("INSERT INTO returns (id,store_id,sale_id,refund_method,subtotal,grand_total,created_at,updated_at,device_id) VALUES ('r1','s1','sale1','cash',2000,2000,1,1,'d1')").run();
  await assert.rejects(voidSaleOn(a, ids(), 's1', 'sale1'), /devoluciones/);
  assert.equal(stock(db), -1);
});

test('assertReturnable rejects voided sales and over-returns, accepts the remainder', async () => {
  const db = testDb();
  insertSale(db, { customer: false });
  const a = adapter(db);
  const check = { saleItemId: 'i1', name: 'Arroz', soldQuantity: 3, quantity: 2 };
  await assertReturnable(a, 'sale1', [check]);
  db.prepare("INSERT INTO returns (id,store_id,sale_id,refund_method,subtotal,grand_total,created_at,updated_at,device_id) VALUES ('r1','s1','sale1','cash',2000,2000,1,1,'d1')").run();
  db.prepare("INSERT INTO return_items (id,return_id,sale_item_id,product_name_snapshot,unit_price,quantity,line_total,created_at,device_id) VALUES ('ri1','r1','i1','Arroz',2000,2,4000,1,'d1')").run();
  await assert.rejects(assertReturnable(a, 'sale1', [check]), /más de 1 de Arroz/);
  await assertReturnable(a, 'sale1', [{ ...check, quantity: 1 }]);
  db.prepare("UPDATE sales SET status='void' WHERE id='sale1'").run();
  await assert.rejects(assertReturnable(a, 'sale1', [{ ...check, quantity: 1 }]), /anulada/);
});
