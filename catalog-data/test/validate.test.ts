import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CatalogChecker, validateProduct } from '../src/validate.ts';
import { product, testTaxonomy } from './fixtures.ts';

const tax = testTaxonomy();
const codesOf = (raw: unknown) => validateProduct(raw, tax).issues.map((i) => `${i.level}:${i.code}`);
const errorsOf = (raw: unknown) => validateProduct(raw, tax).issues.filter((i) => i.level === 'error').map((i) => i.code);

test('un producto completo y correcto pasa sin avisos', () => {
  const { product: p, issues } = validateProduct(product(), tax, { file: 'data/x.jsonl', line: 3 });
  assert.deepEqual(issues, []);
  assert.equal(p!.name, 'Arroz Diana 500 g');
  assert.deepEqual(p!.presentation, { quantity: 500, unit: 'g' });
});

test('solo los campos obligatorios también pasan', () => {
  const minimal = { id: 'abierta:panela', name: 'Panela', category: 'abarrotes', unit: 'unit', business_types: ['tienda'], source: { id: 'abierta' }, license: 'CC0-1.0' };
  assert.deepEqual(validateProduct(minimal, tax).issues, []);
});

test('campos desconocidos u obligatorios ausentes se rechazan', () => {
  assert.deepEqual(errorsOf(product({ precio: 2500 })), ['campo_desconocido']);
  const { category: _c, ...rest } = product();
  assert.deepEqual(errorsOf(rest), ['campo_obligatorio']);
  assert.deepEqual(errorsOf([product()]), ['registro_invalido']);
  assert.deepEqual(errorsOf(null), ['registro_invalido']);
});

test('el id debe ser fuente:clave y su prefijo debe ser la fuente', () => {
  assert.ok(errorsOf(product({ id: 'arroz' })).includes('id_invalido'));
  assert.ok(errorsOf(product({ id: 'prueba:con espacio' })).includes('id_invalido'));
  assert.ok(errorsOf(product({ id: 'abierta:arroz' })).includes('id_fuente_distinta'));
});

test('los textos deben venir normalizados y con largo razonable', () => {
  assert.ok(errorsOf(product({ name: 'Arroz  Diana 500gr' })).includes('texto_sin_normalizar'));
  assert.ok(errorsOf(product({ name: 'A' })).includes('largo_invalido'));
  assert.ok(errorsOf(product({ name: 'x'.repeat(121) })).includes('largo_invalido'));
  assert.ok(errorsOf(product({ name: 'Arroz\u0007' })).includes('caracteres_de_control'));
  assert.ok(errorsOf(product({ name: 42 })).includes('tipo_invalido'));
  assert.ok(errorsOf(product({ brand: ' Diana' })).includes('texto_sin_normalizar'));
  assert.deepEqual(codesOf(product({ name: 'ARROZ DIANA 500 G' })), ['warning:texto_en_mayusculas']);
});

test('categoría, unidad y tipos de negocio deben existir y ser coherentes', () => {
  assert.ok(errorsOf(product({ category: 'joyeria' })).includes('categoria_desconocida'));
  assert.ok(errorsOf(product({ unit: 'mg' })).includes('unidad_invalida'));
  assert.ok(errorsOf(product({ unit: 'tonelada' })).includes('unidad_invalida'));
  assert.ok(errorsOf(product({ business_types: [] })).includes('tipos_de_negocio_invalidos'));
  assert.ok(errorsOf(product({ business_types: ['tienda', 'tienda'] })).includes('tipos_de_negocio_invalidos'));
  assert.ok(errorsOf(product({ business_types: ['joyeria'] })).includes('tipo_de_negocio_desconocido'));
  assert.ok(errorsOf(product({ business_types: ['ferreteria'] })).includes('categoria_fuera_de_negocio'));
});

test('la presentación usa unidades de presentación y cantidades válidas', () => {
  assert.deepEqual(errorsOf(product({ presentation: { quantity: 6, unit: 'unit', count: 6 } })), []);
  assert.ok(errorsOf(product({ presentation: { quantity: 0, unit: 'g' } })).includes('presentacion_invalida'));
  assert.ok(errorsOf(product({ presentation: { quantity: 500, unit: 'bottle' } })).includes('unidad_invalida'));
  assert.ok(errorsOf(product({ presentation: { quantity: 1, unit: 'L', count: 1 } })).includes('presentacion_invalida'));
  assert.ok(errorsOf(product({ presentation: { quantity: 1, unit: 'L', color: 'rojo' } })).includes('campo_desconocido'));
  assert.ok(errorsOf(product({ presentation: '500 g' })).includes('presentacion_invalida'));
});

