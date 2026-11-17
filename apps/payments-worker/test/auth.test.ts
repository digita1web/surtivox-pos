import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker, { authorized } from '../src/index.ts';

type Param = string | number | null;

function fakeD1(db: DatabaseSync) {
  const statement = (sql: string, params: Param[] = []) => ({
    bind: (...values: Param[]) => statement(sql, values),
    first: async () => db.prepare(sql).get(...params) ?? null,
    run: async () => ({ success: true, meta: { changes: Number(db.prepare(sql).run(...params).changes) } }),
  });
  return { prepare: (sql: string) => statement(sql) };
}

const TOKEN = 'TIENDAPRUEBA2345';
const hash = (t: string) => createHash('sha256').update(t).digest('hex');

function env() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../sync-worker/schema.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  db.prepare('INSERT INTO shop_keys (store_id, key_hash, created_at) VALUES (?, ?, ?)').run('s1', hash(TOKEN), 1);
  db.prepare('INSERT INTO sync_tokens (token, store_id, created_at) VALUES (?, ?, ?)').run('LEGADOLEGADO99', 's2', 1);
  return { db, env: { DB: fakeD1(db), WOMPI_PUBLIC_KEY: 'pub_test_x', WOMPI_INTEGRITY_SECRET: 'secreto' } as never };
}

const call = (e: unknown, body: unknown) =>
  worker.fetch(new Request('https://pagos.test/pagos/crear', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), e as never);

test('una tienda registrada con su llave (shop_keys) puede crear el pago', async () => {
  const { db, env: e } = env();
  const res = await call(e, { store_id: 's1', token: TOKEN });
  assert.equal(res.status, 201);
  const body = await res.json() as { reference: string; url: string };
  assert.match(body.url, /^https:\/\/checkout\.wompi\.co\//);
  assert.equal((db.prepare('SELECT store_id FROM payment_intents WHERE reference=?').get(body.reference) as { store_id: string }).store_id, 's1');
});

test('la llave de una tienda no autoriza pagos de otra, ni una llave inventada', async () => {
  const { db, env: e } = env();
  assert.equal((await call(e, { store_id: 's2', token: TOKEN })).status, 401);
  assert.equal((await call(e, { store_id: 's1', token: 'OTRALLAVE12345' })).status, 401);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM payment_intents').get() as { n: number }).n, 0);
});

test('un token heredado de sync_tokens sigue sirviendo solo para su tienda', async () => {
  const { env: e } = env();
  const d = (e as { DB: unknown }).DB as never;
  assert.equal(await authorized({ DB: d }, 's2', 'LEGADOLEGADO99'), true);
  assert.equal(await authorized({ DB: d }, 's1', 'LEGADOLEGADO99'), false);
});

test('sin configuración de Wompi o con datos inválidos no se crea nada', async () => {
  const { env: e } = env();
  assert.equal((await call({ ...(e as object), WOMPI_PUBLIC_KEY: undefined }, { store_id: 's1', token: TOKEN })).status, 503);
  assert.equal((await call(e, { store_id: 's1' })).status, 400);
  assert.equal((await call(e, { store_id: '../x', token: TOKEN })).status, 400);
});
