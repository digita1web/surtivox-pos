import { createInFlightRequests, isMarketPricesStale, isValidEan } from '../marketPrices.ts';
import { lowestMarketPrice } from '../marketPriceSummary.ts';
import type { BarcodeLookupOutcome } from './lookup';
import type {
  BarcodeLookupRow,
  MarketPriceRow,
  MarketPricesCache,
  MarketPricesRefresh,
} from '../repos';

const NEGATIVE_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MARKET_TIMEOUT_MS = 3000;
const OFF_TIMEOUT_MS = 2500;
const TIMEOUT_MESSAGE = 'timeout';

const GENERIC_NAMES = new Set([
  'producto',
  'productos',
  'articulo',
  'artículo',
  'item',
  'oferta',
  'promocion',
  'promoción',
  'arroz',
  'leche',
  'pan',
  'aceite',
  'azucar',
  'azúcar',
  'sal',
  'cafe',
  'café',
  'bebida',
  'gaseosa',
  'cerveza',
  'jabon',
  'jabón',
]);

export interface ResolveReference {
  supermarket_name: string;
  price_minor: number;
}

export interface ResolveHint {
  name?: string;
  imageUrl?: string;
  nameSource?: 'market' | 'off';
  nameProvider?: string;
  reference?: ResolveReference;
}

export interface BarcodeLookupSaveInput {
  barcode: string;
  status: 'found' | 'not_found';
  name?: string | null;
  imageUrl?: string | null;
  source?: 'market' | 'off' | null;
  checkedAt?: number;
}

export interface ResolveDependencies {
  getMarketPricesCache(ean: string): Promise<MarketPricesCache>;
  refreshMarketPrices(ean: string): Promise<MarketPricesRefresh>;
  getBarcodeLookup(barcode: string): Promise<BarcodeLookupRow | null>;
  saveBarcodeLookup(input: BarcodeLookupSaveInput): Promise<void>;
  lookupBarcode(barcode: string, signal?: AbortSignal): Promise<BarcodeLookupOutcome>;
}

interface NameRow {
  product_name: string;
  presentation?: string | null;
}

export function isScaleCode(code: string): boolean {
  return /^2\d{11,12}$/.test(code.trim());
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (run: () => void) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      run();
    };
    const abort = () => finish(() => reject(new Error('aborted')));
    timer = setTimeout(() => finish(() => reject(new Error(TIMEOUT_MESSAGE))), ms);
    if (signal) {
      if (signal.aborted) {
        finish(() => reject(new Error('aborted')));
        return;
      }
      signal.addEventListener('abort', abort);
    }
    promise.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    );
  });
}

function titleCase(value: string): string {
  return value
    .toLocaleLowerCase('es-CO')
    .replace(/(^|[\s\-/])([a-záéíóúüñ])/g, (_match, prefix: string, letter: string) =>
      `${prefix}${letter.toLocaleUpperCase('es-CO')}`,
    );
}

export function cleanProductName(
  raw: string | null | undefined,
  presentation?: string | null,
): string | undefined {
  const text = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return undefined;

  let name = text === text.toUpperCase() ? titleCase(text) : text;
  const cleanPresentation = (presentation ?? '').trim().replace(/\s+/g, ' ');
  if (
    cleanPresentation &&
    !name.toLocaleLowerCase('es-CO').includes(cleanPresentation.toLocaleLowerCase('es-CO'))
  ) {
    name = `${name} ${cleanPresentation}`;
  }
  name = name.slice(0, 60).trim();
  return name || undefined;
}

export function pickMarketName(rows: readonly NameRow[]): string | undefined {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const rawName = cleanProductName(row.product_name);
    if (!rawName) continue;
    const single = rawName.split(/\s+/);
    if (single.length === 1 && GENERIC_NAMES.has(single[0]!.toLocaleLowerCase('es-CO'))) continue;
    const name = cleanProductName(row.product_name, row.presentation);
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  let best: { name: string; count: number } | null = null;
  for (const [name, count] of counts) {
    if (
      !best ||
      count > best.count ||
      (count === best.count && name.length < best.name.length) ||
      (count === best.count && name.length === best.name.length && name < best.name)
    ) {
      best = { name, count };
    }
  }
  return best?.name;
}

