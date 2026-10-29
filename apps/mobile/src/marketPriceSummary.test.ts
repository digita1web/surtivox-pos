import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dataAgeLabel, lowestComparablePrice, normalizePresentation, presentationsDiffer,
} from './marketPriceSummary.ts';

const rows = [
  { supermarket_name: 'Éxito', price_minor: 22390, presentation: '5000 gr' },
  { supermarket_name: 'Jumbo', price_minor: 22490, presentation: '5kg' },
  { supermarket_name: 'Olímpica', price_minor: 21950, presentation: '5 Kg' },
];

test('normalizes equivalent presentations and keeps different sizes apart', () => {
  assert.equal(normalizePresentation('5000 gr'), '5 kg');
  assert.equal(normalizePresentation('5kg'), '5 kg');
  assert.equal(normalizePresentation('5 Kg'), '5 kg');
  assert.equal(normalizePresentation('500 g'), '500 g');
  assert.equal(normalizePresentation(null), null);
  assert.notEqual(normalizePresentation('500 g'), normalizePresentation('1 kg'));
});

test('identifies the lowest comparable price without changing the input', () => {
  const snapshot = JSON.stringify(rows);
  const lowest = lowestComparablePrice(rows);
  assert.deepEqual(lowest, { price_minor: 21950, supermarket_name: 'Olímpica', presentation: '5 kg' });
  assert.equal(JSON.stringify(rows), snapshot);
});

test('uses the largest comparable group and warns when presentations differ', () => {
  const mixed = [
    { supermarket_name: 'Éxito', price_minor: 2500, presentation: '500 g' },
    { supermarket_name: 'Jumbo', price_minor: 4800, presentation: '1 kg' },
    { supermarket_name: 'Olímpica', price_minor: 5000, presentation: '1 kg' },
  ];
  assert.equal(presentationsDiffer(mixed), true);
  assert.deepEqual(lowestComparablePrice(mixed), {
    price_minor: 4800,
    supermarket_name: 'Jumbo',
    presentation: '1 kg',
  });
});

test('reports mixed presentations when one result has no presentation', () => {
  assert.equal(presentationsDiffer([
    { supermarket_name: 'Éxito', price_minor: 2500, presentation: '500 g' },
    { supermarket_name: 'Jumbo', price_minor: 4800, presentation: null },
  ]), true);
});

test('has no comparable price for a single result', () => {
  assert.equal(lowestComparablePrice([rows[0]!]), null);
  assert.equal(presentationsDiffer([rows[0]!]), false);
});

test('formats the age of the last fetch', () => {
  const now = 1_000_000_000_000;
  assert.equal(dataAgeLabel(now - 30_000, now), 'hace menos de 1 min');
  assert.equal(dataAgeLabel(now - 5 * 60_000, now), 'hace 5 min');
  assert.equal(dataAgeLabel(now - 2 * 60 * 60_000, now), 'hace 2 h');
  assert.equal(dataAgeLabel(now - 2 * 24 * 60 * 60_000, now), 'hace 2 días');
  assert.equal(dataAgeLabel(null, now), null);
});

test('has no lowest comparable price when every presentation is different', () => {
  const distinct = [
    { supermarket_name: 'Éxito', price_minor: 2500, presentation: '500 g' },
    { supermarket_name: 'Jumbo', price_minor: 4800, presentation: '1 kg' },
    { supermarket_name: 'Olímpica', price_minor: 7000, presentation: '2 kg' },
  ];
  assert.equal(presentationsDiffer(distinct), true);
  assert.equal(lowestComparablePrice(distinct), null);
});
