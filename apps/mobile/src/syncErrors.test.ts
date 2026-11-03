import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncErrorMessage } from './syncErrors.ts';

test('known server errors are shown in Spanish and unknown ones never leak raw text', () => {
  assert.match(syncErrorMessage('store_already_claimed', 403), /ya está vinculada/);
  assert.match(syncErrorMessage('unauthorized', 401), /no es válido/);
  assert.equal(syncErrorMessage('SQLITE_ERROR: no such table', 500), 'Error de sincronización (500)');
  assert.equal(syncErrorMessage(undefined, 502), 'Error de sincronización (502)');
  assert.equal(syncErrorMessage('toString', 500), 'Error de sincronización (500)');
});
