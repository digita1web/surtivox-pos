import type { SQLiteDatabase } from 'expo-sqlite';
import {
  CLEAN_GUARD, attemptsLeft, parseGuard, registerFailure, remainingLockMs, validatePin, type PinGuard,
} from './staffRules.ts';
import { formatRecoveryCode, isWellFormedRecoveryCode, normalizeRecoveryCode, recoveryCodeFromBytes, RECOVERY_LENGTH } from './recoveryCode.ts';

export type RecoveryDb = Pick<SQLiteDatabase, 'getFirstAsync' | 'runAsync' | 'withTransactionAsync'>;

export interface RecoveryDeps {
  randomBytes: (length: number) => Uint8Array;
  digest: (text: string) => Promise<string>;
  salt: () => string;
  hashPin: (pin: string, salt: string) => string;
}

export type RecoveryResult =
  | { status: 'ok'; newCode: string }
  | { status: 'wrong'; attemptsLeft: number }
  | { status: 'locked'; retryAt: number }
  | { status: 'missing' }
  | { status: 'bad-format' }
  | { status: 'bad-pin'; message: string }
  | { status: 'no-owner' };

const keys = (storeId: string) => ({
  hash: `recovery_hash:${storeId}`,
  salt: `recovery_salt:${storeId}`,
  guard: `recovery_guard:${storeId}`,
});

async function read(db: RecoveryDb, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM local_settings WHERE key=?', [key]);
  return row?.value ?? null;
}

async function write(db: RecoveryDb, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO local_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    [key, value],
  );
}

async function storeCode(db: RecoveryDb, deps: RecoveryDeps, storeId: string): Promise<string> {
  const code = recoveryCodeFromBytes(deps.randomBytes(RECOVERY_LENGTH));
  const salt = deps.salt();
  const hash = await deps.digest(`${salt}:${code}`);
  const k = keys(storeId);
  await write(db, k.salt, salt);
  await write(db, k.hash, hash);
  return formatRecoveryCode(code);
}

export async function setupRecoveryOn(db: RecoveryDb, deps: RecoveryDeps, storeId: string): Promise<string> {
  const formatted = await storeCode(db, deps, storeId);
  await db.runAsync('DELETE FROM local_settings WHERE key=?', [keys(storeId).guard]);
  return formatted;
}

export async function hasRecoveryOn(db: RecoveryDb, storeId: string): Promise<boolean> {
  return (await read(db, keys(storeId).hash)) !== null;
}

export async function resetPinWithRecoveryOn(
  db: RecoveryDb,
  deps: RecoveryDeps,
  input: { storeId: string; ownerId: string; code: string; newPin: string; now: number },
): Promise<RecoveryResult> {
  const k = keys(input.storeId);
  const [storedHash, storedSalt] = await Promise.all([read(db, k.hash), read(db, k.salt)]);
  if (!storedHash || !storedSalt) return { status: 'missing' };

  const guard: PinGuard = parseGuard(await read(db, k.guard));
  if (remainingLockMs(guard, input.now) > 0) return { status: 'locked', retryAt: guard.lockedUntil };

  const code = normalizeRecoveryCode(input.code);
  if (!isWellFormedRecoveryCode(code)) return { status: 'bad-format' };

  if ((await deps.digest(`${storedSalt}:${code}`)) !== storedHash) {
    const next = registerFailure(guard.failures === 0 ? CLEAN_GUARD : guard, input.now);
    await write(db, k.guard, JSON.stringify(next));
    if (next.lockedUntil > input.now) return { status: 'locked', retryAt: next.lockedUntil };
    return { status: 'wrong', attemptsLeft: attemptsLeft(next, input.now) };
  }

  const pinError = validatePin(input.newPin, input.newPin);
  if (pinError) return { status: 'bad-pin', message: pinError };

  const owner = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM staff WHERE id=? AND store_id=? AND role='owner' AND active=1 AND deleted_at IS NULL`,
    [input.ownerId, input.storeId],
  );
  if (!owner) return { status: 'no-owner' };

  let newCode = '';
  await db.withTransactionAsync(async () => {
    const pinSalt = deps.salt();
    const now = Date.now();
    await db.runAsync(
      'UPDATE staff SET pin_salt=?, pin_hash=?, updated_at=?, version=version+1 WHERE id=?',
      [pinSalt, deps.hashPin(input.newPin, pinSalt), now, input.ownerId],
    );
    await db.runAsync('DELETE FROM local_settings WHERE key=?', [`pin_guard:${input.ownerId}`]);
    await db.runAsync('DELETE FROM local_settings WHERE key=?', [k.guard]);
    newCode = await storeCode(db, deps, input.storeId);
  });
  return { status: 'ok', newCode };
}
