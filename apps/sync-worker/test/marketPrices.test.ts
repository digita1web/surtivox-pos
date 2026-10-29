import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MARKET_PROVIDERS, fetchVtexProvider, handleMarketPrices, normalizeEan, normalizeVtexProduct,
  type EdgeCache,
} from '../src/marketPrices.ts';

const EAN = '7702511000045';
const fetchedAt = 1760000000000;

class MemoryEdgeCache implements EdgeCache {
  private readonly items = new Map<string, Response>();

  async match(request: Request): Promise<Response | undefined> {
    return this.items.get(request.url)?.clone();
  }

  async put(request: Request, response: Response): Promise<void> {
    this.items.set(request.url, response.clone());
  }
}

function vtexProduct(ean = EAN, price: number | null = 22390) {
  return {
    productName: 'Arroz DIANA blanco vitamor (5000  gr)',
    link: '/arroz-diana-5000-gr-498671/p',
    items: [{
      ean,
      name: 'Arroz DIANA blanco vitamor (5000 gr)',
      sellers: [{ sellerDefault: true, commertialOffer: { Price: price } }],
    }],
  };
}

test('normalizeEan accepts only 8 to 14 digits', () => {
  assert.equal(normalizeEan(' 7702511000045 '), EAN);
  assert.equal(normalizeEan('12345678'), '12345678');
  assert.equal(normalizeEan('1234567'), null);
  assert.equal(normalizeEan('7702511000045x'), null);
  assert.equal(normalizeEan(''), null);
});

test('VTEX normalization keeps only an exact EAN match and a valid price', () => {
  const row = normalizeVtexProduct(MARKET_PROVIDERS[0]!, vtexProduct(), EAN, fetchedAt);
  assert.ok(row);
  assert.equal(row.ean, EAN);
  assert.equal(row.price_minor, 22390);
  assert.equal(row.currency_code, 'COP');
  assert.equal(row.match_quality, 'exact_ean');
  assert.equal(row.product_url, 'https://www.exito.com/arroz-diana-5000-gr-498671/p');
  assert.equal(row.presentation, '5000 gr');
  assert.equal(row.source_updated_at, null);
});

test('VTEX normalization rejects a different EAN even when the product name is similar', () => {
  const row = normalizeVtexProduct(MARKET_PROVIDERS[0]!, vtexProduct('7700000000000'), EAN, fetchedAt);
  assert.equal(row, null);
});

test('VTEX normalization rejects missing or invalid prices', () => {
  assert.equal(normalizeVtexProduct(MARKET_PROVIDERS[0]!, vtexProduct(EAN, null), EAN, fetchedAt), null);
  assert.equal(normalizeVtexProduct(MARKET_PROVIDERS[0]!, vtexProduct(EAN, 0), EAN, fetchedAt), null);
});

test('provider lookup treats 404 as no results and 429 as a provider error', async () => {
  const notFound: typeof fetch = async () => new Response('{"error":"PRODUCT_NOT_FOUND"}', { status: 404 });
  const limited: typeof fetch = async () => new Response('{}', { status: 429 });
  const empty = await fetchVtexProvider(MARKET_PROVIDERS[0]!, EAN, notFound, fetchedAt);
  const error = await fetchVtexProvider(MARKET_PROVIDERS[0]!, EAN, limited, fetchedAt);
  assert.deepEqual(empty, { provider_id: 'vtex:exitocol', results: [], error: null });
  assert.equal(error.error, 'HTTP 429');
});

