import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { MIGRATIONS, runMigrations, type SqlExecutor } from '@surtivox/database';
import { truncateErrorMessage } from './diagnostics';
import { pendingMigrationIds } from './migrationPlan';

let _db: SQLite.SQLiteDatabase | null = null;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DatabaseHealth {
  status: 'ok' | 'corrupt' | 'unknown';
  message: string | null;
}

let _health: DatabaseHealth = { status: 'unknown', message: null };

export function getDatabaseHealth(): DatabaseHealth {
  return _health;
}

async function saveLocalValue(db: SQLite.SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    `INSERT INTO local_settings (key,value) VALUES (?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    [key, value],
  );
}

async function readLocalValue(db: SQLite.SQLiteDatabase, key: string): Promise<string | null> {
  try {
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM local_settings WHERE key=?', [key]);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function recordStartupError(db: SQLite.SQLiteDatabase, message: string): Promise<void> {
  try {
    await saveLocalValue(db, 'last_error', JSON.stringify({ at: Date.now(), message: truncateErrorMessage(message) }));
  } catch {}
}

async function copyBeforeMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  let applied: { id: string }[];
  try {
    applied = await db.getAllAsync<{ id: string }>('SELECT id FROM _migrations ORDER BY id');
  } catch {
    return;
  }
  const pending = pendingMigrationIds(MIGRATIONS.map((migration) => migration.id), applied.map((row) => row.id));
  if (pending.length === 0) return;
  let stores: { count: number } | null = null;
  try {
    stores = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM stores');
  } catch {}
  if (!stores || stores.count === 0) return;
  const base = FileSystem.documentDirectory;
  if (!base) throw new Error('El almacenamiento interno no está disponible.');
  const directory = `${base}safety/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
  const lastApplied = applied[applied.length - 1]?.id ?? 'none';
  const filename = `pre-migracion-${lastApplied}-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
  await FileSystem.copyAsync({ from: db.databasePath, to: `${directory}${filename}` });
  const files = (await FileSystem.readDirectoryAsync(directory))
    .filter((name) => name.startsWith('pre-migracion-'))
    .sort()
    .reverse();
  for (const old of files.slice(2)) {
    await FileSystem.deleteAsync(`${directory}${old}`, { idempotent: true });
  }
}

async function checkIntegrity(db: SQLite.SQLiteDatabase): Promise<void> {
  const lastRaw = await readLocalValue(db, 'last_integrity_check_at');
  const statusRaw = await readLocalValue(db, 'last_integrity_status');
  const last = lastRaw === null ? null : Number(lastRaw);
  if (last !== null && Number.isFinite(last) && Date.now() - last < DAY_MS && statusRaw) {
    _health = statusRaw === 'ok' ? { status: 'ok', message: null } : { status: 'corrupt', message: statusRaw };
    return;
  }
  try {
    const row = await db.getFirstAsync<Record<string, string>>('PRAGMA quick_check(1)');
    const value = row ? Object.values(row)[0] : null;
    if (value === 'ok') {
      _health = { status: 'ok', message: null };
    } else {
      _health = { status: 'corrupt', message: value ?? 'quick_check no devolvió un resultado válido.' };
    }
  } catch (error) {
    _health = { status: 'corrupt', message: truncateErrorMessage(error) };
  }
  try {
    await saveLocalValue(db, 'last_integrity_check_at', String(Date.now()));
    await saveLocalValue(db, 'last_integrity_status', _health.status === 'ok' ? 'ok' : _health.message ?? 'corrupt');
  } catch {}
}


/** Open the on-device database and run pending migrations. Call once at boot. */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  const db = await SQLite.openDatabaseAsync('surtivox.db');
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  try {
    await copyBeforeMigrations(db);
  } catch (error) {
    await recordStartupError(db, `No se pudo crear la copia previa a migraciones: ${truncateErrorMessage(error)}`);
  }
  const exec: SqlExecutor = {
    exec: async (sql) => {
      await db.execAsync(sql);
    },
    select: async <T>(sql: string) => (await db.getAllAsync<any>(sql)) as T[],
  };
  await runMigrations(exec, MIGRATIONS);
  await checkIntegrity(db);
  _db = db;
  return db;
}

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) throw new Error('Database not initialized — call initDatabase() first');
  return _db;
}
