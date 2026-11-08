import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '@surtivox/database';
import type { SaleOpsDatabase, SaleOpsIds } from './saleOps.ts';
import type { CheckoutProduct } from './checkoutOps.ts';

type Param = string | number | null;

export const NOW = Date.UTC(2026, 10, 7, 15, 0, 0);

export const ARROZ: CheckoutProduct = { id: 'p1', name: 'Arroz', selling_price: 2000, cost_price: 1000, tax_bps: 0, track_inventory: 1 };
export const BORRADOR: CheckoutProduct = { id: 'p2', name: 'Borrador', selling_price: 500, cost_price: 0, tax_bps: 0, track_inventory: 0 };
export const ACEITE: CheckoutProduct = { id: 'p3', name: 'Aceite', selling_price: 12000, cost_price: 9000, tax_bps: 0, track_inventory: 1 };

export function memoryDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const migration of MIGRATIONS) db.exec(migration.sql);
  db.prepare('INSERT INTO stores (id,name,currency_code,currency_locale,currency_decimals,created_at,updated_at,device_id) VALUES (?,?,?,?,?,?,?,?)')
    .run('s1', 'Tienda', 'COP', 'es-CO', 0, NOW, NOW, 'd1');
  db.prepare('INSERT INTO customers (id,store_id,name,created_at,updated_at,device_id) VALUES (?,?,?,?,?,?)')
    .run('c1', 's1', 'Cliente', NOW, NOW, 'd1');
  const product = db.prepare('INSERT INTO products (id,store_id,name,cost_price,selling_price,track_inventory,created_at,updated_at,device_id) VALUES (?,?,?,?,?,?,?,?,?)');
  for (const p of [ARROZ, BORRADOR, ACEITE]) product.run(p.id, 's1', p.name, p.cost_price, p.selling_price, p.track_inventory ?? 1, NOW, NOW, 'd1');
  db.prepare("INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,reference_type,created_at,device_id) VALUES ('open1','s1','p1','opening_stock',100,'opening',?,'d1')").run(NOW);
  db.prepare("INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,reference_type,created_at,device_id) VALUES ('open3','s1','p3','opening_stock',50,'opening',?,'d1')").run(NOW);
  return db;
}

export function adapter(db: DatabaseSync): SaleOpsDatabase {
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

export function makeIds(prefix = 'id', deviceId = 'd1'): SaleOpsIds {
  let n = 0;
  return { newId: () => `${prefix}-${++n}`, deviceId };
}

export function one<T>(db: DatabaseSync, sql: string, ...params: Param[]): T {
  return db.prepare(sql).get(...params) as T;
}

export function all<T>(db: DatabaseSync, sql: string, ...params: Param[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export const stockOf = (db: DatabaseSync, productId: string): number =>
  Number(one<{ n: number }>(db, 'SELECT COALESCE(SUM(quantity_delta),0) AS n FROM stock_movements WHERE product_id=?', productId).n);

export const balanceOf = (db: DatabaseSync, customerId = 'c1'): number =>
  Number(one<{ n: number }>(db, 'SELECT COALESCE(SUM(amount),0) AS n FROM customer_ledger WHERE customer_id=?', customerId).n);

export const countOf = (db: DatabaseSync, table: string): number =>
  Number(one<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ${table}`).n);
