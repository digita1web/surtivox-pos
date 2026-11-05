import type { SQLiteDatabase } from 'expo-sqlite';
import type { Role } from './roles.ts';
import {
  CLEAN_GUARD, attemptsLeft, parseGuard, registerFailure, remainingLockMs, validatePin, validateStaffName,
  type PinGuard,
} from './staffRules.ts';

export type StaffDb = Pick<SQLiteDatabase, 'getFirstAsync' | 'getAllAsync' | 'runAsync' | 'withTransactionAsync'>;

export interface StaffDeps {
  newId: () => string;
  deviceId: string;
  salt: () => string;
  hash: (pin: string, salt: string) => string;
  verify: (pin: string, salt: string, hash: string) => boolean;
}

export interface StaffSummary {
  id: string;
  name: string;
  role: Role;
  created_at: number;
}

export type PinAttempt =
  | { status: 'ok'; staff: StaffSummary }
  | { status: 'wrong'; attemptsLeft: number }
  | { status: 'locked'; retryAt: number }
  | { status: 'unknown' };

const ACTIVE = 'active=1 AND deleted_at IS NULL';
const guardKey = (id: string) => `pin_guard:${id}`;

async function otherNames(db: StaffDb, storeId: string, exceptId: string | null): Promise<string[]> {
  const rows = await db.getAllAsync<{ id: string; name: string }>(
    `SELECT id, name FROM staff WHERE store_id=? AND ${ACTIVE}`, [storeId],
  );
  return rows.filter((row) => row.id !== exceptId).map((row) => row.name);
}

async function activeOwners(db: StaffDb, storeId: string): Promise<number> {
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM staff WHERE store_id=? AND role='owner' AND ${ACTIVE}`, [storeId],
  );
  return row?.c ?? 0;
}

export async function createStaffOn(
  db: StaffDb,
  deps: StaffDeps,
  input: { storeId: string; name: string; role: Role; pin: string },
): Promise<string> {
  const id = deps.newId();
  await db.withTransactionAsync(async () => {
    const nameError = validateStaffName(input.name, await otherNames(db, input.storeId, null));
    if (nameError) throw new Error(nameError);
    const pinError = validatePin(input.pin, input.pin);
    if (pinError) throw new Error(pinError);
    const existing = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) AS c FROM staff WHERE store_id=? AND ${ACTIVE}`, [input.storeId]);
    if ((existing?.c ?? 0) === 0 && input.role !== 'owner') throw new Error('La primera cuenta debe ser del propietario');
    const now = Date.now();
    const salt = deps.salt();
    await db.runAsync(
      `INSERT INTO staff (id,store_id,name,role,pin_salt,pin_hash,active,created_at,updated_at,device_id,version)
       VALUES (?,?,?,?,?,?,1,?,?,?,1)`,
      [id, input.storeId, input.name.replace(/\s+/g, ' ').trim(), input.role, salt, deps.hash(input.pin, salt), now, now, deps.deviceId],
    );
  });
  return id;
}

export async function updateStaffOn(
  db: StaffDb,
  deps: StaffDeps,
  input: { id: string; name: string; role: Role; pin?: string },
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const target = await db.getFirstAsync<{ store_id: string; role: Role }>(
      `SELECT store_id, role FROM staff WHERE id=? AND ${ACTIVE}`, [input.id],
    );
    if (!target) throw new Error('No se encontró a la persona');
    const nameError = validateStaffName(input.name, await otherNames(db, target.store_id, input.id));
    if (nameError) throw new Error(nameError);
    if (target.role === 'owner' && input.role !== 'owner' && (await activeOwners(db, target.store_id)) <= 1) {
      throw new Error('Debe quedar al menos un propietario');
    }
    const now = Date.now();
    const name = input.name.replace(/\s+/g, ' ').trim();
    if (input.pin) {
      const pinError = validatePin(input.pin, input.pin);
      if (pinError) throw new Error(pinError);
      const salt = deps.salt();
      await db.runAsync(
        `UPDATE staff SET name=?, role=?, pin_salt=?, pin_hash=?, updated_at=?, version=version+1 WHERE id=?`,
        [name, input.role, salt, deps.hash(input.pin, salt), now, input.id],
      );
      await db.runAsync('DELETE FROM local_settings WHERE key=?', [guardKey(input.id)]);
    } else {
      await db.runAsync(
        `UPDATE staff SET name=?, role=?, updated_at=?, version=version+1 WHERE id=?`,
        [name, input.role, now, input.id],
      );
    }
  });
}

export async function deleteStaffOn(
  db: StaffDb,
  storeId: string,
  id: string,
  actingId: string | null,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    if (actingId !== null && actingId === id) throw new Error('No puedes quitar tu propia cuenta');
    const target = await db.getFirstAsync<{ role: Role }>(`SELECT role FROM staff WHERE id=? AND store_id=? AND ${ACTIVE}`, [id, storeId]);
    if (!target) throw new Error('No se encontró a la persona');
    if (target.role === 'owner' && (await activeOwners(db, storeId)) <= 1) throw new Error('No se puede quitar al último propietario');
    const now = Date.now();
    await db.runAsync(`UPDATE staff SET active=0, deleted_at=?, updated_at=?, version=version+1 WHERE id=?`, [now, now, id]);
    await db.runAsync('DELETE FROM local_settings WHERE key=?', [guardKey(id)]);
  });
}

async function readGuard(db: StaffDb, id: string): Promise<PinGuard> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM local_settings WHERE key=?', [guardKey(id)]);
  return parseGuard(row?.value ?? null);
}

async function writeGuard(db: StaffDb, id: string, guard: PinGuard): Promise<void> {
  await db.runAsync(
    `INSERT INTO local_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    [guardKey(id), JSON.stringify(guard)],
  );
}

export async function lockRetryAtOn(db: StaffDb, id: string, now: number): Promise<number | null> {
  const guard = await readGuard(db, id);
  return remainingLockMs(guard, now) > 0 ? guard.lockedUntil : null;
}

export async function attemptPinOn(db: StaffDb, deps: StaffDeps, id: string, pin: string, now: number): Promise<PinAttempt> {
  const guard = await readGuard(db, id);
  const wait = remainingLockMs(guard, now);
  if (wait > 0) return { status: 'locked', retryAt: guard.lockedUntil };
  const row = await db.getFirstAsync<{ id: string; name: string; role: Role; created_at: number; pin_salt: string; pin_hash: string }>(
    `SELECT id, name, role, created_at, pin_salt, pin_hash FROM staff WHERE id=? AND ${ACTIVE}`, [id],
  );
  if (!row) return { status: 'unknown' };
  if (deps.verify(pin, row.pin_salt, row.pin_hash)) {
    if (guard.failures > 0 || guard.lockedUntil > 0) await db.runAsync('DELETE FROM local_settings WHERE key=?', [guardKey(id)]);
    return { status: 'ok', staff: { id: row.id, name: row.name, role: row.role, created_at: row.created_at } };
  }
  const next = registerFailure(guard.failures === 0 ? CLEAN_GUARD : guard, now);
  await writeGuard(db, id, next);
  if (next.lockedUntil > now) return { status: 'locked', retryAt: next.lockedUntil };
  return { status: 'wrong', attemptsLeft: attemptsLeft(next, now) };
}
