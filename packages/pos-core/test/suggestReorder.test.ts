import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestReorder, type SalesPoint } from '../src/suggestReorder.ts';

function isoDateDaysAgo(days: number): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function dailyPoints(days: number, quantity: number): SalesPoint[] {
  return Array.from({ length: days }, (_, index) => ({
    date: isoDateDaysAgo(index),
    quantity,
  }));
}

test('returns no suggestion without sales history', () => {
  assert.deepEqual(suggestReorder([], 0), {
    unitsPerDay: 0,
    daysOfStockLeft: null,
    suggestedQuantity: 0,
    urgency: 'ok',
    usedFallbackWindow: false,
    cappedBy: 'none',
  });
});

test('suggests cover demand for a normal seller', () => {
  const result = suggestReorder(dailyPoints(14, 10), 20);
  assert.equal(result.unitsPerDay, 10);
  assert.equal(result.daysOfStockLeft, 2);
  assert.equal(result.urgency, 'critical');
  assert.equal(result.suggestedQuantity, 50);
  assert.equal(result.cappedBy, 'none');
});

test('rounds one unit in fourteen days up to one unit', () => {
  const result = suggestReorder([{ date: isoDateDaysAgo(3), quantity: 1 }], 0);
  assert.equal(result.suggestedQuantity, 1);
  assert.equal(result.urgency, 'critical');
  assert.equal(result.cappedBy, 'none');
});

test('uses fallback window when recent window has no sales', () => {
  const sales = [
    { date: isoDateDaysAgo(20), quantity: 10 },
    { date: isoDateDaysAgo(22), quantity: 10 },
    { date: isoDateDaysAgo(25), quantity: 10 },
  ];
  const result = suggestReorder(sales, 5, { coverDays: 7 });
  assert.equal(result.usedFallbackWindow, true);
  assert.ok(result.suggestedQuantity > 0);
});

test('normalizes negative stock without producing non-finite values', () => {
  const result = suggestReorder(dailyPoints(14, 2), -5);
  assert.equal(result.daysOfStockLeft, 0);
  assert.ok(Number.isFinite(result.daysOfStockLeft));
  assert.ok(Number.isFinite(result.suggestedQuantity));
});

test('caps an outlier suggestion by absolute max units', () => {
  const sales = dailyPoints(14, 0);
  sales[0] = { date: isoDateDaysAgo(0), quantity: 5000 };
  const result = suggestReorder(sales, 0, { coverDays: 7, medianMultiplier: 3 });
  assert.ok(result.suggestedQuantity <= 500);
  assert.notEqual(result.suggestedQuantity, 35000);
  assert.equal(result.cappedBy, 'maxUnits');
});

test('coverDays changes the suggested quantity', () => {
  const sales = dailyPoints(14, 10);
  const shortCover = suggestReorder(sales, 20, { coverDays: 3 });
  const longCover = suggestReorder(sales, 20, { coverDays: 7 });
  assert.ok(shortCover.suggestedQuantity < longCover.suggestedQuantity);
  assert.equal(shortCover.suggestedQuantity, 10);
  assert.equal(longCover.suggestedQuantity, 50);
});
