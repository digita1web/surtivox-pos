import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);
const doc = readFileSync(new URL('docs/continuidad.md', root), 'utf8');

test('los enlaces relativos de la guía de continuidad apuntan a archivos que existen', () => {
  const links = [...doc.matchAll(/\]\((?!https?:)([^)#]+)(?:#[^)]*)?\)/g)].map((match) => match[1]!);
  assert.ok(links.length >= 3);
  for (const link of links) assert.ok(existsSync(new URL(link, new URL('docs/', root))), link);
});

test('los archivos del repositorio que cita la guía siguen existiendo', () => {
  const paths = [...doc.matchAll(/`((?:apps|packages|scripts|docs|landing|\.github)\/[\w./-]+\.[a-z0-9]+)`/g)].map((match) => match[1]!);
  assert.ok(paths.length >= 5);
  for (const path of new Set(paths)) assert.ok(existsSync(new URL(path, root)), path);
});

test('la guía no contiene PIN, códigos de recuperación ni credenciales', () => {
  assert.doesNotMatch(doc, /\b(?:7391|2468|1357|8642)\b/);
  assert.doesNotMatch(doc, /[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/);
  assert.doesNotMatch(doc, /ghp_|github_pat_|BEGIN (?:RSA |EC )?PRIVATE KEY|Bearer\s+[A-Za-z0-9]{20,}/);
});
