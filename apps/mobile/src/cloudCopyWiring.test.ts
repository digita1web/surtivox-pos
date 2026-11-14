import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('la pantalla de nube no promete respaldo automático mientras la sincronización solo se hace con el botón', () => {
  const screen = read('../app/cloud-sync.tsx');
  assert.doesNotMatch(screen, /Respaldo automático/);
  assert.match(screen, /Guarda tu tienda en la nube con un toque/);
  const callers = ['../app/cloud-sync.tsx', '../app/(tabs)/index.tsx', '../app/(tabs)/more.tsx', '../app/_layout.tsx']
    .filter((path) => /\bsyncNow\(/.test(read(path)));
  assert.deepEqual(callers, ['../app/cloud-sync.tsx']);
});
