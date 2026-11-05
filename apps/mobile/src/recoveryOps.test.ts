import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { MIGRATIONS } from '@surtivox/database';
import { hashPin, verifyPin } from './roles.ts';
import { attemptPinOn, createStaffOn, type StaffDb, type StaffDeps } from './staffOps.ts';
import { hasRecoveryOn, resetPinWithRecoveryOn, setupRecoveryOn, type RecoveryDb, type RecoveryDeps } from './recoveryOps.ts';

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

function adapter(db: DatabaseSync): RecoveryDb & StaffDb {
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
  } as unknown as RecoveryDb & StaffDb;
}

function deps() {
  let n = 0;
  const staff: StaffDeps = {
    newId: () => `id-${++n}`, deviceId: 'd', salt: () => `salt-${++n}`, hash: hashPin, verify: verifyPin,
  };
  const recovery: RecoveryDeps = {
    randomBytes: (length) => Uint8Array.from(randomBytes(length)),
    digest: async (text) => createHash('sha256').update(text).digest('hex'),
    salt: () => `rsalt-${++n}`,
    hashPin,
  };
  return { staff, recovery };
}

async function shop(db: DatabaseSync, d: ReturnType<typeof deps>) {
  const a = adapter(db);
  const owner = await createStaffOn(a, d.staff, { storeId: 's1', name: 'Mateo', role: 'owner', pin: '1357' });
  const cashier = await createStaffOn(a, d.staff, { storeId: 's1', name: 'Camila', role: 'cashier', pin: '2468' });
  const code = await setupRecoveryOn(a, d.recovery, 's1');
  return { a, owner, cashier, code };
}

const reset = (a: RecoveryDb, d: ReturnType<typeof deps>, over: Partial<Parameters<typeof resetPinWithRecoveryOn>[2]> & { code: string; ownerId: string }) =>
  resetPinWithRecoveryOn(a, d.recovery, { storeId: 's1', newPin: '8642', now: 1_000_000, ...over });

test('setup returns a formatted code and stores only a salted SHA-256, never the code', async () => {
  const db = freshDb(); const d = deps();
  const { a, code } = await shop(db, d);
  assert.match(code, /^[1-9A-HJ-NP-Z]{4}(-[1-9A-HJ-NP-Z]{4}){3}$/);
  assert.equal(await hasRecoveryOn(a, 's1'), true);
  assert.equal(await hasRecoveryOn(a, 's2'), false);
  const everything = JSON.stringify(db.prepare('SELECT key, value FROM local_settings').all());
  assert.ok(!everything.includes(code.replace(/-/g, '')), 'el codigo no debe estar en claro');
  assert.ok(!everything.includes(code));
  assert.match((db.prepare("SELECT value FROM local_settings WHERE key='recovery_hash:s1'").get() as { value: string }).value, /^[0-9a-f]{64}$/);
});

test('the right code sets the new PIN, the old PIN stops working and the owner can sign in', async () => {
  const db = freshDb(); const d = deps();
  const { a, owner, code } = await shop(db, d);
  const res = await reset(a, d, { ownerId: owner, code });
  assert.equal(res.status, 'ok');
  assert.equal((await attemptPinOn(a, d.staff, owner, '1357', 1)).status, 'wrong');
  assert.equal((await attemptPinOn(a, d.staff, owner, '8642', 2)).status, 'ok');
});

test('a locked owner can recover: the PIN lock is cleared by a valid reset', async () => {
  const db = freshDb(); const d = deps();
  const { a, owner, code } = await shop(db, d);
  for (let i = 0; i < 5; i++) await attemptPinOn(a, d.staff, owner, '0001', 1000 + i);
  assert.equal((await attemptPinOn(a, d.staff, owner, '1357', 1010)).status, 'locked');
  assert.equal((await reset(a, d, { ownerId: owner, code })).status, 'ok');
  assert.equal((await attemptPinOn(a, d.staff, owner, '8642', 1011)).status, 'ok');
});

