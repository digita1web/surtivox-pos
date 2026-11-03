import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '@surtivox/database';
import { disconnectOn, reusableToken } from './syncState.ts';

function connected(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const migration of MIGRATIONS) db.exec(migration.sql);
  db.prepare('UPDATE sync_state SET server_url=?, token=?, last_pushed_at=5, last_pulled_at=6, last_synced_at=7 WHERE id=1')
    .run('https://sync.test', 'ABCDEFGHJKLMNPQR');
  return db;
}

test('disconnect stops syncing but keeps the shop token so the store can be re-enabled', async () => {
  const db = connected();
  await disconnectOn({ runAsync: async (sql: string, params: (string | number | null)[] = []) => { db.prepare(sql).run(...params); return {}; } } as never);
  const row = db.prepare('SELECT * FROM sync_state WHERE id=1').get() as Record<string, unknown>;
  assert.equal(row.server_url, null);
  assert.equal(row.token, 'ABCDEFGHJKLMNPQR');
  assert.equal(row.last_pushed_at, 0);
  assert.equal(row.last_pulled_at, 0);
  assert.equal(row.last_synced_at, null);
});

test('re-enabling reuses the saved token and only generates one when none exists', () => {
  let calls = 0;
  const generate = () => { calls++; return 'NUEVO'; };
  assert.equal(reusableToken('ABCDEFGHJKLMNPQR', generate), 'ABCDEFGHJKLMNPQR');
  assert.equal(calls, 0);
  assert.equal(reusableToken(null, generate), 'NUEVO');
  assert.equal(reusableToken('  ', generate), 'NUEVO');
  assert.equal(calls, 2);
});
