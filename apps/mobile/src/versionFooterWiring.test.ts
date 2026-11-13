import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { versionFooter } from './appUpdate.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const more = read('../app/(tabs)/more.tsx');
const appJson = JSON.parse(read('../app.json')) as { expo: { version: string } };

test('el pie de Más sale de la versión de la app y no de un texto escrito a mano', () => {
  assert.match(more, /\{installedVersionFooter\(\)\}/);
  assert.doesNotMatch(more, /Surtivox POS · v\d/);
});

test('con la versión de app.json el pie muestra exactamente esa versión', () => {
  assert.match(appJson.expo.version, /^\d+\.\d+\.\d+$/);
  assert.equal(versionFooter(appJson.expo.version), `Surtivox POS · v${appJson.expo.version} · sin conexión`);
});
