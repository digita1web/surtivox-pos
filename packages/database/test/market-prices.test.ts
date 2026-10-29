import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS, runMigrations, type SqlExecutor } from '../src/index.ts';

function adapter(db: DatabaseSync): SqlExecutor {
  return {
    exec: async (sql) => { db.exec(sql); },
    select: async <T>(sql: string) => db.prepare(sql).all() as T[],
  };
}

async function freshDb(): Promise<DatabaseSync> {
  const db = new DatabaseSync(':memory:');
  await runMigrations(adapter(db), MIGRATIONS);
  db.exec(`
    INSERT INTO stores (id,name,currency_code,currency_locale,currency_decimals,created_at,updated_at,device_id,version)
    VALUES ('s1','Shop','COP','es-CO',0,0,0,'d1',1);
    INSERT INTO products (id,store_id,name,selling_price,cost_price,created_at,updated_at,device_id,version)
    VALUES ('p1','s1','Arroz',2500,2000,0,0,'d1',1);
  `);
  return db;
}

function upsert(db: DatabaseSync, price: number, fetchedAt: number) {
  db.prepare(`
    INSERT INTO market_prices
      (id,ean,provider_id,supermarket_name,location,context_key,price_minor,currency_code,
       product_name,presentation,product_url,source,source_updated_at,fetched_at,match_quality,created_at,updated_at)
    VALUES ('mp1','7702511000045','vtex:exitocol','Éxito',NULL,'online',?,'COP',
            'Arroz DIANA','5000 gr','https://www.exito.com/p','vtex',NULL,?,'exact_ean',?,?)
    ON CONFLICT(ean,provider_id,context_key) DO UPDATE SET
      price_minor=excluded.price_minor, fetched_at=excluded.fetched_at, updated_at=excluded.updated_at
  `).run(price, fetchedAt, fetchedAt, fetchedAt);
}

test('market prices upsert by EAN and provider without duplicating and without touching products', async () => {
  const db = await freshDb();
  upsert(db, 22390, 1000);
  upsert(db, 22990, 2000);
  const rows = db.prepare('SELECT price_minor, fetched_at FROM market_prices').all() as any[];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].price_minor, 22990);
  assert.equal(rows[0].fetched_at, 2000);
  const product = db.prepare('SELECT selling_price, cost_price FROM products WHERE id=?').get('p1') as any;
  assert.equal(product.selling_price, 2500);
  assert.equal(product.cost_price, 2000);
  assert.equal((db.prepare('SELECT COUNT(*) c FROM stock_movements').get() as any).c, 0);
});

test('market prices reject invalid EAN and non-positive prices', async () => {
  const db = await freshDb();
  assert.throws(() => db.exec(`
    INSERT INTO market_prices
      (id,ean,provider_id,supermarket_name,context_key,price_minor,currency_code,product_name,
       source,fetched_at,match_quality,created_at,updated_at)
    VALUES ('bad','ABC','vtex:exitocol','Éxito','online',22390,'COP','Arroz','vtex',1,'exact_ean',1,1);
  `));
  assert.throws(() => db.exec(`
    INSERT INTO market_prices
      (id,ean,provider_id,supermarket_name,context_key,price_minor,currency_code,product_name,
       source,fetched_at,match_quality,created_at,updated_at)
    VALUES ('bad','7702511000045','vtex:exitocol','Éxito','online',0,'COP','Arroz','vtex',1,'exact_ean',1,1);
  `));
});
