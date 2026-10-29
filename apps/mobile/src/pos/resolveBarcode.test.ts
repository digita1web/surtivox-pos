import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanProductName,
  isScaleCode,
  pickMarketName,
  resolveHints,
  withTimeout,
  type ResolveDependencies,
} from './resolveBarcode.ts';

const NOW = 1760000000000;

function marketRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mp1',
    ean: '7702511000045',
    provider_id: 'vtex:exitocol',
    supermarket_name: 'Éxito',
    location: null,
    context_key: 'online',
    price_minor: 4200,
    currency_code: 'COP',
    product_name: 'ARROZ DIANA',
    presentation: '500 g',
    product_url: 'https://example.test/p',
    source: 'vtex',
    source_updated_at: null,
    fetched_at: NOW,
    match_quality: 'exact_ean' as const,
    ...overrides,
  };
}

function fakeDeps(overrides: Partial<ResolveDependencies> = {}) {
  const calls = { refresh: 0, off: 0, saves: [] as unknown[] };
  const deps: ResolveDependencies = {
    getMarketPricesCache: async () => ({ rows: [], fetchedAt: null }),
    refreshMarketPrices: async () => {
      calls.refresh += 1;
      return { rows: [], fetchedAt: NOW, status: 'fresh', errors: [] };
    },
    getBarcodeLookup: async () => null,
    saveBarcodeLookup: async (input) => { calls.saves.push(input); },
    lookupBarcode: async () => {
      calls.off += 1;
      return { status: 'not_found' };
    },
    ...overrides,
  };
  return { deps, calls };
}

test('scale codes are identified before EAN lookups', async () => {
  assert.equal(isScaleCode('291104080027'), true);
  assert.equal(isScaleCode('2911040800271'), true);
  assert.equal(isScaleCode('7702511000045'), false);
  assert.equal(isScaleCode('29110408002'), false);
  assert.equal(isScaleCode('391104080027'), false);

  const { deps, calls } = fakeDeps();
  assert.equal(await resolveHints('291104080027', undefined, deps), null);
  assert.equal(calls.refresh, 0);
  assert.equal(calls.off, 0);
});

test('cleanProductName title-cases uppercase names and avoids duplicate presentations', () => {
  assert.equal(cleanProductName('ARROZ DIANA', '500 g'), 'Arroz Diana 500 g');
  assert.equal(cleanProductName('Arroz Diana 500 g', '500 g'), 'Arroz Diana 500 g');
  assert.equal(cleanProductName('  arroz   diana  ', null), 'arroz diana');
  assert.equal(cleanProductName('   ', '500 g'), undefined);
  assert.equal(cleanProductName('A'.repeat(70), null)?.length, 60);
});

test('pickMarketName chooses the most frequent non-generic name and breaks ties by length', () => {
  assert.equal(pickMarketName([
    { product_name: 'ARROZ DIANA', presentation: '500 g' },
    { product_name: 'Arroz Diana', presentation: '500 g' },
    { product_name: 'ARROZ DIANA', presentation: '500 g' },
  ]), 'Arroz Diana 500 g');

  assert.equal(pickMarketName([
    { product_name: 'Arroz', presentation: '500 g' },
    { product_name: 'Producto', presentation: null },
  ]), undefined);

  assert.equal(pickMarketName([
    { product_name: 'Arroz Diana', presentation: '500 g' },
    { product_name: 'Arroz Diana', presentation: '1 kg' },
  ]), 'Arroz Diana 1 kg');
});

