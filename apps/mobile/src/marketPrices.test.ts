import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchMarketPrices, isMarketPricesStale, isValidEan, marketPricesRefreshFailureStatus, MarketPricesError,
} from './marketPrices.ts';

const EAN = '7702511000045';
const fetchedAt = 1760000000000;

function row(overrides: Record<string, unknown> = {}) {
  return {
    ean: EAN,
    provider_id: 'vtex:exitocol',
    supermarket_name: 'Éxito',
    location: null,
    context_key: 'online',
    price_minor: 22390,
    currency_code: 'COP',
    product_name: 'Arroz DIANA blanco vitamor (5000 gr)',
    presentation: '5000 gr',
    product_url: 'https://www.exito.com/arroz-diana-5000-gr-498671/p',
    source: 'vtex',
    source_updated_at: null,
    fetched_at: fetchedAt,
    match_quality: 'exact_ean',
    ...overrides,
  };
}

test('EAN validation and 24 hour stale policy', () => {
  assert.equal(isValidEan(EAN), true);
  assert.equal(isValidEan('1234567'), false);
  assert.equal(isMarketPricesStale(fetchedAt, fetchedAt + 23 * 60 * 60 * 1000), false);
  assert.equal(isMarketPricesStale(fetchedAt, fetchedAt + 24 * 60 * 60 * 1000), true);
  assert.equal(isMarketPricesStale(null), true);
});

test('fetchMarketPrices returns only exact EAN results with a valid price', async () => {
  const mock: typeof fetch = async () => new Response(JSON.stringify({
    ok: true,
    ean: EAN,
    fetched_at: fetchedAt,
    results: [
      row(),
      row({ ean: '7700000000000' }),
      row({ price_minor: 0 }),
    ],
  }), { status: 200 });
  const response = await fetchMarketPrices(EAN, mock, 'https://worker.test/market-prices');
  assert.equal(response.results.length, 1);
  assert.equal(response.results[0]?.price_minor, 22390);
  assert.equal(response.results[0]?.source_updated_at, null);
});

test('fetchMarketPrices reports HTTP failures', async () => {
  const mock: typeof fetch = async () => new Response('{}', { status: 429 });
  await assert.rejects(
    () => fetchMarketPrices(EAN, mock, 'https://worker.test/market-prices'),
    (error: unknown) => error instanceof MarketPricesError && error.kind === 'http' && error.status === 429,
  );
});

test('fetchMarketPrices classifies network failures as offline', async () => {
  const mock: typeof fetch = async () => { throw new TypeError('offline'); };
  await assert.rejects(
    () => fetchMarketPrices(EAN, mock, 'https://worker.test/market-prices'),
    (error: unknown) => error instanceof MarketPricesError && error.kind === 'offline',
  );
});

test('fetchMarketPrices rejects malformed responses', async () => {
  const mock: typeof fetch = async () => new Response(JSON.stringify({ ok: true, ean: EAN, results: [] }), { status: 200 });
  await assert.rejects(
    () => fetchMarketPrices(EAN, mock, 'https://worker.test/market-prices'),
    (error: unknown) => error instanceof MarketPricesError && error.kind === 'invalid_response',
  );
});

test('refresh failures preserve cached rows and report offline without cache', () => {
  assert.equal(marketPricesRefreshFailureStatus(true, 'offline'), 'stale');
  assert.equal(marketPricesRefreshFailureStatus(true, 'http'), 'stale');
  assert.equal(marketPricesRefreshFailureStatus(false, 'offline'), 'offline');
  assert.equal(marketPricesRefreshFailureStatus(false, 'http'), 'error');
});
