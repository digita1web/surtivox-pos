import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkReleaseTag } from './releaseTag.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('una etiqueta igual a la versión de app.json con versionCode válido se acepta', () => {
  assert.deepEqual(checkReleaseTag('v1.1.5', '1.1.5', 11), { ok: true });
});

test('una etiqueta distinta de la versión se rechaza para que la página y la app no digan versiones diferentes', () => {
  const result = checkReleaseTag('v1.1.5', '1.1.4', 10);
  assert.equal(result.ok, false);
  assert.match((result as { reason: string }).reason, /no coincide/);
});

test('solo se aceptan etiquetas vX.Y.Z, sin prefijos ni sufijos que la comprobación de actualizaciones no entiende', () => {
  for (const tag of ['1.1.4', 'v1.1', 'v1.1.4-rc1', 'V1.1.4', 'v1.1.4 ', '', 'v01.1.4x']) {
    assert.equal(checkReleaseTag(tag, '1.1.4', 10).ok, false, JSON.stringify(tag));
  }
});

test('una versión o un versionCode inválidos en app.json se rechazan', () => {
  assert.equal(checkReleaseTag('v1.1.4', undefined, 10).ok, false);
  assert.equal(checkReleaseTag('v1.1.4', '1.1', 10).ok, false);
  for (const code of [undefined, null, 0, -1, 1.5, '10', Number.NaN]) {
    assert.equal(checkReleaseTag('v1.1.4', '1.1.4', code).ok, false, String(code));
  }
});

test('el app.json actual pasa la comprobación con su propia etiqueta', () => {
  const config = JSON.parse(read('../app.json')) as { expo: { version: string; android: { versionCode: number } } };
  assert.deepEqual(checkReleaseTag(`v${config.expo.version}`, config.expo.version, config.expo.android.versionCode), { ok: true });
});
