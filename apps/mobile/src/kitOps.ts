import type { SQLiteDatabase } from 'expo-sqlite';
import {
  KIT_ENTROPY_BYTES, confirmationMatches, deriveShopToken, entropyToWords, generateKitEntropy, parseKitText, type Sha256,
} from '@surtivox/pos-core';
import { CLEAN_GUARD, parseGuard, registerFailure, remainingLockMs } from './staffRules.ts';

export type KitDb = Pick<SQLiteDatabase, 'getFirstAsync' | 'runAsync' | 'withTransactionAsync'>;

export interface KitDeps {
  randomBytes: (length: number) => Uint8Array;
  sha256: Sha256;
  now: () => number;
  request: (path: string, token: string, body: unknown) => Promise<unknown>;
  isDefinitiveRefusal: (error: unknown) => boolean;
}

export const KIT_KEYS = {
  entropy: 'kit_entropy_v1',
  createdAt: 'kit_created_at',
  confirmedAt: 'kit_confirmed_at',
  version: 'kit_key_version',
  pending: 'kit_pending_entropy',
  guard: 'kit_recover_guard',
  snoozeUntil: 'kit_remind_snooze_until',
} as const;

const KIT_SETTING_KEYS: ReadonlySet<string> = new Set(Object.values(KIT_KEYS));
export const KIT_REMIND_AFTER_MS = 3 * 24 * 3_600_000;
const HEX_TOKEN = /^[0-9a-f]{64}$/;

export function isKitSettingKey(key: string): boolean {
  return KIT_SETTING_KEYS.has(key);
}

export function isKitToken(token: string | null): boolean {
  return token !== null && HEX_TOKEN.test(token);
}

