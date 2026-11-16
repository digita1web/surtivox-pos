import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collapseSpaces, foldKey, hasControlChars, isShouting, normalizeName } from '../src/normalize.ts';

test('normalizeName unifica espacios, NFC y unidades', () => {
  assert.equal(normalizeName('  Arroz   Diana 500gr '), 'Arroz Diana 500 g');
  assert.equal(normalizeName('Aceite 1lt'), 'Aceite 1 L');
  assert.equal(normalizeName('Aceite 1 Litro'), 'Aceite 1 L');
  assert.equal(normalizeName('Leche 1100ML'), 'Leche 1100 ml');
  assert.equal(normalizeName('Gaseosa 400 cc'), 'Gaseosa 400 ml');
  assert.equal(normalizeName('Azúcar 2.5 Kilos'), 'Azúcar 2.5 kg');
  assert.equal(normalizeName('Queso 1 libra'), 'Queso 1 lb');
  assert.equal(normalizeName('Acetaminofén 500mg'), 'Acetaminofén 500 mg');
  assert.equal(normalizeName('Café Sello Rojo 250g'), 'Café Sello Rojo 250 g');
  assert.equal(normalizeName('Cable 2 m'), 'Cable 2 m');
});

test('normalizeName no inventa unidades dentro de palabras', () => {
  for (const name of ['Pilas AA 2 unidades', 'Gaseosa 2 lata', 'Lápiz 2B', 'Galletas Gol', 'Leche Alpina']) {
    assert.equal(normalizeName(name), name, name);
  }
});

test('normalizeName es idempotente', () => {
  for (const raw of ['Arroz  500gr', 'Aceite 1lt', ' Café 250 G ']) {
    const once = normalizeName(raw);
    assert.equal(normalizeName(once), once, raw);
  }
});

test('foldKey quita tildes, mayúsculas y signos para comparar', () => {
  assert.equal(foldKey('Café Águila, 250 g!'), 'cafe aguila 250 g');
  assert.equal(foldKey('PIÑA  colada'), 'pina colada');
  assert.equal(foldKey('Ñame'), 'name');
});

test('detecta texto en mayúsculas y caracteres de control', () => {
  assert.equal(isShouting('ARROZ DIANA 500 G'), true);
  assert.equal(isShouting('UHT'), false);
  assert.equal(isShouting('Arroz Diana'), false);
  assert.equal(hasControlChars('Arroz\tDiana'), true);
  assert.equal(hasControlChars('Arroz Diana'), false);
  assert.equal(collapseSpaces(' a \n b '), 'a b');
});
