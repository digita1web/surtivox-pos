import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { patchReleaseSigning } from './androidSigning.ts';

const template = readFileSync(new URL('../test-fixtures/build.gradle.template', import.meta.url), 'utf8');

test('la firma de release lee la llave del entorno y no escribe secretos', () => {
  const out = patchReleaseSigning(template);
  assert.match(out, /signingConfig = System\.getenv\("ANDROID_KEYSTORE_PATH"\) \? signingConfigs\.release : signingConfigs\.debug/);
  assert.match(out, /storePassword System\.getenv\("ANDROID_KEYSTORE_PASSWORD"\)/);
  assert.match(out, /keyPassword System\.getenv\("ANDROID_KEY_PASSWORD"\)/);
  assert.doesNotMatch(out, /storePassword '(?!android')/);
});

test('el parche conserva la firma debug para la variante debug', () => {
  const out = patchReleaseSigning(template);
  assert.match(out, /debug \{\n\s+signingConfig = signingConfigs\.debug/);
  assert.match(out, /storePassword 'android'/);
});

test('aplicar el parche dos veces no cambia nada', () => {
  const once = patchReleaseSigning(template);
  assert.equal(patchReleaseSigning(once), once);
});

test('falla en voz alta si la plantilla de Expo cambia', () => {
  assert.throws(() => patchReleaseSigning('android { }'), /signingConfigs\.debug/);
  const sinRelease = template.replace(/signingConfig = signingConfigs\.debug(\s+def enableShrink)/, '$1');
  assert.throws(() => patchReleaseSigning(sinRelease), /buildTypes\.release/);
});