test('sinónimos únicos, normalizados y distintos del nombre', () => {
  assert.ok(errorsOf(product({ synonyms: ['arroz diana 500 g'] })).includes('sinonimo_repetido'));
  assert.ok(errorsOf(product({ synonyms: ['Arroz blanco', 'ARROZ BLANCO'] })).includes('sinonimo_repetido'));
  assert.ok(errorsOf(product({ synonyms: [] })).includes('sinonimos_invalidos'));
  assert.ok(errorsOf(product({ synonyms: Array.from({ length: 21 }, (_, i) => `Sinónimo ${i}`) })).includes('sinonimos_invalidos'));
});

test('códigos de barras GTIN válidos y sin repetir', () => {
  assert.ok(errorsOf(product({ barcodes: ['7702511000046'] })).includes('gtin_invalido'));
  assert.ok(errorsOf(product({ barcodes: ['7702511000045', '7702511000045'] })).includes('codigo_repetido'));
  assert.ok(errorsOf(product({ barcodes: [] })).includes('codigos_invalidos'));
  assert.ok(errorsOf(product({ barcodes: [7702511000045] })).includes('codigos_invalidos'));
});

test('solo se aceptan fuentes registradas y aprobadas, con su misma licencia', () => {
  assert.ok(errorsOf(product({ source: { id: 'desconocida' } })).includes('fuente_desconocida'));
  assert.ok(errorsOf(product({ id: 'pendiente:a', source: { id: 'pendiente' }, license: 'CC0-1.0' })).includes('fuente_no_aprobada'));
  assert.ok(errorsOf(product({ id: 'vetada:a', source: { id: 'vetada' }, license: 'CC-BY-SA-4.0' })).includes('fuente_no_aprobada'));
  assert.ok(errorsOf(product({ license: 'CC0-1.0' })).includes('licencia_distinta'));
  assert.ok(errorsOf(product({ source: { id: 'prueba', retrieved_at: '2026-02-30' } })).includes('fecha_invalida'));
  assert.ok(errorsOf(product({ source: { id: 'prueba', ref: '' } })).includes('fuente_invalida'));
  assert.ok(errorsOf(product({ source: { id: 'prueba', url: 'x' } })).includes('campo_desconocido'));
});

test('el catálogo rechaza ids repetidos y códigos compartidos, y avisa posibles duplicados', () => {
  const checker = new CatalogChecker();
  const a = validateProduct(product(), tax).product!;
  assert.deepEqual(checker.add(a, { file: 'a.jsonl', line: 1 }), []);
  assert.deepEqual(checker.add(a, { file: 'a.jsonl', line: 2 }).map((i) => i.code), ['id_duplicado']);
  const sameCode = validateProduct(product({ id: 'prueba:otro', name: 'Arroz Roa 500 g', brand: 'Roa' }), tax).product!;
  assert.deepEqual(checker.add(sameCode).map((i) => i.code), ['codigo_en_dos_productos']);
  const twin = validateProduct(product({ id: 'prueba:gemelo', barcodes: undefined, synonyms: undefined, name: 'arroz diana 500 g' }), tax);
  assert.deepEqual(twin.issues, []);
  assert.deepEqual(checker.add(twin.product!).map((i) => `${i.level}:${i.code}`), ['warning:posible_duplicado']);
  assert.equal(checker.count, 3);
});

test('jsonlFiles recorre subcarpetas en orden y trata una carpeta inexistente como vacía', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { jsonlFiles } = await import('../src/catalog.ts');
  const dir = mkdtempSync(join(tmpdir(), 'jsonl-'));
  try {
    mkdirSync(join(dir, 'b'));
    writeFileSync(join(dir, 'b', 'z.jsonl'), '');
    writeFileSync(join(dir, 'a.jsonl'), '');
    writeFileSync(join(dir, 'notas.txt'), '');
    assert.deepEqual(jsonlFiles(dir).map((p) => p.slice(dir.length + 1)), ['a.jsonl', join('b', 'z.jsonl')]);
    assert.deepEqual(jsonlFiles(join(dir, 'no-existe')), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
