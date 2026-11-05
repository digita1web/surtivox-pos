import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '@surtivox/database';
import { attemptPinOn, createStaffOn, deleteStaffOn, updateStaffOn, type StaffDb, type StaffDeps } from './staffOps.ts';

type Param = string | number | null;

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const migration of MIGRATIONS) db.exec(migration.sql);
  const now = Date.now();
  const store = db.prepare('INSERT INTO stores (id,name,currency_code,currency_locale,currency_decimals,created_at,updated_at,device_id) VALUES (?,?,?,?,?,?,?,?)');
  store.run('s1', 'Tienda', 'COP', 'es-CO', 0, now, now, 'd');
  store.run('s2', 'Otra', 'COP', 'es-CO', 0, now, now, 'd');
  return db;
}

function adapter(db: DatabaseSync): StaffDb {
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
  } as unknown as StaffDb;
}

function deps(): StaffDeps {
  let n = 0;
  return {
    newId: () => `id-${++n}`,
    deviceId: 'd',
    salt: () => `salt-${++n}`,
    hash: (pin, salt) => `h(${salt}:${pin})`,
    verify: (pin, salt, hash) => hash === `h(${salt}:${pin})`,
  };
}

const count = (db: DatabaseSync, where = '1=1') => Number((db.prepare(`SELECT COUNT(*) AS n FROM staff WHERE active=1 AND deleted_at IS NULL AND ${where}`).get() as { n: number }).n);

async function twoOwnersAndACashier(db: DatabaseSync, d: StaffDeps) {
  const a = adapter(db);
  const owner = await createStaffOn(a, d, { storeId: 's1', name: 'Mateo', role: 'owner', pin: '1357' });
  const cashier = await createStaffOn(a, d, { storeId: 's1', name: 'Camila', role: 'cashier', pin: '2468' });
  return { a, owner, cashier };
}

test('the first account must be the owner and the PIN must not be weak', async () => {
  const db = freshDb(); const d = deps(); const a = adapter(db);
  await assert.rejects(createStaffOn(a, d, { storeId: 's1', name: 'Camila', role: 'cashier', pin: '2468' }), /propietario/);
  await assert.rejects(createStaffOn(a, d, { storeId: 's1', name: 'Mateo', role: 'owner', pin: '1234' }), /fácil de adivinar/);
  await assert.rejects(createStaffOn(a, d, { storeId: 's1', name: 'Mateo', role: 'owner', pin: '12' }), /4 dígitos/);
  assert.equal(count(db), 0);
  await createStaffOn(a, d, { storeId: 's1', name: '  Mateo   Castro ', role: 'owner', pin: '1357' });
  assert.equal((db.prepare('SELECT name FROM staff').get() as { name: string }).name, 'Mateo Castro');
});

test('names are unique per store ignoring case and accents, but another store may reuse them', async () => {
  const db = freshDb(); const d = deps();
  const { a } = await twoOwnersAndACashier(db, d);
  await assert.rejects(createStaffOn(a, d, { storeId: 's1', name: 'camila', role: 'cashier', pin: '9051' }), /Ya hay una persona/);
  await assert.rejects(createStaffOn(a, d, { storeId: 's1', name: 'MATÉO', role: 'cashier', pin: '9051' }), /Ya hay una persona/);
  await createStaffOn(a, d, { storeId: 's2', name: 'Camila', role: 'owner', pin: '9051' });
  assert.equal(count(db, "store_id='s2'"), 1);
});

test('the last owner cannot be demoted, but can once another owner exists', async () => {
  const db = freshDb(); const d = deps();
  const { a, owner, cashier } = await twoOwnersAndACashier(db, d);
  await assert.rejects(updateStaffOn(a, d, { id: owner, name: 'Mateo', role: 'cashier' }), /al menos un propietario/);
  assert.equal(count(db, "role='owner'"), 1);
  await updateStaffOn(a, d, { id: cashier, name: 'Camila', role: 'owner' });
  await updateStaffOn(a, d, { id: owner, name: 'Mateo', role: 'manager' });
  assert.equal(count(db, "role='owner'"), 1);
});

