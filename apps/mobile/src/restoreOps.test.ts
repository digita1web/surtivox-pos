import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '@surtivox/database';
import { applyBackupOn, type RestoreDb } from './restoreOps.ts';

type Param = string | number | null;

function adapter(db: DatabaseSync): RestoreDb {
  return {
    execAsync: async (sql: string) => { db.exec(sql); },
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
  } as unknown as RestoreDb;
}

function syncedDevice(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const migration of MIGRATIONS) db.exec(migration.sql);
  db.prepare('INSERT INTO stores (id,name,currency_code,currency_locale,currency_decimals,created_at,updated_at,device_id) VALUES (?,?,?,?,?,?,?,?)')
    .run('s1', 'Tienda actual', 'COP', 'es-CO', 0, 2000, 2000, 'd1');
  db.prepare('UPDATE sync_state SET server_url=?, token=?, last_pushed_at=9000, last_pulled_at=9500, last_synced_at=9600 WHERE id=1')
    .run('https://sync.test', 'ABCDEFGHJKLMNPQR');
  return db;
}

function oldBackup(): Record<string, Record<string, unknown>[]> {
  return {
    stores: [{
      id: 's1', name: 'Tienda del respaldo', currency_code: 'COP', currency_locale: 'es-CO',
      currency_decimals: 0, created_at: 1000, updated_at: 1000, device_id: 'd1',
    }],
  };
}

function cursors(db: DatabaseSync): Record<string, unknown> {
  return { ...(db.prepare('SELECT * FROM sync_state WHERE id=1').get() as Record<string, unknown>) };
}

test('restoring an older backup resets the sync cursors so the restored rows are pushed and newer cloud rows are pulled', async () => {
  const db = syncedDevice();
  const rows = await applyBackupOn(adapter(db), oldBackup());
  assert.equal(rows, 1);
  assert.equal((db.prepare('SELECT name FROM stores WHERE id=?').get('s1') as { name: string }).name, 'Tienda del respaldo');
  const state = cursors(db);
  assert.equal(state.last_pushed_at, 0);
  assert.equal(state.last_pulled_at, 0);
  assert.equal(state.last_synced_at, null);
});

test('restoring keeps the cloud connection so the device does not silently stop syncing', async () => {
  const db = syncedDevice();
  await applyBackupOn(adapter(db), oldBackup());
  const state = cursors(db);
  assert.equal(state.server_url, 'https://sync.test');
  assert.equal(state.token, 'ABCDEFGHJKLMNPQR');
});

test('restoring on a device that never synced leaves the cursors at zero', async () => {
  const db = syncedDevice();
  db.prepare('UPDATE sync_state SET server_url=NULL, token=NULL, last_pushed_at=0, last_pulled_at=0, last_synced_at=NULL WHERE id=1').run();
  await applyBackupOn(adapter(db), oldBackup());
  const state = cursors(db);
  assert.equal(state.last_pushed_at, 0);
  assert.equal(state.last_pulled_at, 0);
  assert.equal(state.server_url, null);
});

test('a failed restore changes neither the data nor the cursors and turns foreign keys back on', async () => {
  const db = syncedDevice();
  const broken = {
    ...oldBackup(),
    products: [{ id: 'p1', columna_que_no_existe: 1 }],
  };
  await assert.rejects(() => applyBackupOn(adapter(db), broken));
  assert.equal((db.prepare('SELECT name FROM stores WHERE id=?').get('s1') as { name: string }).name, 'Tienda actual');
  const state = cursors(db);
  assert.equal(state.last_pushed_at, 9000);
  assert.equal(state.last_pulled_at, 9500);
  assert.equal(state.last_synced_at, 9600);
  assert.equal((db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }).foreign_keys, 1);
});

test('restoring keeps the recovery kit keys and replaces the other local settings', async () => {
  const db = syncedDevice();
  const insert = db.prepare('INSERT INTO local_settings (key,value) VALUES (?,?)');
  insert.run('kit_entropy_v1', 'secreto');
  insert.run('last_backup_at', 'viejo');
  const withSettings = {
    ...oldBackup(),
    local_settings: [{ key: 'last_backup_at', value: 'del-respaldo' }, { key: 'kit_entropy_v1', value: 'ajeno' }],
  };
  await applyBackupOn(adapter(db), withSettings);
  const read = (key: string) => (db.prepare('SELECT value FROM local_settings WHERE key=?').get(key) as { value: string } | undefined)?.value;
  assert.equal(read('kit_entropy_v1'), 'secreto');
  assert.equal(read('last_backup_at'), 'del-respaldo');
});
