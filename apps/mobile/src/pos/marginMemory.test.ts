import { test } from 'node:test';
import assert from 'node:assert/strict';
import { implicitMarkupBps, markupsForLast, parseLastMarkup } from './marginMemory.ts';

test('last markup is accepted only in 500 bps steps inside the safe range', () => {
  assert.equal(parseLastMarkup(null), null);
  assert.equal(parseLastMarkup('2500'), 2500);
  assert.equal(parseLastMarkup('2400'), null);
  assert.equal(parseLastMarkup('0'), null);
  assert.equal(parseLastMarkup('11000'), null);
});

test('last markup is placed first without duplicating defaults', () => {
  assert.deepEqual(markupsForLast('2500'), [2500, 2000, 3000]);
  assert.deepEqual(markupsForLast('2000'), [2000, 3000]);
  assert.deepEqual(markupsForLast('3000'), [3000, 2000]);
  assert.deepEqual(markupsForLast(null), [2000, 3000]);
});

test('implicit markup is rounded to 500 bps and rejects unsafe values', () => {
  assert.equal(implicitMarkupBps(2400, 1990), 2000);
  assert.equal(implicitMarkupBps(2600, 1990), 3000);
  assert.equal(implicitMarkupBps(1990, 1990), null);
  assert.equal(implicitMarkupBps(1790, 1990), null);
  assert.equal(implicitMarkupBps(5000, 1000), null);
});
