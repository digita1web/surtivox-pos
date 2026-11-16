import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brandCase, composeName, looksSpanish, mapCategory, parseQuantity, pickBrand, presentationText, transformOff, type CategoryRule, type OffRaw } from '../src/importers/off.ts';
import { loadTaxonomy } from '../src/taxonomy.ts';
import { ROOT } from './fixtures.ts';

const { taxonomy: tax } = loadTaxonomy(ROOT);
const RULES: CategoryRule[] = [
  { tag: 'en:beers', category: 'licores' },
  { tag: 'en:biscuits', category: 'snacks' },
  { tag: 'en:beverages', category: 'bebidas' },
];

const raw = (o: Partial<OffRaw> = {}): OffRaw => ({
  code: '7702011000019',
  product_name_es: 'Galletas de leche',
  brands: 'Colombina, Muuu',
  quantity: '12 g',
  categories_tags: ['en:snacks', 'en:biscuits'],
  countries_tags: ['en:colombia'],
  lang: 'es',
  ...o,
});

test('parseQuantity entiende presentaciones comunes', () => {
  assert.deepEqual(parseQuantity('500 g'), { quantity: 500, unit: 'g' });
  assert.deepEqual(parseQuantity('500g'), { quantity: 500, unit: 'g' });
  assert.deepEqual(parseQuantity('1,5 L'), { quantity: 1.5, unit: 'L' });
  assert.deepEqual(parseQuantity('400 cc'), { quantity: 400, unit: 'ml' });
  assert.deepEqual(parseQuantity('75 cl'), { quantity: 750, unit: 'ml' });
  assert.deepEqual(parseQuantity('6 x 330 ml'), { quantity: 330, unit: 'ml', count: 6 });
  assert.deepEqual(parseQuantity('6x330ml'), { quantity: 330, unit: 'ml', count: 6 });
  assert.deepEqual(parseQuantity('12 unidades'), { quantity: 12, unit: 'unit' });
  assert.deepEqual(parseQuantity('1 lb'), { quantity: 1, unit: 'lb' });
  assert.deepEqual(parseQuantity('2.5 kg.'), { quantity: 2.5, unit: 'kg' });
});

test('parseQuantity descarta lo ambiguo en vez de adivinar', () => {
  for (const q of ['', 'DHP', '16 oz', '500', '1 unidad', '0 g', 'aprox 500 g', '500 g / 1.1 lb', null, 12]) assert.equal(parseQuantity(q), null, String(q));
});

test('presentationText y composeName no repiten lo que el nombre ya trae', () => {
  assert.equal(presentationText({ quantity: 330, unit: 'ml', count: 6 }), '6 x 330 ml');
  assert.equal(presentationText({ quantity: 12, unit: 'unit' }), 'x 12');
  assert.equal(composeName('Galletas de leche', 'Colombina', { quantity: 12, unit: 'g' }), 'Galletas de leche Colombina 12 g');
  assert.equal(composeName('Pietrán Jamón de Cerdo', 'Pietrán', { quantity: 431, unit: 'g' }), 'Pietrán Jamón de Cerdo 431 g');
  assert.equal(composeName('Crema de maní 300g', 'Manitoba', { quantity: 300, unit: 'g' }), 'Crema de maní 300 g Manitoba');
  assert.equal(composeName('Agua', 'Cristal', null), 'Agua Cristal');
});

test('pickBrand toma la primera marca normalizada', () => {
  assert.equal(pickBrand('Colombina,  Muuu'), 'Colombina');
  assert.equal(pickBrand(' ,X, Alpina'), 'Alpina');
  assert.equal(pickBrand(''), null);
  assert.equal(pickBrand(undefined), null);
});

test('mapCategory respeta el orden de la tabla, de lo específico a lo general', () => {
  assert.equal(mapCategory(['en:beverages', 'en:beers'], RULES), 'licores');
  assert.equal(mapCategory(['en:beverages'], RULES), 'bebidas');
  assert.equal(mapCategory(['en:cheeses'], RULES), null);
  assert.equal(mapCategory('en:beers', RULES), null);
});

