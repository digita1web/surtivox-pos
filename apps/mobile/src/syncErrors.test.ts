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

test('el tope diario de la nube tiene su propio mensaje, distinto del de demasiados intentos', async () => {
  const { syncErrorMessage, QUOTA_MESSAGE, toSyncHttpError } = await import('./syncErrors.ts');
  assert.equal(syncErrorMessage('quota_exceeded', 429, 3600), QUOTA_MESSAGE);
  assert.match(syncErrorMessage(null, 429, 120), /Demasiados intentos/);
  assert.equal(toSyncHttpError({ error: 'quota_exceeded' }, 429, '600').message, QUOTA_MESSAGE);
});

test('si se llena la nube de todas las tiendas, el mensaje no culpa a la tienda y sigue diciendo que sus datos están a salvo', async () => {
  const { syncErrorMessage, QUOTA_MESSAGE, CLOUD_QUOTA_MESSAGE, toSyncHttpError } = await import('./syncErrors.ts');
  assert.notEqual(CLOUD_QUOTA_MESSAGE, QUOTA_MESSAGE);
  assert.doesNotMatch(CLOUD_QUOTA_MESSAGE, /Tu tienda llegó/);
  assert.match(CLOUD_QUOTA_MESSAGE, /siguen guardados en este teléfono/);
  assert.equal(syncErrorMessage('quota_exceeded', 429, 3600, 'cloud'), CLOUD_QUOTA_MESSAGE);
  assert.equal(syncErrorMessage('quota_exceeded', 429, 3600, 'store'), QUOTA_MESSAGE);
  assert.equal(toSyncHttpError({ error: 'quota_exceeded', scope: 'cloud' }, 429, '600').message, CLOUD_QUOTA_MESSAGE);
  assert.equal(toSyncHttpError({ error: 'quota_exceeded', scope: 'store', limit: 10, used: 9 }, 429, '600').message, QUOTA_MESSAGE);
  assert.equal(toSyncHttpError({ error: 'quota_exceeded', scope: 'otra' }, 429, '600').message, QUOTA_MESSAGE);
});