function hintFromMarketRows(rows: readonly MarketPriceRow[]): ResolveHint | null {
  if (rows.length === 0) return null;
  const name = pickMarketName(rows);
  const lowest = lowestMarketPrice(rows);
  if (!name && !lowest) return null;
  const sourceRow = name
    ? rows.find((row) => cleanProductName(row.product_name, row.presentation) === name)
    : undefined;
  return {
    ...(name ? { name, nameSource: 'market' as const } : {}),
    ...(sourceRow ? { nameProvider: sourceRow.supermarket_name } : {}),
    ...(lowest ? { reference: lowest } : {}),
  };
}

async function defaultDependencies(): Promise<ResolveDependencies> {
  const [repos, lookup] = await Promise.all([import('../repos'), import('./lookup')]);
  return {
    getMarketPricesCache: repos.getMarketPricesCache,
    refreshMarketPrices: (ean) => repos.refreshMarketPrices(ean),
    getBarcodeLookup: repos.getBarcodeLookup,
    saveBarcodeLookup: repos.saveBarcodeLookup,
    lookupBarcode: lookup.lookupBarcode,
  };
}

async function resolveUncached(
  code: string,
  signal: AbortSignal | undefined,
  deps: ResolveDependencies,
): Promise<ResolveHint | null> {
  const [marketCache, local] = await Promise.all([
    deps.getMarketPricesCache(code),
    deps.getBarcodeLookup(code),
  ]);
  if (signal?.aborted) return null;

  const cachedHint = hintFromMarketRows(marketCache.rows);
  if (cachedHint) {
    if (isMarketPricesStale(marketCache.fetchedAt)) {
      void deps.refreshMarketPrices(code).catch(() => {});
    }
    return cachedHint;
  }

  if (local?.status === 'found') {
    const name = cleanProductName(local.name);
    const imageUrl = local.image_url ?? undefined;
    if (name || imageUrl) {
      return {
        ...(name ? { name } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(local.source ? { nameSource: local.source } : {}),
      };
    }
  }

  if (local?.status === 'not_found' && Date.now() - local.checked_at < NEGATIVE_CACHE_TTL_MS) {
    return null;
  }

  const [marketResult, offResult] = await Promise.allSettled([
    withTimeout(deps.refreshMarketPrices(code), MARKET_TIMEOUT_MS, signal),
    withTimeout(deps.lookupBarcode(code, signal), OFF_TIMEOUT_MS, signal),
  ]);
  if (signal?.aborted) return null;

  const market = marketResult.status === 'fulfilled' ? marketResult.value : null;
  const off = offResult.status === 'fulfilled' ? offResult.value : null;
  const marketHint = market ? hintFromMarketRows(market.rows) : null;
  const offInfo = off?.status === 'found' ? off.info : undefined;
  const offName = cleanProductName(offInfo?.name);
  const name = marketHint?.name ?? offName;
  const imageUrl = offInfo?.imageUrl;
  const nameSource = marketHint?.name ? 'market' : offName ? 'off' : undefined;
  const result: ResolveHint = {
    ...(name ? { name } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(nameSource ? { nameSource } : {}),
    ...(marketHint?.nameProvider ? { nameProvider: marketHint.nameProvider } : {}),
    ...(marketHint?.reference ? { reference: marketHint.reference } : {}),
  };

  if (name || imageUrl) {
    await deps.saveBarcodeLookup({
      barcode: code,
      status: 'found',
      name: name ?? null,
      imageUrl: imageUrl ?? null,
      source: nameSource ?? (imageUrl ? 'off' : null),
      checkedAt: Date.now(),
    });
    return result;
  }

  const marketValidEmpty =
    market !== null &&
    market.status === 'fresh' &&
    market.rows.length === 0 &&
    market.errors.length === 0;
  const offValidEmpty = off?.status === 'not_found';

  if (marketValidEmpty && offValidEmpty) {
    await deps.saveBarcodeLookup({
      barcode: code,
      status: 'not_found',
      checkedAt: Date.now(),
    });
  }

  return result.reference ? result : null;
}

const barcodeRequests = createInFlightRequests<ResolveHint | null>();

export function resolveHints(
  code: string,
  signal?: AbortSignal,
  deps?: ResolveDependencies,
): Promise<ResolveHint | null> {
  const value = code.trim();
  if (isScaleCode(value) || !isValidEan(value)) return Promise.resolve(null);

  return barcodeRequests.run(value, async () => {
    const actual = deps ?? (await defaultDependencies());
    return resolveUncached(value, signal, actual);
  });
}
