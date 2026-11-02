import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pendingMigrationIds } from './migrationPlan.ts';

test('returns pending migrations in code order', () => {
  assert.deepEqual(
    pendingMigrationIds(['0000_init', '0001_customers', '0002_returns'], ['0000_init']),
    ['0001_customers', '0002_returns'],
  );
});

test('returns no pending migrations when all are applied', () => {
  assert.deepEqual(pendingMigrationIds(['0000_init', '0001_customers'], ['0001_customers', '0000_init']), []);
});

test('handles an empty migration ledger', () => {
  assert.deepEqual(pendingMigrationIds(['0000_init', '0001_customers'], []), ['0000_init', '0001_customers']);
});
