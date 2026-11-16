import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

const VISIBLE_STOCK = /\b(?:sin|en|con|de|el|agregar|buen|tiene|tienen) stock\b|\bstock (?:bajo|actual|inicial|actualizado)\b/i;

test('las pantallas dicen agotado, por agotarse o unidades en vez de stock', () => {
  const offenders = [...files(join(root, 'app')), ...files(join(root, 'src'))]
    .flatMap((path) => readFileSync(path, 'utf8').split('\n').map((line, i) => [path, i + 1, line] as const))
    .filter(([, , line]) => VISIBLE_STOCK.test(line))
    .map(([path, n, line]) => `${path.slice(root.length)}:${n}: ${line.trim()}`);
  assert.deepEqual(offenders, []);
});

test('la landing y el README tampoco usan stock', () => {
  for (const path of ['../../../landing/index.html', '../../../README.md']) {
    assert.doesNotMatch(readFileSync(new URL(path, import.meta.url), 'utf8'), /\bstock\b/i, path);
  }
});