test('renaming to a taken name is rejected, keeping your own name is fine, and a new PIN is validated', async () => {
  const db = freshDb(); const d = deps();
  const { a, owner, cashier } = await twoOwnersAndACashier(db, d);
  await assert.rejects(updateStaffOn(a, d, { id: cashier, name: 'mateo', role: 'cashier' }), /Ya hay una persona/);
  await updateStaffOn(a, d, { id: cashier, name: 'Camila', role: 'cashier' });
  await assert.rejects(updateStaffOn(a, d, { id: owner, name: 'Mateo', role: 'owner', pin: '0000' }), /fácil de adivinar/);
  const before = (db.prepare('SELECT pin_hash FROM staff WHERE id=?').get(owner) as { pin_hash: string }).pin_hash;
  await updateStaffOn(a, d, { id: owner, name: 'Mateo', role: 'owner', pin: '8642' });
  assert.notEqual((db.prepare('SELECT pin_hash FROM staff WHERE id=?').get(owner) as { pin_hash: string }).pin_hash, before);
});

test('you cannot remove yourself or the last owner, and removal is limited to the store', async () => {
  const db = freshDb(); const d = deps();
  const { a, owner, cashier } = await twoOwnersAndACashier(db, d);
  await assert.rejects(deleteStaffOn(a, 's1', cashier, cashier), /tu propia cuenta/);
  await assert.rejects(deleteStaffOn(a, 's1', owner, null), /último propietario/);
  await assert.rejects(deleteStaffOn(a, 's2', cashier, owner), /No se encontró/);
  await deleteStaffOn(a, 's1', cashier, owner);
  assert.equal(count(db), 1);
  const gone = db.prepare('SELECT active, deleted_at FROM staff WHERE id=?').get(cashier) as { active: number; deleted_at: number | null };
  assert.equal(gone.active, 0);
  assert.ok(gone.deleted_at);
});

test('five wrong PINs lock that person for 30 seconds, even the right PIN is refused, then it recovers', async () => {
  const db = freshDb(); const d = deps();
  const { a, cashier } = await twoOwnersAndACashier(db, d);
  const t0 = 5_000_000;
  const results = [];
  for (let i = 0; i < 4; i++) results.push(await attemptPinOn(a, d, cashier, '0001', t0 + i));
  assert.deepEqual(results.map((r) => r.status === 'wrong' ? r.attemptsLeft : -1), [4, 3, 2, 1]);
  const fifth = await attemptPinOn(a, d, cashier, '0001', t0 + 10);
  assert.deepEqual(fifth, { status: 'locked', retryAt: t0 + 10 + 30_000 });
  assert.deepEqual(await attemptPinOn(a, d, cashier, '2468', t0 + 15_000), { status: 'locked', retryAt: t0 + 10 + 30_000 });
  const ok = await attemptPinOn(a, d, cashier, '2468', t0 + 31_000);
  assert.equal(ok.status, 'ok');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM local_settings WHERE key LIKE 'pin_guard:%'").get()!.n, 0);
});

test('the lock survives restarts because it is stored, and one person lock does not affect another', async () => {
  const db = freshDb(); const d = deps();
  const { a, owner, cashier } = await twoOwnersAndACashier(db, d);
  for (let i = 0; i < 5; i++) await attemptPinOn(a, d, cashier, '0001', 1000 + i);
  const again = await attemptPinOn(adapter(db), d, cashier, '2468', 1010);
  assert.equal(again.status, 'locked');
  assert.equal((await attemptPinOn(a, d, owner, '1357', 1010)).status, 'ok');
});

test('a correct PIN works first time, an unknown id is reported, and a deleted person cannot sign in', async () => {
  const db = freshDb(); const d = deps();
  const { a, owner, cashier } = await twoOwnersAndACashier(db, d);
  const ok = await attemptPinOn(a, d, owner, '1357', 1);
  assert.equal(ok.status === 'ok' && ok.staff.role, 'owner');
  assert.deepEqual(await attemptPinOn(a, d, 'nadie', '1357', 1), { status: 'unknown' });
  await deleteStaffOn(a, 's1', cashier, owner);
  assert.deepEqual(await attemptPinOn(a, d, cashier, '2468', 2), { status: 'unknown' });
});

test('changing a PIN clears a previous lock so the owner can recover a locked cashier', async () => {
  const db = freshDb(); const d = deps();
  const { a, cashier } = await twoOwnersAndACashier(db, d);
  for (let i = 0; i < 5; i++) await attemptPinOn(a, d, cashier, '0001', 1000 + i);
  assert.equal((await attemptPinOn(a, d, cashier, '2468', 1010)).status, 'locked');
  await updateStaffOn(a, d, { id: cashier, name: 'Camila', role: 'cashier', pin: '9051' });
  assert.equal((await attemptPinOn(a, d, cashier, '9051', 1011)).status, 'ok');
});
