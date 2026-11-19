import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker, { DEFAULT_QUOTA_DAILY_ROWS, DEFAULT_QUOTA_GLOBAL_ROWS, USAGE_TOTAL_ID, rowsWrittenBy } from '../src/index.ts';
import { fakeD1 } from './support.ts';

const TOKEN = 'TIENDACUOTA23456';

function withRowsWritten(d1: ReturnType<typeof fakeD1>, perChange: number) {
  return {
    ...d1,
    batch: async (statements: Parameters<typeof d1.batch>[0]) => (await d1.batch(statements)).map((r) => ({ ...r, meta: { ...r.meta, rows_written: r.meta.changes * perChange } })),
  };
}

function server(vars: Record<string, string> = {}, schema = true, rowsWrittenPerChange: number | null = null) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  if (!schema) db.exec('DROP TABLE store_usage');
  const d1 = fakeD1(db);
  const env = { DB: rowsWrittenPerChange === null ? d1 : withRowsWritten(d1, rowsWrittenPerChange), ...vars } as never;
  const call = async (path: string, body?: unknown, token = TOKEN) => {
    const res = await worker.fetch(new Request(`https://sync.test${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'CF-Connecting-IP': '203.0.113.8' },
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

async function registered(vars: Record<string, string> = {}, schema = true, rowsWrittenPerChange: number | null = null) {
  const s = server(vars, schema, rowsWrittenPerChange);
  assert.equal((await s.call('/sync/register', { storeId: 's1' })).status, 200);
  return s;
}

const today = () => new Date().toISOString().slice(0, 10);
const usage = (db: DatabaseSync, id: string) => (db.prepare('SELECT rows FROM store_usage WHERE store_id=? AND day=?').get(id, today()) as { rows: number } | undefined)?.rows ?? 0;
const count = (db: DatabaseSync, table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

test('los valores por defecto protegen el plan gratis: 10.000 escritas por tienda y 85.000 en total', () => {
  assert.equal(DEFAULT_QUOTA_DAILY_ROWS, 10_000);
  assert.equal(DEFAULT_QUOTA_GLOBAL_ROWS, 85_000);
});

test('rowsWrittenBy usa las filas escritas que informa D1 y, si faltan, estima dos por fila cambiada', () => {
  assert.equal(rowsWrittenBy([{ meta: { rows_written: 4, changes: 1 } }, { meta: { rows_written: 0, changes: 0 } }]), 4);
  assert.equal(rowsWrittenBy([{ meta: { changes: 3 } }, { meta: { changes: 0 } }, {}]), 6);
  assert.equal(rowsWrittenBy([{ meta: { rows_written: 'x', changes: 'y' } }, null]), 0);
  assert.equal(rowsWrittenBy(undefined), 0);
});

test('el tope por tienda cuenta las filas que D1 escribió de verdad y bloquea con 429 y retry-after', async () => {
  const { call, db } = await registered({ QUOTA_DAILY_ROWS: '20', QUOTA_GLOBAL_ROWS: '0' }, true, 3);
  assert.equal((await call('/sync/push', { tables: { stores: [store], products: [product(1), product(2)] } })).status, 200);
  assert.equal(usage(db, 's1'), 9);
  assert.equal((await call('/sync/push', { tables: { products: [product(1), product(2)] } })).status, 200);
  assert.equal(usage(db, 's1'), 9, 'reenviar filas que el servidor ya tenía no gasta cupo');
  const over = await call('/sync/push', { tables: { products: [3, 4, 5, 6, 7, 8].map((i) => product(i)) } });
  assert.equal(over.status, 429);
  assert.deepEqual(over.body, { error: 'quota_exceeded', scope: 'store', limit: 20, used: 9 });
  const retry = Number(over.headers.get('retry-after'));
  assert.ok(retry >= 1 && retry <= 86_400);
  assert.equal(count(db, 'products'), 2);
  assert.equal((await call('/sync/push', { tables: { products: [product(3), product(4), product(5), product(6), product(7)] } })).status, 200);
  assert.equal(usage(db, 's1'), 24);
});

test('el interruptor general corta a todas las tiendas al llegar al total del día sin revelar el uso de otras', async () => {
  const s = await registered({ QUOTA_DAILY_ROWS: '0', QUOTA_GLOBAL_ROWS: '10' });
  assert.equal((await s.call('/sync/register', { storeId: 's2' }, 'OTRATIENDA23456')).status, 200);
  assert.equal((await s.call('/sync/push', { tables: { stores: [store], products: [product(1), product(2)] } })).status, 200);
  assert.equal(usage(s.db, USAGE_TOTAL_ID), 6);
  assert.equal(usage(s.db, 's1'), 6);
  const other = { ...store, id: 's2' };
  const cut = await s.call('/sync/push', { tables: { stores: [other], products: [{ ...product(9), store_id: 's2' }, { ...product(10), store_id: 's2' }] } }, 'OTRATIENDA23456');
  assert.equal(cut.status, 429);
  assert.deepEqual(cut.body, { error: 'quota_exceeded', scope: 'cloud' });
  assert.ok(Number(cut.headers.get('retry-after')) >= 1);
  assert.equal(count(s.db, 'stores'), 1);
  assert.equal((await s.call('/sync/push', { tables: { stores: [other] } }, 'OTRATIENDA23456')).status, 200);
  assert.equal(usage(s.db, USAGE_TOTAL_ID), 8);
  assert.equal(usage(s.db, 's2'), 2);
});

test('una tienda no puede registrarse con el id del contador global', async () => {
  const s = server();
  assert.equal((await s.call('/sync/register', { storeId: USAGE_TOTAL_ID })).status, 400);
});

test('la subida es todo o nada: si una fila falla no queda nada a medias ni se cobra cupo', async () => {
  const { call, db } = await registered({ QUOTA_DAILY_ROWS: '1000', QUOTA_GLOBAL_ROWS: '1000' });
  const broken = { ...product(2), name: null };
  await assert.rejects(call('/sync/push', { tables: { stores: [store], products: [product(1), broken] } }), /name/);
  assert.equal(count(db, 'stores'), 0);
  assert.equal(count(db, 'products'), 0);
  assert.equal(usage(db, 's1'), 0);
  assert.equal(usage(db, USAGE_TOTAL_ID), 0);
  assert.equal((await call('/sync/push', { tables: { stores: [store], products: [product(1), product(2)] } })).status, 200);
  assert.equal(count(db, 'stores'), 1);
  assert.equal(count(db, 'products'), 2);
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
