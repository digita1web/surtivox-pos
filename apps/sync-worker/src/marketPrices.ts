export interface VtexProvider {
  id: string;
  name: string;
  account: string;
  baseUrl: string;
  locale: string;
}

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

interface ProviderOutcome {
  provider_id: string;
  results: MarketPriceResult[];
  error: string | null;
}

export interface EdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

function getDefaultEdgeCache(): EdgeCache | undefined {
  return typeof caches !== 'undefined' ? caches.default : undefined;
}

function edgeCacheRequest(ean: string): Request {
  return new Request(`https://surtivox-market.internal/v1/market-prices?ean=${ean}`, { method: 'GET' });
}

export const MARKET_PROVIDERS: readonly VtexProvider[] = [
  { id: 'vtex:exitocol', name: 'Éxito', account: 'exitocol', baseUrl: 'https://www.exito.com', locale: 'es-CO' },
  { id: 'vtex:jumbocolombiaio', name: 'Jumbo', account: 'jumbocolombiaio', baseUrl: 'https://www.jumbocolombia.com', locale: 'es-CO' },
  { id: 'vtex:olimpica', name: 'Olímpica', account: 'olimpica', baseUrl: 'https://www.olimpica.com', locale: 'es-CO' },
];

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...extraHeaders },
  });
}

export function normalizeEan(input: string | null | undefined): string | null {
  const value = (input ?? '').trim();
  return /^\d{8,14}$/.test(value) ? value : null;
}

function presentationOf(name: string | null | undefined): string | null {
  const text = (name ?? '').trim();
  if (!text) return null;
  const parenthetical = text.match(/\(([^)]+)\)/);
  if (parenthetical?.[1] && /\d/.test(parenthetical[1])) return parenthetical[1].trim().replace(/\s+/g, ' ');
  const explicit = text.match(/(?:\bx|por)\s*([0-9.,]+\s*(?:kg|g|gr|ml|l|lb|un|und|unidades?|botellas?|pack|paquete))\b/i);
  if (explicit?.[1]) return explicit[1].trim().replace(/\s+/g, ' ');
  const size = text.match(/([0-9.,]+\s*(?:kg|g|gr|ml|l|lb|un|und|unidades?|botellas?|pack|paquete))\b/i);
  return size?.[1]?.trim().replace(/\s+/g, ' ') ?? null;
}

function offerPrice(item: any): number | null {
  const sellers = Array.isArray(item?.sellers) ? item.sellers : [];
  const seller = sellers.find((candidate: any) => candidate?.sellerDefault === true) ?? sellers[0];
  const raw = seller?.commertialOffer?.Price;
  const price = typeof raw === 'number' ? raw : Number.NaN;
  if (!Number.isFinite(price) || price <= 0) return null;
  const minor = Math.round(price);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

export function normalizeVtexProduct(
  provider: VtexProvider,
  product: any,
  ean: string,
  fetchedAt: number,
): MarketPriceResult | null {
  if (!product || !Array.isArray(product.items)) return null;
  const exact = product.items.find((item: any) => normalizeEan(item?.ean) === ean);
  if (!exact) return null;
  const priceMinor = offerPrice(exact);
  if (priceMinor === null) return null;
  const productName = typeof product.productName === 'string' && product.productName.trim()
    ? product.productName.trim()
    : String(exact.nameComplete ?? exact.name ?? '').trim();
  if (!productName) return null;
  let productUrl: string | null = null;
  if (typeof product.link === 'string' && product.link.trim()) {
    try {
      productUrl = new URL(product.link, provider.baseUrl).toString();
    } catch {
      productUrl = null;
    }
  }
  return {
    ean,
    provider_id: provider.id,
    supermarket_name: provider.name,
    location: null,
    context_key: 'online',
    price_minor: priceMinor,
    currency_code: 'COP',
    product_name: productName,
    presentation: presentationOf(productName),
    product_url: productUrl,
    source: 'vtex',
    source_updated_at: null,
    fetched_at: fetchedAt,
    match_quality: 'exact_ean',
  };
}

export async function fetchVtexProvider(
  provider: VtexProvider,
  ean: string,
  fetcher: typeof fetch = fetch,
  fetchedAt = Date.now(),
  timeoutMs = 8_000,
): Promise<ProviderOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://${provider.account}.vtexcommercestable.com.br/api/intelligent-search/v1/products?field=ean&value=${encodeURIComponent(ean)}&locale=${provider.locale}&sc=1`;
    const response = await fetcher(url, {
      method: 'GET',
      headers: { accept: 'application/json', 'user-agent': 'SurtivoxPOS/1.0' },
      signal: controller.signal,
    });
    if (response.status === 404) return { provider_id: provider.id, results: [], error: null };
    if (!response.ok) return { provider_id: provider.id, results: [], error: `HTTP ${response.status}` };
    const payload = await response.json();
    const products = Array.isArray(payload) ? payload : [payload];
    const results = products
      .map((product) => normalizeVtexProduct(provider, product, ean, fetchedAt))
      .filter((result): result is MarketPriceResult => result !== null);
    return { provider_id: provider.id, results, error: null };
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network_error';
    return { provider_id: provider.id, results: [], error: message };
  } finally {
    clearTimeout(timer);
  }
}

function rateAllowed(req: Request, now: number): boolean {
  const key = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? 'local';
  const bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_MAX) return false;
  bucket.count += 1;
  return true;
}

export async function handleMarketPrices(
  req: Request,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
  cache: EdgeCache | undefined = getDefaultEdgeCache(),
): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
  const ean = normalizeEan(new URL(req.url).searchParams.get('ean'));
  if (!ean) return json({ ok: false, error: 'ean_must_be_8_to_14_digits' }, 400);
  if (!rateAllowed(req, now)) return json({ ok: false, error: 'rate_limited' }, 429);
  const cacheKey = edgeCacheRequest(ean);
  if (cache) {
    let cached: Response | undefined;
    try {
      cached = await cache.match(cacheKey);
    } catch {
      cached = undefined;
    }
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set('x-surtivox-cache', 'HIT');
      return new Response(cached.body, { status: cached.status, headers });
    }
  }
  const outcomes = await Promise.all(
    MARKET_PROVIDERS.map((provider) => fetchVtexProvider(provider, ean, fetcher, now)),
  );
  const results = outcomes.flatMap((outcome) => outcome.results);
  const errors = outcomes
    .filter((outcome) => outcome.error !== null)
    .map((outcome) => ({ provider_id: outcome.provider_id, error: outcome.error }));
  if (results.length === 0 && errors.length > 0) {
    return json({ ok: false, error: 'upstream_unavailable', errors }, 502);
  }
  const response = json(
    { ok: true, ean, fetched_at: now, results, errors },
    200,
    { 'cache-control': 'public, max-age=600', 'x-surtivox-cache': 'MISS' },
  );
  if (cache && errors.length === 0) {
    try {
      await cache.put(cacheKey, response.clone());
    } catch {
      console.warn('No se pudo guardar la respuesta VTEX en la caché de borde');
    }
  }
  return response;
}
