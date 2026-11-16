import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stockLabel } from './pos/unitLabel.ts';

test('las unidades contables concuerdan en número', () => {
  assert.equal(stockLabel(10, 'bottle'), '10 botellas');
  assert.equal(stockLabel(1, 'bottle'), '1 botella');
  assert.equal(stockLabel(0, 'box'), '0 cajas');
  assert.equal(stockLabel(-1, 'pack'), '-1 paquete');
  assert.equal(stockLabel(3, 'pcs'), '3 piezas');
  assert.equal(stockLabel(2, 'dozen'), '2 docenas');
  assert.equal(stockLabel(5, 'bulto'), '5 bultos');
});

test('sin unidad o con "unit" dice disponible o disponibles', () => {
  assert.equal(stockLabel(7, 'unit'), '7 disponibles');
  assert.equal(stockLabel(1, 'unit'), '1 disponible');
  assert.equal(stockLabel(4, null), '4 disponibles');
  assert.equal(stockLabel(4, ''), '4 disponibles');
});

test('las unidades de medida y las desconocidas no cambian', () => {
  assert.equal(stockLabel(3, 'kg'), '3 kg');
  assert.equal(stockLabel(1, 'L'), '1 L');
  assert.equal(stockLabel(2, 'lb'), '2 lb');
  assert.equal(stockLabel(2, 'atado'), '2 atado');
});

test('la tarjeta de producto usa stockLabel y no un texto fijo', async () => {
  const { readFileSync } = await import('node:fs');
  const card = readFileSync(new URL('./pos/ProductCard.tsx', import.meta.url), 'utf8');
  assert.match(card, /stockLabel\(product\.stock, product\.unit\)/);
  assert.doesNotMatch(card, /UNIT_SHORT/);
});
