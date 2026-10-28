import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '@openpocket/database';
import { SEED_PRODUCTS, seedColombianCatalog, type SeedDatabase } from './seedCatalog.ts';

function testDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const migration of MIGRATIONS) db.exec(migration.sql);
  const now = Date.now();
  db.prepare('INSERT INTO stores (id,name,currency_code,currency_locale,currency_decimals,created_at,updated_at,device_id) VALUES (?,?,?,?,?,?,?,?)')
    .run('s1', 'Tienda', 'COP', 'es-CO', 0, now, now, 'd1');
  return db;
}

function adapter(db: DatabaseSync): SeedDatabase {
  return {
    getFirstAsync: async (sql: string, params: readonly (string | number | null)[] = []) => db.prepare(sql).get(...params) ?? null,
    runAsync: async (sql: string, params: readonly (string | number | null)[] = []) => {
      db.prepare(sql).run(...params);
      return {};
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
  } as unknown as SeedDatabase;
}

test('seed inserts the full catalog once and skips duplicates', async () => {
  const db = testDb();
  const seedDb = adapter(db);
  let sequence = 0;
  const ids = { newId: () => `id-${++sequence}`, deviceId: 'd1' };

  const first = await seedColombianCatalog(seedDb, 's1', ids);
  assert.equal(SEED_PRODUCTS.length, 60);
  assert.equal(first.inserted, 60);
  assert.equal(first.skipped, 0);

  const second = await seedColombianCatalog(seedDb, 's1', ids);
  assert.equal(second.inserted, 0);
  assert.equal(second.skipped, 60);

  const products = db.prepare('SELECT COUNT(*) AS c FROM products WHERE store_id=?').get('s1') as { c: number };
  assert.equal(products.c, 60);

  const categories = db.prepare('SELECT COUNT(*) AS c FROM categories WHERE store_id=?').get('s1') as { c: number };
  assert.equal(categories.c, new Set(SEED_PRODUCTS.map((p) => p.category)).size);

  const expectedStock = SEED_PRODUCTS.reduce((sum, p) => sum + p.stock, 0);
  const stock = db.prepare('SELECT COALESCE(SUM(quantity_delta),0) AS total FROM stock_movements WHERE store_id=?').get('s1') as { total: number };
  assert.equal(stock.total, expectedStock);

  const rice = db.prepare('SELECT selling_price FROM products WHERE store_id=? AND name=?').get('s1', 'Arroz Diana 500 g') as { selling_price: number };
  assert.equal(rice.selling_price, 2500);
  assert.notEqual(rice.selling_price, 250000);
});