function entropyToHex(entropy: Uint8Array): string {
  return Array.from(entropy, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToEntropy(hex: string | null): Uint8Array | null {
  if (!hex || !new RegExp(`^[0-9a-f]{${KIT_ENTROPY_BYTES * 2}}$`).test(hex)) return null;
  const out = new Uint8Array(KIT_ENTROPY_BYTES);
  for (let i = 0; i < KIT_ENTROPY_BYTES; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function read(db: KitDb, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM local_settings WHERE key=?', [key]);
  return row?.value ?? null;
}

async function write(db: KitDb, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO local_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    [key, value],
  );
}

async function remove(db: KitDb, key: string): Promise<void> {
  await db.runAsync('DELETE FROM local_settings WHERE key=?', [key]);
}

interface SyncRow { server_url: string | null; token: string | null }

async function readSync(db: KitDb): Promise<SyncRow> {
  return (await db.getFirstAsync<SyncRow>('SELECT server_url, token FROM sync_state WHERE id = 1')) ?? { server_url: null, token: null };
}

async function storeKit(db: KitDb, entropy: Uint8Array, token: string, serverUrl: string | null, now: number, confirmed: boolean): Promise<void> {
  const version = Number((await read(db, KIT_KEYS.version)) ?? '0') || 0;
  await db.withTransactionAsync(async () => {
    if (serverUrl !== null) {
      await db.runAsync('UPDATE sync_state SET server_url = ?, token = ? WHERE id = 1', [serverUrl, token]);
    } else {
      await db.runAsync('UPDATE sync_state SET token = ? WHERE id = 1', [token]);
    }
    await write(db, KIT_KEYS.entropy, entropyToHex(entropy));
    await write(db, KIT_KEYS.createdAt, String(now));
    await write(db, KIT_KEYS.version, String(version + 1));
    if (confirmed) await write(db, KIT_KEYS.confirmedAt, String(now));
    else await remove(db, KIT_KEYS.confirmedAt);
    await remove(db, KIT_KEYS.pending);
    await remove(db, KIT_KEYS.snoozeUntil);
  });
}

export async function startKitOn(db: KitDb, deps: KitDeps, serverUrl: string): Promise<string[]> {
  const entropy = generateKitEntropy(deps.randomBytes);
  const token = await deriveShopToken(entropy, deps.sha256);
  await storeKit(db, entropy, token, serverUrl, deps.now(), false);
  return entropyToWords(entropy, deps.sha256);
}

export interface KitInfo { words: string[]; createdAt: number; confirmedAt: number | null; version: number }

export async function loadKitOn(db: KitDb, deps: Pick<KitDeps, 'sha256'>): Promise<KitInfo | null> {
  const entropy = hexToEntropy(await read(db, KIT_KEYS.entropy));
  if (!entropy) return null;
  const confirmed = Number(await read(db, KIT_KEYS.confirmedAt));
  return {
    words: await entropyToWords(entropy, deps.sha256),
    createdAt: Number(await read(db, KIT_KEYS.createdAt)) || 0,
    confirmedAt: Number.isFinite(confirmed) && confirmed > 0 ? confirmed : null,
    version: Number(await read(db, KIT_KEYS.version)) || 1,
  };
}

export async function confirmKitOn(
  db: KitDb,
  deps: Pick<KitDeps, 'sha256' | 'now'>,
  positions: readonly number[],
  typed: readonly string[],
): Promise<boolean> {
  const kit = await loadKitOn(db, deps);
  if (!kit || !confirmationMatches(kit.words, positions, typed)) return false;
  await write(db, KIT_KEYS.confirmedAt, String(deps.now()));
  return true;
}

export type RotationResult =
  | { status: 'ok'; words: string[] }
  | { status: 'not-connected' }
  | { status: 'unknown'; message: string };

export async function rotateKitOn(db: KitDb, deps: KitDeps): Promise<RotationResult> {
  const sync = await readSync(db);
  if (!sync.token || !sync.server_url) return { status: 'not-connected' };
  const pending = hexToEntropy(await read(db, KIT_KEYS.pending));
  const entropy = pending ?? generateKitEntropy(deps.randomBytes);
  if (!pending) await write(db, KIT_KEYS.pending, entropyToHex(entropy));
  const newToken = await deriveShopToken(entropy, deps.sha256);
  try {
    await deps.request('/sync/rotate', sync.token, { newToken });
  } catch (error) {
    if (deps.isDefinitiveRefusal(error)) await remove(db, KIT_KEYS.pending);
    throw error;
  }
  await storeKit(db, entropy, newToken, null, deps.now(), false);
  return { status: 'ok', words: await entropyToWords(entropy, deps.sha256) };
}

export async function hasPendingRotationOn(db: KitDb): Promise<boolean> {
  return (await read(db, KIT_KEYS.pending)) !== null;
}

export async function adoptRecoveredKitOn(
  db: KitDb,
  deps: Pick<KitDeps, 'sha256' | 'now'>,
  entropy: Uint8Array,
  serverUrl: string,
): Promise<void> {
  const token = await deriveShopToken(entropy, deps.sha256);
  await storeKit(db, entropy, token, serverUrl, deps.now(), true);
}

export type KitStatus = 'none' | 'legacy' | 'unconfirmed' | 'confirmed';

export async function kitStatusOn(db: KitDb): Promise<KitStatus> {
  const sync = await readSync(db);
  if (!sync.token || !sync.server_url) return 'none';
  if (!isKitToken(sync.token)) return 'legacy';
  return (await read(db, KIT_KEYS.confirmedAt)) ? 'confirmed' : 'unconfirmed';
}

export function shouldRemindKit(input: { now: number; status: KitStatus; createdAt: number | null; snoozeUntil: number | null }): boolean {
  const { now, status, createdAt, snoozeUntil } = input;
  if (snoozeUntil !== null && now <= snoozeUntil) return false;
  if (status === 'legacy') return true;
  if (status !== 'unconfirmed' || createdAt === null) return false;
  return now - createdAt >= KIT_REMIND_AFTER_MS;
}

export function kitReminderText(status: KitStatus): { title: string; body: string } | null {
  if (status === 'unconfirmed') {
    return { title: 'Confirma tu kit de recuperación', body: 'Aún no comprobaste que lo guardaste. Sin el kit no podrás recuperar tu tienda en otro teléfono.' };
  }
  if (status === 'legacy') {
    return { title: 'Crea tu kit de recuperación', body: 'Cambia tu código largo por 8 palabras fáciles de guardar.' };
  }
  return null;
}

export async function snoozeKitReminderOn(db: KitDb, until: number): Promise<void> {
  await write(db, KIT_KEYS.snoozeUntil, String(until));
}

export async function readKitReminderInputOn(db: KitDb): Promise<{ status: KitStatus; createdAt: number | null; snoozeUntil: number | null }> {
  const createdAt = Number(await read(db, KIT_KEYS.createdAt));
  const snooze = Number(await read(db, KIT_KEYS.snoozeUntil));
  return {
    status: await kitStatusOn(db),
    createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : null,
    snoozeUntil: Number.isFinite(snooze) && snooze > 0 ? snooze : null,
  };
}

export type RecoveryAttempt = { allowed: true } | { allowed: false; retryAt: number };

export async function checkRecoveryGuardOn(db: KitDb, now: number): Promise<RecoveryAttempt> {
  const guard = parseGuard(await read(db, KIT_KEYS.guard));
  const wait = remainingLockMs(guard, now);
  return wait > 0 ? { allowed: false, retryAt: now + wait } : { allowed: true };
}

export async function recordRecoveryFailureOn(db: KitDb, now: number): Promise<void> {
  const guard = parseGuard(await read(db, KIT_KEYS.guard));
  await write(db, KIT_KEYS.guard, JSON.stringify(registerFailure(guard, now)));
}

export async function clearRecoveryGuardOn(db: KitDb): Promise<void> {
  await write(db, KIT_KEYS.guard, JSON.stringify(CLEAN_GUARD));
}

export type ParsedKit = { ok: true; entropy: Uint8Array; token: string } | { ok: false; message: string };

export async function parseKitForRecovery(text: string, deps: Pick<KitDeps, 'sha256'>): Promise<ParsedKit> {
  const parsed = await parseKitText(text, deps.sha256);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  return { ok: true, entropy: parsed.entropy, token: await deriveShopToken(parsed.entropy, deps.sha256) };
}

export type RecoverResult =
  | { status: 'ok'; restored: number }
  | { status: 'locked'; retryAt: number }
  | { status: 'invalid'; message: string };

export async function recoverFromKitOn(
  db: KitDb,
  deps: Pick<KitDeps, 'sha256' | 'now'> & { isAuthFailure: (error: unknown) => boolean; serverUrl: string },
  text: string,
  restore: (token: string) => Promise<number>,
): Promise<RecoverResult> {
  const guard = await checkRecoveryGuardOn(db, deps.now());
  if (!guard.allowed) return { status: 'locked', retryAt: guard.retryAt };
  const parsed = await parseKitForRecovery(text, deps);
  if (!parsed.ok) return { status: 'invalid', message: parsed.message };
  let restored: number;
  try {
    restored = await restore(parsed.token);
  } catch (error) {
    if (deps.isAuthFailure(error)) await recordRecoveryFailureOn(db, deps.now());
    throw error;
  }
  await adoptRecoveredKitOn(db, deps, parsed.entropy, deps.serverUrl);
  await clearRecoveryGuardOn(db);
  return { status: 'ok', restored };
}
