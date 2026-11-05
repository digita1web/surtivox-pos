import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { kitServer } from './support.ts';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');

const T1 = '7e32ee3494a1afa74edeff99e28133fb9e6c678f3e7093cef2064fded379ef19';
const H1 = '330475c1cf192581c70802b67352e0c2b08393de04ce64e10b243d685766a0f2';
const T2 = 'a'.repeat(64);
const T3 = 'b'.repeat(64);
const LEGACY = 'AAAAAAAAAAAAAAAA';

const dump = (db: ReturnType<typeof kitServer>['db']) => JSON.stringify(
  (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[])
    .map((t) => db.prepare(`SELECT * FROM "${t.name}"`).all()),
);

test('el registro con la llave del kit guarda solo la huella (vector compartido con el movil)', async () => {
  const { call, db } = kitServer();
  const res = await call('/sync/register', T1, { storeId: 's1' });
  assert.equal(res.status, 200);
  const row = db.prepare('SELECT key_hash FROM shop_keys WHERE store_id = ?').get('s1') as { key_hash: string };
  assert.equal(row.key_hash, H1);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM sync_tokens').get() as { n: number }).n, 0);
  assert.ok(!dump(db).includes(T1));
  assert.equal((await call('/sync/pull?since=0', T1)).status, 200);
});

test('un cliente viejo con codigo de 16 caracteres sigue sincronizando', async () => {
  const { call, db } = kitServer();
  assert.equal((await call('/sync/register', LEGACY, { storeId: 's1' })).status, 200);
  assert.equal((await call('/sync/push', LEGACY, { tables: { stores: [] } })).status, 200);
  assert.equal((await call('/sync/pull?since=0', LEGACY)).status, 200);
  assert.ok(!dump(db).includes(LEGACY));
  assert.equal((db.prepare('SELECT key_hash FROM shop_keys WHERE store_id = ?').get('s1') as { key_hash: string }).key_hash, sha(LEGACY));
});

test('una fila heredada en claro se migra a huella en el primer uso y el texto claro desaparece', async () => {
  const { call, db } = kitServer();
  db.prepare('INSERT INTO sync_tokens (token, store_id, created_at) VALUES (?, ?, ?)').run(LEGACY, 's1', 1);
  assert.equal((await call('/sync/pull?since=0', LEGACY)).status, 200);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM sync_tokens').get() as { n: number }).n, 0);
  assert.equal((db.prepare('SELECT key_hash FROM shop_keys WHERE store_id = ?').get('s1') as { key_hash: string }).key_hash, sha(LEGACY));
  assert.equal((await call('/sync/pull?since=0', LEGACY)).status, 200);
  assert.ok(!dump(db).includes(LEGACY));
});

test('registrar otra llave en una tienda reclamada sigue rechazandose', async () => {
  const { call } = kitServer();
  await call('/sync/register', T1, { storeId: 's1' });
  const attack = await call('/sync/register', T2, { storeId: 's1' });
  assert.equal(attack.status, 403);
  assert.equal(attack.body.error, 'store_already_claimed');
  assert.equal((await call('/sync/pull?since=0', T2)).status, 401);
});

test('rotar: la llave vieja deja de servir al instante y la nueva funciona', async () => {
  const { call, db } = kitServer();
  await call('/sync/register', T1, { storeId: 's1' });
  const rotated = await call('/sync/rotate', T1, { newToken: T2 });
  assert.equal(rotated.status, 200);
  assert.equal(rotated.body.rotated, true);
  assert.equal((await call('/sync/pull?since=0', T1)).status, 401);
  assert.equal((await call('/sync/pull?since=0', T2)).status, 200);
  assert.equal((db.prepare('SELECT key_hash FROM shop_keys WHERE store_id = ?').get('s1') as { key_hash: string }).key_hash, sha(T2));
  assert.ok(!dump(db).includes(T2));
});

test('rotar es idempotente ante el reintento con la misma llave nueva', async () => {
  const { call } = kitServer();
  await call('/sync/register', T1, { storeId: 's1' });
  await call('/sync/rotate', T1, { newToken: T2 });
  const retry = await call('/sync/rotate', T1, { newToken: T2 });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.rotated, false);
  const same = await call('/sync/rotate', T2, { newToken: T2 });
  assert.equal(same.status, 200);
  assert.equal((await call('/sync/pull?since=0', T2)).status, 200);
});

test('rotar rechaza una llave mal formada y una huella ya usada por otra tienda sin perder acceso', async () => {
  const { call } = kitServer();
  await call('/sync/register', T1, { storeId: 's1' });
  await call('/sync/register', T3, { storeId: 's2' });
  assert.equal((await call('/sync/rotate', T1, { newToken: 'corta' })).status, 400);
  assert.equal((await call('/sync/rotate', T1, {})).status, 400);
  const clash = await call('/sync/rotate', T1, { newToken: T3 });
  assert.equal(clash.status, 409);
  assert.equal((await call('/sync/pull?since=0', T1)).status, 200);
});

