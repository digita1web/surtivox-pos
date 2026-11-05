import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { MIGRATIONS } from '@surtivox/database';
import { deriveShopToken, entropyToWords } from '@surtivox/pos-core';
import {
  KIT_KEYS, adoptRecoveredKitOn, checkRecoveryGuardOn, clearRecoveryGuardOn, confirmKitOn, hasPendingRotationOn, isKitSettingKey,
  kitReminderText, kitStatusOn, loadKitOn, parseKitForRecovery, readKitReminderInputOn, recordRecoveryFailureOn, recoverFromKitOn,
  rotateKitOn, shouldRemindKit, snoozeKitReminderOn, startKitOn, KIT_REMIND_AFTER_MS, type KitDb, type KitDeps,
} from './kitOps.ts';

type Param = string | number | null;
const sha256 = async (data: Uint8Array) => new Uint8Array(createHash('sha256').update(data).digest());
const URL_BASE = 'https://sync.test';
const LEGACY = 'ABCDEFGHJKLMNPQR';

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const migration of MIGRATIONS) db.exec(migration.sql);
  return db;
}

function adapter(db: DatabaseSync): KitDb {
  return {
    getFirstAsync: async (sql: string, params: readonly Param[] = []) => db.prepare(sql).get(...params) ?? null,
    runAsync: async (sql: string, params: readonly Param[] = []) => {
      const result = db.prepare(sql).run(...params);
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    withTransactionAsync: async (task: () => Promise<void>) => {
      db.exec('BEGIN');
      try { await task(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  } as unknown as KitDb;
}

class Refusal extends Error {}

function setup(request?: KitDeps['request']) {
  const db = freshDb();
  const calls: { path: string; token: string; body: any }[] = [];
  let clock = 1_000_000;
  const deps: KitDeps = {
    randomBytes: (n) => new Uint8Array(randomBytes(n)),
    sha256,
    now: () => clock,
    request: request ?? (async (path, token, body) => { calls.push({ path, token, body }); return { ok: true }; }),
    isDefinitiveRefusal: (e) => e instanceof Refusal,
  };
  return { db, kit: adapter(db), deps, calls, tick: (ms: number) => { clock += ms; } };
}

const syncToken = (db: DatabaseSync) => (db.prepare('SELECT token FROM sync_state WHERE id = 1').get() as { token: string | null }).token;
const setting = (db: DatabaseSync, key: string) => (db.prepare('SELECT value FROM local_settings WHERE key = ?').get(key) as { value: string } | undefined)?.value ?? null;

test('crear el kit guarda la llave derivada y queda sin confirmar', async () => {
  const { db, kit, deps } = setup();
  const words = await startKitOn(kit, deps, URL_BASE);
  assert.equal(words.length, 8);
  const token = syncToken(db)!;
  assert.match(token, /^[0-9a-f]{64}$/);
  const info = await loadKitOn(kit, deps);
  assert.deepEqual(info?.words, words);
  assert.equal(info?.confirmedAt, null);
  assert.equal(await kitStatusOn(kit), 'unconfirmed');
});

test('la confirmacion exige las dos palabras correctas y no se puede saltar', async () => {
  const { kit, deps } = setup();
  const words = await startKitOn(kit, deps, URL_BASE);
  assert.equal(await confirmKitOn(kit, deps, [1, 5], ['luna', 'sol']), false);
  assert.equal(await confirmKitOn(kit, deps, [1, 5], ['', '']), false);
  assert.equal(await confirmKitOn(kit, deps, [1, 5], [words[1]!, words[4]!]), false);
  assert.equal(await kitStatusOn(kit), 'unconfirmed');
  assert.equal(await confirmKitOn(kit, deps, [1, 5], [` ${words[1]!.toUpperCase()} `, words[5]!]), true);
  assert.equal(await kitStatusOn(kit), 'confirmed');
});

test('rotar cambia la llave local solo despues de que el servidor responde bien', async () => {
  const { db, kit, deps, calls } = setup();
  await startKitOn(kit, deps, URL_BASE);
  const before = syncToken(db)!;
  const result = await rotateKitOn(kit, deps);
  assert.equal(result.status, 'ok');
  const after = syncToken(db)!;
  assert.notEqual(after, before);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.token, before);
  assert.equal(calls[0]!.body.newToken, after);
  assert.equal(await hasPendingRotationOn(kit), false);
  assert.equal(await kitStatusOn(kit), 'unconfirmed');
  if (result.status === 'ok') {
    const info = await loadKitOn(kit, deps);
    assert.deepEqual(info?.words, result.words);
    assert.equal(info?.version, 2);
  }
});

test('si el servidor rechaza la rotacion, la llave local no cambia y no queda estado a medias', async () => {
  const { db, kit, deps } = setup(async () => { throw new Refusal('rechazado'); });
  await startKitOn(kit, deps, URL_BASE);
  const before = syncToken(db);
  const kitBefore = setting(db, KIT_KEYS.entropy);
  await assert.rejects(rotateKitOn(kit, deps), Refusal);
  assert.equal(syncToken(db), before);
  assert.equal(setting(db, KIT_KEYS.entropy), kitBefore);
  assert.equal(await hasPendingRotationOn(kit), false);
});

test('si la red falla a mitad, la llave local no cambia y el reintento usa la misma llave nueva', async () => {
  const seen: string[] = [];
  let fail = true;
  const { db, kit, deps } = setup(async (_path, _token, body) => {
    seen.push((body as { newToken: string }).newToken);
    if (fail) throw new Error('sin red');
    return { ok: true };
  });
  await startKitOn(kit, deps, URL_BASE);
  const before = syncToken(db);
  await assert.rejects(rotateKitOn(kit, deps), /sin red/);
  assert.equal(syncToken(db), before);
  assert.equal(await hasPendingRotationOn(kit), true);
  fail = false;
  const retry = await rotateKitOn(kit, deps);
  assert.equal(retry.status, 'ok');
  assert.equal(seen[0], seen[1]);
  assert.equal(syncToken(db), seen[1]);
  assert.equal(await hasPendingRotationOn(kit), false);
});

test('rotar desde un codigo heredado de 16 caracteres usa ese codigo como autorizacion', async () => {
  const { db, kit, deps, calls } = setup();
  db.prepare('UPDATE sync_state SET server_url = ?, token = ? WHERE id = 1').run(URL_BASE, LEGACY);
  assert.equal(await kitStatusOn(kit), 'legacy');
  const result = await rotateKitOn(kit, deps);
  assert.equal(result.status, 'ok');
  assert.equal(calls[0]!.token, LEGACY);
  assert.match(syncToken(db)!, /^[0-9a-f]{64}$/);
  assert.equal(await kitStatusOn(kit), 'unconfirmed');
});

test('rotar sin respaldo activo no hace nada', async () => {
  const { kit, deps, calls } = setup();
  assert.deepEqual(await rotateKitOn(kit, deps), { status: 'not-connected' });
  assert.equal(calls.length, 0);
});

test('recuperar en un celular nuevo: tres pasos de punta a punta', async () => {
  const origin = setup();
  const words = await startKitOn(origin.kit, origin.deps, URL_BASE);
  const originToken = syncToken(origin.db)!;

  const fresh = setup();
  const text = words.map((w, i) => `${i + 1}. ${w.toUpperCase()}`).join('\n');
  let usedToken = '';
  const result = await recoverFromKitOn(
    fresh.kit,
    { ...fresh.deps, isAuthFailure: () => false, serverUrl: URL_BASE },
    text,
    async (token) => { usedToken = token; return 42; },
  );
  assert.deepEqual(result, { status: 'ok', restored: 42 });
  assert.equal(usedToken, originToken);
  assert.equal(syncToken(fresh.db), originToken);
  assert.equal(await kitStatusOn(fresh.kit), 'confirmed');
  assert.deepEqual((await loadKitOn(fresh.kit, fresh.deps))?.words, words);
});

test('recuperar con un kit invalido no toca el servidor y da el mensaje especifico', async () => {
  const { kit, deps } = setup();
  const words = await startKitOn(kit, deps, URL_BASE);
  let called = false;
  const restore = async () => { called = true; return 0; };
  const typo = words.slice(); typo[2] = 'zzzzzz';
  const unknown = await recoverFromKitOn(kit, { ...deps, isAuthFailure: () => false, serverUrl: URL_BASE }, typo.join(' '), restore);
  assert.equal(unknown.status, 'invalid');
  if (unknown.status === 'invalid') assert.match(unknown.message, /palabra 3/);
  const few = await recoverFromKitOn(kit, { ...deps, isAuthFailure: () => false, serverUrl: URL_BASE }, words.slice(0, 5).join(' '), restore);
  assert.equal(few.status, 'invalid');
  assert.equal(called, false);
});

test('los fallos de autenticacion bloquean los intentos con espera creciente y un acierto la limpia', async () => {
  const fresh = setup();
  const origin = setup();
  const words = await startKitOn(origin.kit, origin.deps, URL_BASE);
  const deps = { ...fresh.deps, isAuthFailure: (e: unknown) => e instanceof Refusal, serverUrl: URL_BASE };
  const reject = async () => { throw new Refusal('401'); };
  for (let i = 0; i < 5; i++) await assert.rejects(recoverFromKitOn(fresh.kit, deps, words.join(' '), reject), Refusal);
  const locked = await recoverFromKitOn(fresh.kit, deps, words.join(' '), async () => 1);
  assert.equal(locked.status, 'locked');
  fresh.tick(31_000);
  const ok = await recoverFromKitOn(fresh.kit, deps, words.join(' '), async () => 7);
  assert.deepEqual(ok, { status: 'ok', restored: 7 });
  assert.deepEqual(await checkRecoveryGuardOn(fresh.kit, fresh.deps.now()), { allowed: true });
});

test('el limite local no cuenta errores de red como fallo de autenticacion', async () => {
  const { kit, deps } = setup();
  const origin = setup();
  const words = await startKitOn(origin.kit, origin.deps, URL_BASE);
  for (let i = 0; i < 8; i++) {
    await assert.rejects(recoverFromKitOn(kit, { ...deps, isAuthFailure: () => false, serverUrl: URL_BASE }, words.join(' '), async () => { throw new Error('sin red'); }));
  }
  assert.deepEqual(await checkRecoveryGuardOn(kit, deps.now()), { allowed: true });
  await recordRecoveryFailureOn(kit, deps.now());
  await clearRecoveryGuardOn(kit);
  assert.deepEqual(await checkRecoveryGuardOn(kit, deps.now()), { allowed: true });
});

test('adoptar un kit recuperado lo deja confirmado', async () => {
  const { db, kit, deps } = setup();
  const entropy = new Uint8Array(randomBytes(10));
  await adoptRecoveredKitOn(kit, deps, entropy, URL_BASE);
  assert.equal(syncToken(db), await deriveShopToken(entropy, sha256));
  assert.deepEqual((await loadKitOn(kit, deps))?.words, await entropyToWords(entropy, sha256));
  assert.equal(setting(db, KIT_KEYS.confirmedAt), String(deps.now()));
});

test('parseKitForRecovery devuelve la llave del servidor para un kit valido', async () => {
  const entropy = new Uint8Array(randomBytes(10));
  const words = await entropyToWords(entropy, sha256);
  const parsed = await parseKitForRecovery(words.join(', '), { sha256 });
  assert.ok(parsed.ok);
  if (parsed.ok) assert.equal(parsed.token, await deriveShopToken(entropy, sha256));
});

test('las claves del kit se reconocen para excluirlas de las copias', () => {
  for (const key of Object.values(KIT_KEYS)) assert.ok(isKitSettingKey(key), key);
  assert.ok(!isKitSettingKey('last_backup_at'));
  assert.ok(!isKitSettingKey('appearance'));
});

test('recordatorio: kit sin confirmar a los 3 dias, codigo heredado siempre, respetando el aplazamiento', async () => {
  const now = 10 * 24 * 3_600_000;
  assert.equal(shouldRemindKit({ now, status: 'unconfirmed', createdAt: now - KIT_REMIND_AFTER_MS + 1, snoozeUntil: null }), false);
  assert.equal(shouldRemindKit({ now, status: 'unconfirmed', createdAt: now - KIT_REMIND_AFTER_MS, snoozeUntil: null }), true);
  assert.equal(shouldRemindKit({ now, status: 'confirmed', createdAt: 1, snoozeUntil: null }), false);
  assert.equal(shouldRemindKit({ now, status: 'none', createdAt: null, snoozeUntil: null }), false);
  assert.equal(shouldRemindKit({ now, status: 'legacy', createdAt: null, snoozeUntil: null }), true);
  assert.equal(shouldRemindKit({ now, status: 'legacy', createdAt: null, snoozeUntil: now + 1 }), false);
  assert.ok(kitReminderText('unconfirmed'));
  assert.ok(kitReminderText('legacy'));
  assert.equal(kitReminderText('confirmed'), null);
  const { kit } = setup();
  await snoozeKitReminderOn(kit, now + 5);
  assert.equal((await readKitReminderInputOn(kit)).snoozeUntil, now + 5);
});
