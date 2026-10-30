import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asMinor } from '@surtivox/types';
import { describeMargin, priceStep, roundToStep, suggestPrices } from '../src/suggest.ts';

test('roundToStep uses the COP step and rounds half away from zero', () => {
  assert.equal(roundToStep(asMinor(994), 50), 1000);
  assert.equal(roundToStep(asMinor(1026), 50), 1050);
  assert.equal(roundToStep(asMinor(1950), 100), 2000);
});

test('priceStep uses 50 below 1000 and 100 from 1000', () => {
  assert.equal(priceStep(asMinor(990)), 50);
  assert.equal(priceStep(asMinor(1000)), 100);
  assert.equal(priceStep(asMinor(1990)), 100);
});

test('suggestPrices builds equal and rounded margin chips', () => {
  assert.deepEqual(suggestPrices({ reference: asMinor(1990) }), [
    { label: 'Igualar', price: 1990 },
    { label: '+20%', price: 2400 },
    { label: '+30%', price: 2600 },
  ]);
  assert.deepEqual(suggestPrices({ reference: asMinor(990) }), [
    { label: 'Igualar', price: 990 },
    { label: '+20%', price: 1200 },
    { label: '+30%', price: 1300 },
  ]);
});

test('suggestPrices rejects null references and deduplicates prices', () => {
  assert.deepEqual(suggestPrices({ reference: null }), []);
  assert.deepEqual(suggestPrices({ reference: asMinor(0) }), []);
  assert.deepEqual(suggestPrices({ reference: asMinor(1990), markupsBps: [0, 2000, 2000] }), [
    { label: 'Igualar', price: 1990 },
    { label: '+20%', price: 2400 },
  ]);
});

test('describeMargin compares against the lowest reference', () => {
  assert.deepEqual(
    describeMargin({ price: asMinor(2400), reference: asMinor(1990), referenceName: 'Jumbo' }),
    { text: 'Estás $ 410 por encima de Jumbo (21%)', tone: 'neutral' },
  );
  assert.deepEqual(
    describeMargin({ price: asMinor(1790), reference: asMinor(1990), referenceName: 'Jumbo' }),
    { text: 'Estás $ 200 por debajo de Jumbo', tone: 'neutral' },
  );
  assert.equal(
    describeMargin({ price: asMinor(2490), reference: asMinor(1990) }).tone,
    'warn',
  );
  assert.equal(
    describeMargin({ price: asMinor(1990), reference: asMinor(1990) }).text,
    'Igual al precio más bajo (la referencia)',
  );
});

test('describeMargin prioritizes cost and warns when selling below it', () => {
  assert.deepEqual(
    describeMargin({ price: asMinor(2400), cost: asMinor(2000) }),
    { text: 'Ganas $ 400 por unidad (20%)', tone: 'neutral' },
  );
  assert.deepEqual(
    describeMargin({ price: asMinor(1990), cost: asMinor(2500) }),
    { text: 'Vendes por debajo de tu costo', tone: 'danger' },
  );
});
