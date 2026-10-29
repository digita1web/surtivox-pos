export interface MarketPriceResult {
  ean: string;
  provider_id: string;
  supermarket_name: string;
  location: string | null;
  context_key: string;
  price_minor: number;
  currency_code: string;
  product_name: string;
  presentation: string | null;
  product_url: string | null;
  source: string;
  source_updated_at: number | null;
  fetched_at: number;
  match_quality: 'exact_ean';
}

export interface MarketPriceProviderError {
  provider_id: string;
  error: string;
}

export interface MarketPricesResponse {
  ok: boolean;
  ean: string;
  fetched_at: number;
  results: MarketPriceResult[];
  errors?: MarketPriceProviderError[];
}

export type MarketPriceErrorKind = 'offline' | 'timeout' | 'http' | 'invalid_response';

export class MarketPricesError extends Error {
  readonly kind: MarketPriceErrorKind;
  readonly status: number | null;

  constructor(kind: MarketPriceErrorKind, message: string, status: number | null = null) {
    super(message);
    this.name = 'MarketPricesError';
    this.kind = kind;
    this.status = status;
  }
}

export const MARKET_PRICES_TTL_MS = 24 * 60 * 60 * 1000;
export const MARKET_PRICES_URL = (
  process.env.EXPO_PUBLIC_MARKET_PRICES_URL
    || 'https://surtivox-market.surtivox.workers.dev/market-prices'
).replace(/\/+$/, '');

export function isValidEan(input: string | null | undefined): boolean {
  return /^\d{8,14}$/.test((input ?? '').trim());
}

export function marketEanForLookup(input: string | null | undefined): string | null {
  const value = (input ?? '').trim();
  return isValidEan(value) ? value : null;
}

export function createInFlightRequests<T>() {
  const requests = new Map<string, Promise<T>>();
  return {
    run(key: string, task: () => Promise<T>): Promise<T> {
      const current = requests.get(key);
      if (current) return current;
      const request = task().finally(() => {
        requests.delete(key);
      });
      requests.set(key, request);
      return request;
    },
  };
}

export function isMarketPricesStale(fetchedAt: number | null | undefined, now = Date.now(), ttlMs = MARKET_PRICES_TTL_MS): boolean {
  if (!fetchedAt || fetchedAt <= 0) return true;
  return now - fetchedAt >= ttlMs;
}

export function marketPricesRefreshFailureStatus(
  hasCachedRows: boolean,
  kind: MarketPriceErrorKind,
): 'stale' | 'offline' | 'error' {
  if (hasCachedRows) return 'stale';
  return kind === 'offline' ? 'offline' : 'error';
}

function normalizeResult(value: unknown, ean: string): MarketPriceResult | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const priceMinor = Number(row.price_minor);
  if (!Number.isSafeInteger(priceMinor) || priceMinor <= 0) return null;
  if (row.ean !== ean || row.match_quality !== 'exact_ean') return null;
  if (typeof row.provider_id !== 'string' || !row.provider_id.trim()) return null;
  if (typeof row.supermarket_name !== 'string' || !row.supermarket_name.trim()) return null;
  if (typeof row.product_name !== 'string' || !row.product_name.trim()) return null;
  if (row.currency_code !== 'COP') return null;
  const sourceUpdated = row.source_updated_at == null ? null : Number(row.source_updated_at);
  const resultFetched = Number(row.fetched_at);
  return {
    ean,
    provider_id: row.provider_id,
    supermarket_name: row.supermarket_name,
    location: typeof row.location === 'string' ? row.location : null,
    context_key: typeof row.context_key === 'string' && row.context_key ? row.context_key : 'online',
    price_minor: priceMinor,
    currency_code: 'COP',
    product_name: row.product_name,
    presentation: typeof row.presentation === 'string' ? row.presentation : null,
    product_url: typeof row.product_url === 'string' ? row.product_url : null,
    source: typeof row.source === 'string' ? row.source : 'vtex',
    source_updated_at: sourceUpdated !== null && Number.isFinite(sourceUpdated) ? sourceUpdated : null,
    fetched_at: Number.isFinite(resultFetched) && resultFetched > 0 ? resultFetched : 0,
    match_quality: 'exact_ean',
  };
}

export async function fetchMarketPrices(
  ean: string,
  fetcher: typeof fetch = fetch,
  endpoint = MARKET_PRICES_URL,
): Promise<MarketPricesResponse> {
  if (!isValidEan(ean)) throw new MarketPricesError('invalid_response', 'EAN inválido');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  let response: Response;
  try {
    response = await fetcher(`${endpoint}?ean=${encodeURIComponent(ean)}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (error) {
    const kind = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'offline';
    throw new MarketPricesError(kind, kind === 'timeout' ? 'La consulta tardó demasiado' : 'No hay conexión');
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new MarketPricesError('http', `El proveedor respondió ${response.status}`, response.status);
  }
  let payload: any;
  try {
    payload = await response.json();
  } catch {
    throw new MarketPricesError('invalid_response', 'La respuesta no es JSON válido');
  }
  if (!payload || payload.ok !== true || payload.ean !== ean || !Array.isArray(payload.results)) {
    throw new MarketPricesError('invalid_response', 'La respuesta del proveedor no es válida');
  }
  const fetchedAt = Number(payload.fetched_at);
  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) {
    throw new MarketPricesError('invalid_response', 'La respuesta no incluye una fecha válida');
  }
  const results = payload.results
    .map((value: unknown) => normalizeResult(value, ean))
    .filter((value: MarketPriceResult | null): value is MarketPriceResult => value !== null);
  return {
    ok: true,
    ean,
    fetched_at: fetchedAt,
    results,
    errors: Array.isArray(payload.errors) ? payload.errors as MarketPriceProviderError[] : [],
  };
}
