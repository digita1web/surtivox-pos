import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBackupPayload } from './backupValidation.ts';

const schema = {
  products: ['id', 'name', 'selling_price', 'active'],
  sales: ['id', 'total', 'sold_at'],
};

function payload(tables: Record<string, unknown>, migrations?: unknown) {
  return {
    app: 'surtivoxpos',
    schema: 1,
    ...(migrations === undefined ? {} : { migrations }),
    tables,
  };
}

test('accepts a valid backup', () => {
  assert.deepEqual(
    validateBackupPayload(payload({ products: [{ id: 'p1', name: 'Arroz', selling_price: 2500, active: 1 }] }, 11), schema, 11),
    { ok: true },
  );
});

test('rejects an incorrect magic value', () => {
  assert.equal(validateBackupPayload({ app: 'otra', tables: {} }, schema, 11).ok, false);
});

test('rejects table names with quotes or injection attempts', () => {
  const result = validateBackupPayload(payload({ 'x"; DROP TABLE products; --': [] }), schema, 11);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /versión más nueva/);
});

test('rejects unknown tables', () => {
  const result = validateBackupPayload(payload({ unknown_table: [] }), schema, 11);
  assert.equal(result.ok, false);
});

test('rejects forbidden internal tables', () => {
  const result = validateBackupPayload(payload({ _migrations: [] }), { ...schema, _migrations: ['id'] }, 11);
  assert.equal(result.ok, false);
});

test('rejects unknown columns', () => {
  const result = validateBackupPayload(payload({ products: [{ id: 'p1', name: 'Arroz', extra: 1 }] }), schema, 11);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /columna/);
});

test('rejects a migration count newer than the installed app', () => {
  const result = validateBackupPayload(payload({}, 12), schema, 11);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /versión más nueva/);
});

test('accepts old backups without a migration count', () => {
  assert.deepEqual(validateBackupPayload(payload({ products: [] }), schema, 11), { ok: true });
});

test('rejects values with unsupported types', () => {
  const result = validateBackupPayload(payload({ products: [{ id: 'p1', name: 'Arroz', active: true }] }), schema, 11);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /valor/);
});

test('rejects rows that are not objects', () => {
  const result = validateBackupPayload(payload({ products: ['fila'] }), schema, 11);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /fila/);
});

test('accepts empty tables', () => {
  assert.deepEqual(validateBackupPayload(payload({ products: [], sales: [] }), schema, 11), { ok: true });
});

import { verifyBackupText } from './backupValidation.ts';

const sample = JSON.stringify({ app: 'surtivoxpos', tables: { products: [{ id: 'a' }, { id: 'b' }], sales: [{ id: 'c' }] } });

test('verifyBackupText acepta un archivo completo', () => {
  assert.deepEqual(verifyBackupText(sample, 3), { ok: true });
});

test('verifyBackupText rechaza un archivo truncado o con otro conteo', () => {
  assert.equal(verifyBackupText(sample.slice(0, -10), 3).ok, false);
  assert.equal(verifyBackupText(sample, 4).ok, false);
});

test('verifyBackupText rechaza lo que no es un respaldo de Surtivox', () => {
  assert.equal(verifyBackupText('{"app":"otro","tables":{}}', 0).ok, false);
  assert.equal(verifyBackupText('{"app":"surtivoxpos","tables":{"x":5}}', 0).ok, false);
});