test('un producto colombiano completo se convierte y pasa el validador', () => {
  const r = transformOff(raw(), RULES, tax, '2026-11-16');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.product, {
    id: 'off:7702011000019',
    name: 'Galletas de leche Colombina 12 g',
    brand: 'Colombina',
    category: 'snacks',
    unit: 'unit',
    barcodes: ['7702011000019'],
    business_types: ['tienda', 'minimercado', 'licorera'],
    source: { id: 'off', ref: '7702011000019', retrieved_at: '2026-11-16' },
    license: 'ODbL-1.0',
    presentation: { quantity: 12, unit: 'g' },
  });
});

test('lo dudoso queda en cuarentena con su motivo', () => {
  const reason = (o: Partial<OffRaw>) => { const r = transformOff(raw(o), RULES, tax, '2026-11-16'); return r.ok ? 'ok' : r.reason; };
  assert.equal(reason({ code: '7702011000012' }), 'gtin_invalido');
  assert.equal(reason({ countries_tags: ['en:mexico'] }), 'no_vendido_en_colombia');
  assert.equal(reason({ product_name_es: '', product_name: 'Milk biscuits', lang: 'en' }), 'sin_nombre_en_espanol');
  assert.equal(reason({ product_name_es: '', product_name: 'Galletas', lang: 'es' }), 'ok');
  assert.equal(reason({ product_name_es: 'YANBAL' }), 'nombre_en_mayusculas');
  assert.equal(reason({ product_name_es: 'Pa' }), 'nombre_muy_corto');
  assert.equal(reason({ brands: '' }), 'sin_marca');
  assert.equal(reason({ categories_tags: ['en:cheeses'] }), 'categoria_sin_equivalencia');
  assert.equal(reason({ product_name_es: '707244561689 Agua Cielo' }), 'nombre_con_codigo');
  assert.equal(reason({ quantity: 'DHP' }), 'ok');
});

test('la tabla de equivalencias de Open Food Facts usa categorías existentes y no repite etiquetas', async () => {
  const { readFileSync } = await import('node:fs');
  const rules = JSON.parse(readFileSync(new URL('../src/importers/off-categories.json', import.meta.url), 'utf8')) as CategoryRule[];
  assert.ok(rules.length > 50);
  assert.equal(new Set(rules.map((r) => r.tag)).size, rules.length);
  for (const r of rules) {
    assert.ok(tax.categories.has(r.category), r.category);
    assert.match(r.tag, /^en:[a-z0-9-]+$/);
  }
  const index = (tag: string) => rules.findIndex((r) => r.tag === tag);
  assert.ok(index('en:beers') < index('en:carbonated-drinks'));
  assert.ok(index('en:plant-based-milk-alternatives') < index('en:dairies'));
  assert.ok(index('en:coffees') < index('en:cereals-and-their-products'));
});

test('acepta nombres en español mal marcados de idioma solo con código colombiano', () => {
  const reason = (o: Partial<OffRaw>) => { const r = transformOff(raw(o), RULES, tax, '2026-11-16'); return r.ok ? 'ok' : r.reason; };
  assert.equal(reason({ product_name_es: '', product_name: 'Galletas de leche', lang: 'en' }), 'ok');
  assert.equal(reason({ product_name_es: '', product_name: 'Galletas de leche', lang: 'en', code: '5901350485149' }), 'sin_nombre_en_espanol');
  assert.equal(reason({ product_name_es: '', product_name: 'Milk biscuits with sugar', lang: 'en' }), 'sin_nombre_en_espanol');
  assert.equal(looksSpanish('Toallitas Humedas'), true);
  assert.equal(looksSpanish('Margarina Gustosita'), true);
  assert.equal(looksSpanish('Leche Entera Super Cremosa'), true);
  assert.equal(looksSpanish('Arándanos Deshidratados'), true);
  for (const en of ['Water', 'Whole Milk', 'sun protection', 'Little angels', 'super Magnesium']) assert.equal(looksSpanish(en), false, en);
});

test('las marcas en mayúsculas pasan a mayúscula inicial sin tocar siglas cortas', () => {
  assert.equal(brandCase('DIANA'), 'Diana');
  assert.equal(brandCase('FIT GRAAN'), 'Fit Graan');
  assert.equal(brandCase('COCA-COLA'), 'Coca-Cola');
  assert.equal(brandCase('PAN'), 'PAN');
  assert.equal(brandCase('Alpina'), 'Alpina');
  const r = transformOff(raw({ brands: 'TOSH' }), RULES, tax, '2026-11-16');
  assert.equal(r.ok && r.product['brand'], 'Tosh');
});
