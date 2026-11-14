import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../../../.github/workflows/', import.meta.url);
const workflows = readdirSync(dir).filter((name) => name.endsWith('.yml'));
const usesOf = (name: string) => [...readFileSync(new URL(name, dir), 'utf8').matchAll(/^\s*-?\s*uses:\s*(\S+)(?:\s+#\s*(.*))?$/gm)]
  .map((match) => ({ file: name, target: match[1]!, comment: match[2] ?? '' }));

test('todas las acciones de CodeQL usan el mismo SHA de la v4, para que init, analyze y upload-sarif no mezclen versiones', () => {
  const codeql = workflows.flatMap(usesOf).filter((use) => use.target.startsWith('github/codeql-action/'));
  assert.ok(codeql.length >= 3);
  assert.deepEqual([...new Set(codeql.map((use) => use.target.split('@')[1]))].length, 1);
  for (const use of codeql) assert.match(use.comment, /^v4\./, `${use.file}: ${use.target}`);
  const actions = codeql.map((use) => use.target.split('@')[0]).sort();
  assert.deepEqual(actions, [
    'github/codeql-action/analyze',
    'github/codeql-action/init',
    'github/codeql-action/upload-sarif',
  ]);
});