test('market route validates EAN and returns normalized results', async () => {
  const mock: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('exitocol')) return new Response(JSON.stringify(vtexProduct()), { status: 200 });
    return new Response('{"error":"PRODUCT_NOT_FOUND"}', { status: 404 });
  };
  const invalid = await handleMarketPrices(
    new Request('https://worker.test/market-prices?ean=abc'),
    mock,
  );
  assert.equal(invalid.status, 400);
  const response = await handleMarketPrices(
    new Request(`https://worker.test/market-prices?ean=${EAN}`, { headers: { 'cf-connecting-ip': 'route-test' } }),
    mock,
    fetchedAt,
  );
  assert.equal(response.status, 200);
  const body = await response.json() as any;
  assert.equal(body.ean, EAN);
  assert.equal(body.results.length, 1);
  assert.equal(body.results[0].price_minor, 22390);
});

test('market route returns 502 when every provider fails', async () => {
  const mock: typeof fetch = async () => new Response('{}', { status: 500 });
  const response = await handleMarketPrices(
    new Request(`https://worker.test/market-prices?ean=${EAN}`, { headers: { 'cf-connecting-ip': 'failure-test' } }),
    mock,
    fetchedAt,
  );
  assert.equal(response.status, 502);
});

test('market route preserves the error response when a provider fails and nothing is found', async () => {
  const mock: typeof fetch = async (input) => {
    if (String(input).includes('exitocol')) return new Response('{}', { status: 500 });
    return new Response('{"error":"PRODUCT_NOT_FOUND"}', { status: 404 });
  };
  const response = await handleMarketPrices(
    new Request(`https://worker.test/market-prices?ean=${EAN}`, { headers: { 'cf-connecting-ip': 'partial-test' } }),
    mock,
    fetchedAt,
  );
  assert.equal(response.status, 502);
});

test('market route rate limits repeated requests by client', async () => {
  const mock: typeof fetch = async () => new Response('{"error":"PRODUCT_NOT_FOUND"}', { status: 404 });
  const key = `rate-${Date.now()}-${Math.random()}`;
  let last: Response | null = null;
  for (let i = 0; i < 31; i += 1) {
    last = await handleMarketPrices(
      new Request(`https://worker.test/market-prices?ean=${EAN}`, { headers: { 'cf-connecting-ip': key } }),
      mock,
      fetchedAt,
    );
  }
  assert.equal(last?.status, 429);
});

test('successful EAN responses are cached at the edge and reused', async () => {
  let upstreamCalls = 0;
  const mock: typeof fetch = async () => {
    upstreamCalls += 1;
    return new Response(JSON.stringify(vtexProduct()), { status: 200 });
  };
  const cache = new MemoryEdgeCache();
  const key = `cache-${Date.now()}-${Math.random()}`;
  const request = () => new Request(`https://worker.test/market-prices?ean=${EAN}`, {
    headers: { 'cf-connecting-ip': key },
  });
  const first = await handleMarketPrices(request(), mock, fetchedAt, cache);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('x-surtivox-cache'), 'MISS');
  assert.equal(upstreamCalls, 3);
  const second = await handleMarketPrices(request(), mock, fetchedAt + 1, cache);
  assert.equal(second.status, 200);
  assert.equal(second.headers.get('x-surtivox-cache'), 'HIT');
  assert.equal(upstreamCalls, 3);
});

test('partial provider failures are not cached and are retried', async () => {
  let upstreamCalls = 0;
  const mock: typeof fetch = async (input) => {
    upstreamCalls += 1;
    if (String(input).includes('exitocol')) return new Response(JSON.stringify(vtexProduct()), { status: 200 });
    return new Response('{}', { status: 500 });
  };
  const cache = new MemoryEdgeCache();
  const key = `partial-cache-${Date.now()}-${Math.random()}`;
  const request = () => new Request(`https://worker.test/market-prices?ean=${EAN}`, {
    headers: { 'cf-connecting-ip': key },
  });
  const first = await handleMarketPrices(request(), mock, fetchedAt, cache);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('x-surtivox-cache'), 'MISS');
  assert.equal(upstreamCalls, 3);
  const second = await handleMarketPrices(request(), mock, fetchedAt + 1, cache);
  assert.equal(second.status, 200);
  assert.equal(upstreamCalls, 6);
});
