import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = readFileSync(new URL('../app/data.tsx', import.meta.url), 'utf8');

test('guardar la copia no sugiere la carpeta raíz de Descargas, que Android 11 o superior no deja usar', () => {
  assert.doesNotMatch(data, /por ejemplo Descargas/);
  assert.match(data, /Elige o crea una carpeta dentro de Descargas/);
});
