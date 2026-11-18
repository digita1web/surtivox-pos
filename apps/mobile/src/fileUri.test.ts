import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { toFileUri } from './fileUri.ts';

test('una ruta absoluta de Android se vuelve una URI file:// que expo-file-system acepta', () => {
  assert.equal(toFileUri('/data/user/0/io.surtivox.pos/files/SQLite/surtivox.db'), 'file:///data/user/0/io.surtivox.pos/files/SQLite/surtivox.db');
  assert.equal(toFileUri('/data/data/io.surtivox.pos/files/SQLite/surtivox.db'), 'file:///data/data/io.surtivox.pos/files/SQLite/surtivox.db');
});

test('una URI que ya trae esquema no se toca', () => {
  for (const uri of ['file:///data/x.db', 'content://media/external/1', 'FILE:///a']) assert.equal(toFileUri(uri), uri);
});

test('una ruta relativa falla en voz alta en vez de tratarse como recurso de Android', () => {
  assert.throws(() => toFileUri('surtivox.db'), /ruta absoluta/);
  assert.throws(() => toFileUri(''), /ruta absoluta/);
});

test('ninguna llamada a expo-file-system recibe databasePath sin convertirlo a file://', () => {
  const roots = ['./', '../app/'];
  const offenders: string[] = [];
  let wrapped = 0;
  for (const root of roots) {
    for (const name of readdirSync(new URL(root, import.meta.url), { recursive: true, encoding: 'utf8' })) {
      if (!/\.tsx?$/.test(name) || name.endsWith('.test.ts')) continue;
      const source = readFileSync(new URL(`${root}${name}`, import.meta.url), 'utf8');
      for (const call of source.matchAll(/FileSystem\.\w+\(([^;]*?databasePath[^;]*?)\)/g)) {
        if (/toFileUri\(\s*\w+\.databasePath\b/.test(call[1]!)) wrapped++;
        else offenders.push(`${root}${name}: ${call[0]}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
  assert.equal(wrapped, 2);
});
