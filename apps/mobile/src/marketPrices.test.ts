import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MARKET_PRICES_URL, createInFlightRequests, fetchMarketPrices, isMarketPricesStale,
  isValidEan, marketEanForLookup, marketPricesRefreshFailureStatus, MarketPricesError,
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

test('default endpoint targets the Surtivox market Worker', () => {
  assert.equal(MARKET_PRICES_URL, 'https://surtivox-market.surtivox.workers.dev/market-prices');
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

test('market lookup accepts only valid EANs and never internal codes', () => {
  assert.equal(marketEanForLookup(' 7702511000045 '), EAN);
  assert.equal(marketEanForLookup('12345678'), '12345678');
  assert.equal(marketEanForLookup('12345678901234'), '12345678901234');
  assert.equal(marketEanForLookup('INT-001'), null);
  assert.equal(marketEanForLookup(''), null);
  assert.equal(marketEanForLookup('1234567'), null);
  assert.equal(marketEanForLookup('123456789012345'), null);
});

test('fetchMarketPrices constructs the EAN query URL and accepts no results', async () => {
  let requested = '';
  const mock: typeof fetch = async (url) => {
    requested = String(url);
    return new Response(JSON.stringify({ ok: true, ean: EAN, fetched_at: fetchedAt, results: [] }), { status: 200 });
  };
  const response = await fetchMarketPrices(EAN, mock, 'https://worker.test/market-prices');
  assert.equal(requested, `https://worker.test/market-prices?ean=${EAN}`);
  assert.deepEqual(response.results, []);
});

test('in-flight requests for the same EAN are shared and cleaned up', async () => {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const requests = createInFlightRequests<number>();
  const task = async () => { calls += 1; await gate; return 7; };
  const first = requests.run('same-ean', task);
  const second = requests.run('same-ean', task);
  assert.strictEqual(first, second);
  assert.equal(calls, 1);
  release();
  assert.equal(await first, 7);
  assert.equal(await second, 7);
  assert.equal(await requests.run('same-ean', async () => { calls += 1; return 8; }), 8);
  assert.equal(calls, 2);
});
