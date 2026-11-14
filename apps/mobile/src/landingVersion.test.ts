import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = JSON.parse(read('../app.json')) as { expo: { version: string; android: { versionCode: number } } };
const html = read('../../../landing/index.html');

test('la versión que declara la landing para buscadores coincide con la de app.json', () => {
  const declared = html.match(/"softwareVersion": "([^"]+)"/)?.[1];
  assert.equal(declared, app.expo.version);
});

test('app.json tiene una versión X.Y.Z y un versionCode de Android entero y mayor que 10', () => {
  assert.match(app.expo.version, /^\d+\.\d+\.\d+$/);
  assert.ok(Number.isInteger(app.expo.android.versionCode));
  assert.ok(app.expo.android.versionCode > 10);
});