test('rotar sin autenticacion valida devuelve 401', async () => {
  const { call } = kitServer();
  await call('/sync/register', T1, { storeId: 's1' });
  assert.equal((await call('/sync/rotate', T3, { newToken: T2 })).status, 401);
  assert.equal((await call('/sync/pull?since=0', T1)).status, 200);
});

test('un token inexistente y uno incorrecto responden exactamente lo mismo', async () => {
  const { call } = kitServer();
  await call('/sync/register', T1, { storeId: 's1' });
  const unknown = await call('/sync/pull?since=0', T3, undefined, '198.51.100.1');
  const wrong = await call('/sync/pull?since=0', `${T1.slice(0, 63)}0`, undefined, '198.51.100.2');
  assert.equal(unknown.status, 401);
  assert.equal(wrong.status, 401);
  assert.equal(unknown.text, wrong.text);
});

test('limite de intentos: tras 5 fallos la IP recibe 429 con Retry-After', async () => {
  const { call } = kitServer();
  await call('/sync/register', T1, { storeId: 's1' });
  for (let i = 0; i < 5; i++) assert.equal((await call('/sync/pull?since=0', T3, undefined, '198.51.100.9')).status, 401);
  const blocked = await call('/sync/pull?since=0', T3, undefined, '198.51.100.9');
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
  const validButBlocked = await call('/sync/pull?since=0', T1, undefined, '198.51.100.9');
  assert.equal(validButBlocked.status, 429);
  assert.equal((await call('/sync/pull?since=0', T1, undefined, '198.51.100.10')).status, 200);
});

test('el bloqueo crece con cada fallo y se libera al vencer', async () => {
  const { call, db } = kitServer();
  const clock = mock.method(Date, 'now', () => 1_000_000);
  try {
    for (let i = 0; i < 5; i++) await call('/sync/pull?since=0', T3, undefined, '198.51.100.20');
    const first = db.prepare('SELECT blocked_until FROM kit_attempts').get() as { blocked_until: number };
    assert.equal(first.blocked_until, 1_000_000 + 60_000);
    clock.mock.mockImplementation(() => 1_000_000 + 61_000);
    assert.equal((await call('/sync/pull?since=0', T3, undefined, '198.51.100.20')).status, 401);
    const second = db.prepare('SELECT blocked_until, failures FROM kit_attempts').get() as { blocked_until: number; failures: number };
    assert.equal(second.failures, 6);
    assert.equal(second.blocked_until, 1_000_000 + 61_000 + 120_000);
    clock.mock.mockImplementation(() => 1_000_000 + 61_000 + 11 * 60_000);
    assert.equal((await call('/sync/pull?since=0', T3, undefined, '198.51.100.20')).status, 401);
    assert.equal((db.prepare('SELECT failures FROM kit_attempts').get() as { failures: number }).failures, 1);
  } finally {
    clock.mock.restore();
  }
});

test('los aciertos no escriben en kit_attempts', async () => {
  const { call, db } = kitServer();
  await call('/sync/register', T1, { storeId: 's1' });
  for (let i = 0; i < 6; i++) await call('/sync/pull?since=0', T1);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM kit_attempts').get() as { n: number }).n, 0);
});

test('ninguna respuesta ni fila contiene la llave ni su huella completa en claro fuera de key_hash', async () => {
  const { call, db } = kitServer();
  const responses = [
    await call('/sync/register', T1, { storeId: 's1' }),
    await call('/sync/rotate', T1, { newToken: T2 }),
    await call('/sync/pull?since=0', T1),
    await call('/sync/pull?since=0', T2),
  ];
  for (const res of responses) {
    assert.ok(!res.text.includes(T1) && !res.text.includes(T2));
    assert.ok(!res.text.includes(sha(T1)) && !res.text.includes(sha(T2)));
    for (const [key] of res.headers) assert.ok(!res.headers.get(key)!.includes(T2));
  }
  assert.ok(!dump(db).includes(T1) && !dump(db).includes(T2));
});

test('la migracion 0001 es idempotente sobre el esquema actual', async () => {
  const { db } = kitServer();
  const { readFileSync } = await import('node:fs');
  const sql = readFileSync(new URL('../migrations/0001_shop_keys.sql', import.meta.url), 'utf8');
  db.exec(sql);
  db.exec(sql);
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name = 'shop_keys'").get());
});

test('rotar con una carrera: si otra rotacion gano primero, responde 409 y no pisa la llave', async () => {
  let raced = false;
  const { call, db } = kitServer((database, sql) => {
    if (!raced && sql.startsWith('UPDATE shop_keys')) {
      raced = true;
      database.prepare('UPDATE shop_keys SET key_hash = ? WHERE store_id = ?').run(sha(T3), 's1');
    }
  });
  await call('/sync/register', T1, { storeId: 's1' });
  const res = await call('/sync/rotate', T1, { newToken: T2 });
  assert.equal(res.status, 409);
  assert.equal((db.prepare('SELECT key_hash FROM shop_keys WHERE store_id = ?').get('s1') as { key_hash: string }).key_hash, sha(T3));
});