test('the code is rotated after use: the old one fails and the new one works', async () => {
  const db = freshDb(); const d = deps();
  const { a, owner, code } = await shop(db, d);
  const first = await reset(a, d, { ownerId: owner, code });
  assert.ok(first.status === 'ok' && first.newCode !== code);
  assert.equal((await reset(a, d, { ownerId: owner, code, now: 2_000_000 })).status, 'wrong');
  const second = await reset(a, d, { ownerId: owner, code: first.status === 'ok' ? first.newCode : '', newPin: '9051', now: 3_000_000 });
  assert.equal(second.status, 'ok');
});

test('typing the code with lowercase, spaces or dashes works', async () => {
  const db = freshDb(); const d = deps();
  const { a, owner, code } = await shop(db, d);
  const sloppy = ` ${code.toLowerCase().replace(/-/g, ' ')} `;
  assert.equal((await reset(a, d, { ownerId: owner, code: sloppy })).status, 'ok');
});

test('wrong codes are limited: five failures lock for 30 seconds, even the right code is refused, and it persists', async () => {
  const db = freshDb(); const d = deps();
  const { a, owner, code } = await shop(db, d);
  const wrong = 'AAAA-AAAA-AAAA-AAAA';
  const t0 = 9_000_000;
  const seen = [];
  for (let i = 0; i < 4; i++) { const r = await reset(a, d, { ownerId: owner, code: wrong, now: t0 + i }); seen.push(r.status === 'wrong' ? r.attemptsLeft : -1); }
  assert.deepEqual(seen, [4, 3, 2, 1]);
  const fifth = await reset(a, d, { ownerId: owner, code: wrong, now: t0 + 10 });
  assert.deepEqual(fifth, { status: 'locked', retryAt: t0 + 10 + 30_000 });
  assert.equal((await reset(adapter(db), d, { ownerId: owner, code, now: t0 + 15_000 })).status, 'locked');
  assert.equal((await reset(a, d, { ownerId: owner, code, now: t0 + 31_000 })).status, 'ok');
});

test('typos and weak PINs do not consume attempts nor the code', async () => {
  const db = freshDb(); const d = deps();
  const { a, owner, code } = await shop(db, d);
  for (let i = 0; i < 8; i++) assert.equal((await reset(a, d, { ownerId: owner, code: 'ABC' })).status, 'bad-format');
  for (let i = 0; i < 8; i++) assert.equal((await reset(a, d, { ownerId: owner, code, newPin: '1234' })).status, 'bad-pin');
  assert.equal((await reset(a, d, { ownerId: owner, code })).status, 'ok');
});

test('it only works for an active owner of the same store', async () => {
  const db = freshDb(); const d = deps();
  const { a, cashier, code } = await shop(db, d);
  assert.equal((await reset(a, d, { ownerId: cashier, code })).status, 'no-owner');
  assert.equal((await reset(a, d, { ownerId: 'nadie', code })).status, 'no-owner');
  const other = await createStaffOn(a, d.staff, { storeId: 's2', name: 'Ana', role: 'owner', pin: '1357' });
  assert.equal((await reset(a, d, { ownerId: other, code })).status, 'no-owner');
  assert.equal((await resetPinWithRecoveryOn(a, d.recovery, { storeId: 's2', ownerId: other, code, newPin: '8642', now: 1 })).status, 'missing');
});

test('a store without a recovery code reports it instead of failing silently', async () => {
  const db = freshDb(); const d = deps();
  const a = adapter(db);
  const owner = await createStaffOn(a, d.staff, { storeId: 's1', name: 'Mateo', role: 'owner', pin: '1357' });
  assert.equal((await reset(a, d, { ownerId: owner, code: 'AAAA-AAAA-AAAA-AAAA' })).status, 'missing');
});

test('generating a new code replaces the old one and clears a previous lock', async () => {
  const db = freshDb(); const d = deps();
  const { a, owner, code } = await shop(db, d);
  for (let i = 0; i < 5; i++) await reset(a, d, { ownerId: owner, code: 'AAAA-AAAA-AAAA-AAAA', now: 100 + i });
  assert.equal((await reset(a, d, { ownerId: owner, code, now: 110 })).status, 'locked');
  const fresh = await setupRecoveryOn(a, d.recovery, 's1');
  assert.notEqual(fresh, code);
  assert.equal((await reset(a, d, { ownerId: owner, code, now: 120 })).status, 'wrong');
  assert.equal((await reset(a, d, { ownerId: owner, code: fresh, now: 130 })).status, 'ok');
});
