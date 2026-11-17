import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.ts';
import { fakeD1 } from './support.ts';

const TOKEN = 'TIENDACUOTA23456';

function server(vars: Record<string, string> = {}, schema = true) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  if (!schema) db.exec('DROP TABLE store_usage');
  const env = { DB: fakeD1(db), ...vars } as never;
  const call = async (path: string, body?: unknown) => {
    const res = await worker.fetch(new Request(`https://sync.test${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', 'CF-Connecting-IP': '203.0.113.8' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, headers: res.headers, body: await res.json() as Record<string, any> };
  };
  return { db, call };
}

const store = { id: 's1', name: 'Tienda', currency_code: 'COP', currency_locale: 'es-CO', currency_decimals: 0, created_at: 1, updated_at: 1, device_id: 'd', version: 1 };
const product = (i: number, at = 1000) => ({
  id: `p${String(i).padStart(3, '0')}`, store_id: 's1', name: `Producto ${i}`, cost_price: 0, selling_price: 100, unit: 'unit', track_inventory: 1,
  tax_bps: 0, active: 1, created_at: at, updated_at: at, device_id: 'd', version: 1,
});

async function registered(vars: Record<string, string> = {}, schema = true) {
  const s = server(vars, schema);
  assert.equal((await s.call('/sync/register', { storeId: 's1' })).status, 200);
  return s;
}

test('el tope diario de filas cuenta lo aplicado y bloquea con 429 y retry-after al superarlo', async () => {
  const { call, db } = await registered({ QUOTA_DAILY_ROWS: '5' });
  assert.equal((await call('/sync/push', { tables: { stores: [store], products: [product(1), product(2)] } })).status, 200);
  const day = new Date().toISOString().slice(0, 10);
  assert.equal((db.prepare('SELECT rows FROM store_usage WHERE store_id=? AND day=?').get('s1', day) as { rows: number }).rows, 3);
  const over = await call('/sync/push', { tables: { products: [product(3), product(4), product(5)] } });
  assert.equal(over.status, 429);
  assert.deepEqual(over.body, { error: 'quota_exceeded', limit: 5, used: 3 });
  const retry = Number(over.headers.get('retry-after'));
  assert.ok(retry >= 1 && retry <= 86_400);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n, 2);
  assert.equal((await call('/sync/push', { tables: { products: [product(3), product(4)] } })).status, 200);
});

test('con tope 0 no hay límite y sin la tabla de conteo no se bloquea a nadie', async () => {
  const off = await registered({ QUOTA_DAILY_ROWS: '0' });
  assert.equal((await off.call('/sync/push', { tables: { products: Array.from({ length: 50 }, (_, i) => product(i)) } })).status, 200);
  const missing = await registered({ QUOTA_DAILY_ROWS: '1' }, false);
  assert.equal((await missing.call('/sync/push', { tables: { stores: [store], products: [product(1)] } })).status, 200);
});

test('el pull paginado no pierde ni repite filas aunque muchas compartan el mismo milisegundo', async () => {
  const { call } = await registered({ QUOTA_DAILY_ROWS: '0' });
  const rows = Array.from({ length: 30 }, (_, i) => product(i, 5000));
  await call('/sync/push', { tables: { stores: [store], products: rows } });
  const seen: string[] = [];
  let after: string | null = null;
  let pages = 0;
  let cursor = 0;
  for (;;) {
    const page = await call(`/sync/pull?since=0&limit=7${after ? `&after=${encodeURIComponent(after)}` : ''}`);
    assert.equal(page.status, 200);
    pages++;
    for (const [table, list] of Object.entries(page.body.tables as Record<string, { id: string }[]>)) for (const r of list) seen.push(`${table}:${r.id}`);
    cursor = Math.max(cursor, page.body.cursor);
    if (!page.body.more) break;
    assert.notEqual(page.body.next, after);
    after = page.body.next;
    assert.ok(pages < 20);
  }
  assert.equal(new Set(seen).size, seen.length);
  assert.equal(seen.filter((k) => k.startsWith('products:')).length, 30);
  assert.ok(seen.includes('stores:s1'));
  assert.equal(pages, 5);
  assert.equal(cursor, 5000);
});

test('sin limit la respuesta es la de siempre, y un marcador inválido da 400', async () => {
  const { call } = await registered({ QUOTA_DAILY_ROWS: '0' });
  await call('/sync/push', { tables: { stores: [store], products: [product(1), product(2)] } });
  const all = await call('/sync/pull?since=0');
  assert.equal(all.body.more, undefined);
  assert.equal(all.body.tables.products.length, 2);
  assert.equal(Object.keys(all.body.tables).length > 10, true);
  assert.equal((await call('/sync/pull?since=0&limit=5&after=inventada|1|x')).status, 400);
  assert.equal((await call('/sync/pull?since=0&limit=5&after=products|nan|x')).status, 400);
  const only = await call('/sync/pull?since=0&limit=1&tables=products');
  assert.deepEqual(Object.keys(only.body.tables), ['products']);
  assert.equal(only.body.more, true);
});