test('resolveHints prioritizes the Worker name and keeps the OFF image', async () => {
  const { deps, calls } = fakeDeps({
    refreshMarketPrices: async () => ({
      rows: [
        marketRow(),
        marketRow({ id: 'mp2', supermarket_name: 'Jumbo', product_name: 'Arroz Diana', price_minor: 3900 }),
      ],
      fetchedAt: NOW,
      status: 'fresh',
      errors: [],
    }),
    lookupBarcode: async () => ({
      status: 'found',
      info: { name: 'OPEN FOOD RICE', imageUrl: 'https://example.test/rice.jpg' },
    }),
  });

  const hint = await resolveHints('7702511000045', undefined, deps);
  assert.equal(hint?.name, 'Arroz Diana 500 g');
  assert.equal(hint?.nameSource, 'market');
  assert.equal(hint?.imageUrl, 'https://example.test/rice.jpg');
  assert.equal(hint?.reference?.price_minor, 3900);
  assert.equal(calls.saves.length, 1);
  assert.partialDeepStrictEqual(calls.saves[0], {
    barcode: '7702511000045',
    status: 'found',
    name: 'Arroz Diana 500 g',
    imageUrl: 'https://example.test/rice.jpg',
    source: 'market',
  });
});

test('resolveHints falls back to the OFF name only when the Worker has no name', async () => {
  const { deps, calls } = fakeDeps({
    lookupBarcode: async () => ({
      status: 'found',
      info: { name: 'OPEN FOOD RICE', imageUrl: 'https://example.test/rice.jpg' },
    }),
  });

  const hint = await resolveHints('7702511000046', undefined, deps);
  assert.equal(hint?.name, 'Open Food Rice');
  assert.equal(hint?.nameSource, 'off');
  assert.equal(hint?.imageUrl, 'https://example.test/rice.jpg');
  assert.partialDeepStrictEqual(calls.saves[0], {
    barcode: '7702511000046',
    status: 'found',
    source: 'off',
  });
});

test('fresh local market data is returned without network calls', async () => {
  const { deps, calls } = fakeDeps({
    getMarketPricesCache: async () => ({
      rows: [marketRow()],
      fetchedAt: Date.now(),
    }),
  });

  const hint = await resolveHints('7702511000047', undefined, deps);
  assert.equal(hint?.name, 'Arroz Diana 500 g');
  assert.equal(hint?.reference?.price_minor, 4200);
  assert.equal(calls.refresh, 0);
  assert.equal(calls.off, 0);
});

test('not_found is cached only when both sources are validly empty', async () => {
  const first = fakeDeps();
  await resolveHints('7702511000048', undefined, first.deps);
  assert.partialDeepStrictEqual(first.calls.saves[0], {
    barcode: '7702511000048',
    status: 'not_found',
  });

  const second = fakeDeps({
    lookupBarcode: async () => ({ status: 'error', kind: 'offline' }),
  });
  await resolveHints('7702511000049', undefined, second.deps);
  assert.equal(second.calls.saves.length, 0);
});

test('a fresh negative cache avoids both network calls', async () => {
  const { deps, calls } = fakeDeps({
    getBarcodeLookup: async () => ({
      barcode: '7702511000050',
      status: 'not_found',
      name: null,
      image_url: null,
      source: null,
      checked_at: Date.now() - 24 * 60 * 60 * 1000,
    }),
  });

  assert.equal(await resolveHints('7702511000050', undefined, deps), null);
  assert.equal(calls.refresh, 0);
  assert.equal(calls.off, 0);
});

test('an expired negative cache retries both sources', async () => {
  const { deps, calls } = fakeDeps({
    getBarcodeLookup: async () => ({
      barcode: '7702511000051',
      status: 'not_found',
      name: null,
      image_url: null,
      source: null,
      checked_at: Date.now() - 15 * 24 * 60 * 60 * 1000,
    }),
  });

  await resolveHints('7702511000051', undefined, deps);
  assert.equal(calls.refresh, 1);
  assert.equal(calls.off, 1);
});

test('withTimeout rejects a pending operation', async () => {
  await assert.rejects(
    () => withTimeout(new Promise<never>(() => {}), 10),
    /timeout/,
  );
});

test('partial Worker errors prevent negative caching', async () => {
  const { deps, calls } = fakeDeps({
    refreshMarketPrices: async () => ({
      rows: [],
      fetchedAt: NOW,
      status: 'fresh',
      errors: [{ provider_id: 'vtex:exitocol', error: 'timeout' }],
    }),
  });

  assert.equal(await resolveHints('7702511000052', undefined, deps), null);
  assert.equal(calls.saves.length, 0);
});
