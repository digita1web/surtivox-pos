import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('los ids de las filas salen del generador criptográfico del sistema y no de Math.random', () => {
  const source = read('./id.ts');
  assert.match(source, /import \* as Crypto from 'expo-crypto'/);
  assert.match(source, /Crypto\.randomUUID\(\)/);
  assert.doesNotMatch(source, /Math\.random/);
});

test('la versión instalada de expo-crypto sigue exponiendo randomUUID', () => {
  const declarations = read('../../../node_modules/expo-crypto/build/Crypto.d.ts');
  assert.match(declarations, /export declare function randomUUID\(\): string;/);
});
