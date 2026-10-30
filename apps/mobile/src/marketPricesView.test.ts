import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCurrentMarketRequest,
  isOldMarketData,
  statusFromCache,
  statusFromRefresh,
} from './marketPricesView.ts';

test('market view starts loading and becomes ready with cached rows', () => {
  assert.equal(statusFromCache([]), 'loading');
  assert.equal(statusFromCache([{}]), 'ready');
});

test('market refresh preserves cached rows on offline and error', () => {
  assert.equal(statusFromRefresh([], 'offline'), 'offline');
  assert.equal(statusFromRefresh([], 'error'), 'error');
  assert.equal(statusFromRefresh([{}], 'offline'), 'ready');
  assert.equal(statusFromRefresh([{}], 'error'), 'ready');
});

test('market refresh reports empty only after a complete response', () => {
  assert.equal(statusFromRefresh([], 'fresh'), 'empty');
  assert.equal(statusFromRefresh([], 'cached'), 'empty');
});

test('late market responses are rejected by request id', () => {
  assert.equal(isCurrentMarketRequest(2, 2), true);
  assert.equal(isCurrentMarketRequest(1, 2), false);
});

test('market data is marked old after seven days', () => {
  const now = 1_800_000_000_000;
  assert.equal(isOldMarketData(now - 7 * 24 * 60 * 60 * 1000, now), false);
  assert.equal(isOldMarketData(now - 7 * 24 * 60 * 60 * 1000 - 1, now), true);
  assert.equal(isOldMarketData(null, now), false);
});
