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

test('los medicamentos son solo los de venta libre básicos aprobados por el propietario', async () => {
  const result = await loadCatalog(ROOT);
  const meds = result.products.filter((p) => p.category === 'medicamentos');
  assert.ok(meds.length > 0);
  for (const p of meds) {
    assert.equal(p.source.id, 'surtivox', p.id);
    assert.match(p.name, /^(Acetaminofén 500 mg|Ibuprofeno 400 mg|Sales de rehidratación oral) /, p.name);
  }
});

test('ningún importador puede clasificar productos como medicamentos', async () => {
  const { readFileSync } = await import('node:fs');
  const rules = JSON.parse(readFileSync(new URL('../src/importers/off-categories.json', import.meta.url), 'utf8')) as { category: string }[];
  assert.ok(!rules.some((r) => r.category === 'medicamentos'));
});

test('lo que se vende por metro se llama "(1 metro)" mientras la app no tenga la unidad m', async () => {
  const result = await loadCatalog(ROOT);
  for (const p of result.products.filter((p) => p.source.id === 'surtivox')) assert.doesNotMatch(p.name, /por metro/i, p.name);
  assert.ok(result.products.some((p) => p.name === 'Cable eléctrico calibre 12 (1 metro)'));
});
