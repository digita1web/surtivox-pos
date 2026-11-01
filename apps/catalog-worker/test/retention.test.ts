import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isExpiredLimitDay, limitCutoffDay } from '../src/retention.ts';

test('calculates a seven-day UTC cutoff', () => {
  const now = Date.UTC(2026, 10, 1, 12, 0, 0);
  assert.equal(limitCutoffDay(now), '2026-10-25');
});

test('handles year boundaries', () => {
  const now = Date.UTC(2027, 0, 2, 12, 0, 0);
  assert.equal(limitCutoffDay(now), '2026-12-26');
});

test('deletes only days older than the cutoff', () => {
  assert.equal(isExpiredLimitDay('2026-10-24', '2026-10-25'), true);
  assert.equal(isExpiredLimitDay('2026-10-25', '2026-10-25'), false);
  assert.equal(isExpiredLimitDay('2026-10-26', '2026-10-25'), false);
});
