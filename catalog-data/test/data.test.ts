import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog, summarize } from '../src/catalog.ts';
import { ROOT } from './fixtures.ts';

test('todos los datos maestros del repositorio validan sin errores', async () => {
  const result = await loadCatalog(ROOT);
  const errors = result.issues.filter((i) => i.level === 'error');
  assert.deepEqual(errors.slice(0, 5), []);
  assert.equal(summarize(result.issues).errors, 0);
  assert.ok(result.products.length > 0);
  for (const p of result.products) assert.ok(['off', 'surtivox'].includes(p.source.id), p.id);
});

test('el catálogo propio cubre todos los tipos de negocio', async () => {
  const result = await loadCatalog(ROOT);
  const own = result.products.filter((p) => p.source.id === 'surtivox');
  for (const type of result.taxonomy.businessTypes.keys()) {
    assert.ok(own.some((p) => p.business_types.includes(type)), type);
  }
});
