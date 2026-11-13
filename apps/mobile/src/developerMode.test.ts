import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '@surtivox/database';
import { DEVELOPER_MODE_KEY, isDeveloperMode, writeDeveloperMode } from './developerMode.ts';

function settings(): { read: () => string | null; write: (key: string, value: string) => Promise<void> } {
  const db = new DatabaseSync(':memory:');
  for (const migration of MIGRATIONS) db.exec(migration.sql);
  return {
    read: () => (db.prepare('SELECT value FROM local_settings WHERE key=?').get(DEVELOPER_MODE_KEY) as { value: string } | undefined)?.value ?? null,
    write: async (key, value) => {
      db.prepare('INSERT INTO local_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);
    },
  };
}

test('only the stored value 1 means developer mode is on', () => {
  assert.equal(isDeveloperMode('1'), true);
  assert.equal(isDeveloperMode('0'), false);
  assert.equal(isDeveloperMode(null), false);
  assert.equal(isDeveloperMode(''), false);
  assert.equal(isDeveloperMode('true'), false);
});

test('developer mode can be turned on and then off again and the screens read it back', async () => {
  const store = settings();
  assert.equal(isDeveloperMode(store.read()), false);
  await writeDeveloperMode(store.write, true);
  assert.equal(isDeveloperMode(store.read()), true);
  await writeDeveloperMode(store.write, false);
  assert.equal(isDeveloperMode(store.read()), false);
});

test('a failed write is reported to the caller instead of pretending the mode changed', async () => {
  const failing = async () => { throw new Error('disco lleno'); };
  await assert.rejects(() => writeDeveloperMode(failing, false), /disco lleno/);
});
