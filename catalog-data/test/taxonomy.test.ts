import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTaxonomy, loadTaxonomy, readTaxonomyFiles } from '../src/taxonomy.ts';
import { ROOT, TEST_SOURCES } from './fixtures.ts';

const mobile = (path: string) => readFileSync(new URL(`../../apps/mobile/${path}`, import.meta.url), 'utf8');

test('las taxonomías del repositorio son válidas', () => {
  const { taxonomy, issues } = loadTaxonomy(ROOT);
  assert.deepEqual(issues, []);
  assert.ok(taxonomy.businessTypes.size >= 6);
  assert.ok(taxonomy.categories.size >= 16);
});

test('las 16 categorías con imagen de la app existen con el mismo nombre', () => {
  const { taxonomy } = loadTaxonomy(ROOT);
  const source = mobile('src/pos/categoryImages.ts');
  const appNames = [...source.matchAll(/^\s+(?:'([^']+)'|([^\s:']+)):\s+require/gm)].map((m) => m[1] ?? m[2]!);
  assert.equal(appNames.length, 16);
  const names = new Set([...taxonomy.categories.values()].map((c) => c.name));
  for (const name of appNames) assert.ok(names.has(name), name);
});

test('las unidades de venta son exactamente las que la app acepta', () => {
  const { taxonomy } = loadTaxonomy(ROOT);
  const line = mobile('app/add-product.tsx').match(/const UNITS = \[([^\]]+)\]/)![1]!;
  const appUnits = [...line.matchAll(/'([^']+)'/g)].map((m) => m[1]!).sort();
  const sale = [...taxonomy.units.values()].filter((u) => u.sale).map((u) => u.id).sort();
  assert.deepEqual(sale, appUnits);
});

test('la libra colombiana pesa 500 g y la docena 12 unidades', () => {
  const { taxonomy } = loadTaxonomy(ROOT);
  assert.equal(taxonomy.units.get('lb')!.factor, 500);
  assert.equal(taxonomy.units.get('dozen')!.factor, 12);
});

test('cada categoría tiene emoji y solo tipos de negocio existentes', () => {
  const { taxonomy } = loadTaxonomy(ROOT);
  for (const c of taxonomy.categories.values()) {
    assert.ok(c.emoji.length > 0, c.id);
    for (const t of c.business_types) assert.ok(taxonomy.businessTypes.has(t), `${c.id}:${t}`);
  }
  for (const t of taxonomy.businessTypes.keys()) {
    assert.ok([...taxonomy.categories.values()].some((c) => c.business_types.includes(t)), `${t} sin categorías`);
  }
});

test('la licencia ODbL es compatible y la CC BY-SA no', () => {
  const { taxonomy } = loadTaxonomy(ROOT);
  assert.equal(taxonomy.licenses.get('ODbL-1.0')!.compatible, true);
  assert.equal(taxonomy.licenses.get('CC-BY-SA-4.0')!.compatible, false);
});

test('no hay fuentes aprobadas hasta que el propietario lo decida', () => {
  const { taxonomy } = loadTaxonomy(ROOT);
  assert.equal([...taxonomy.sources.values()].filter((s) => s.status === 'approved').length, 0);
});

test('buildTaxonomy rechaza referencias rotas, ids repetidos y fuentes incompatibles', () => {
  const files = readTaxonomyFiles(ROOT);
  const codes = (patch: Partial<typeof files>) => buildTaxonomy({ ...files, ...patch }).issues.map((i) => i.code);
  assert.ok(codes({ categories: [{ id: 'x', name: 'X', emoji: '❓', business_types: ['no-existe'] }] }).includes('taxonomia_campo_invalido'));
  assert.ok(codes({ categories: [...(files.categories as object[]), { id: 'granos', name: 'Otra', emoji: '🌾', business_types: ['tienda'] }] }).includes('taxonomia_id_duplicado'));
  assert.ok(codes({ categories: [...(files.categories as object[]), { id: 'granos-2', name: 'Granos', emoji: '🌾', business_types: ['tienda'] }] }).includes('taxonomia_nombre_duplicado'));
  assert.ok(codes({ units: [{ id: 'kg', name: 'k', plural: 'ks', kind: 'mass', factor: 0, sale: true, presentation: true }] }).includes('taxonomia_campo_invalido'));
  assert.ok(codes({ sources: [{ ...TEST_SOURCES[3], status: 'approved' }] }).includes('taxonomia_campo_invalido'));
  assert.ok(codes({ sources: [{ ...TEST_SOURCES[0], attribution: '' }] }).includes('taxonomia_campo_invalido'));
  assert.ok(codes({ sources: [{ ...TEST_SOURCES[0], license: 'MIT' }] }).includes('taxonomia_campo_invalido'));
  assert.ok(codes({ sources: [{ ...TEST_SOURCES[0], url: 'http://inseguro' }] }).includes('taxonomia_campo_invalido'));
  assert.ok(codes({ businessTypes: { no: 'lista' } }).includes('taxonomia_no_es_lista'));
});
