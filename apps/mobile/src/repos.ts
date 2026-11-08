/**
 * Repositories: the ONLY place that talks SQL. All money math is delegated to
 * @surtivox/pos-core; screens never compute totals themselves.
 */
import {
  suggestReorder,
  type Minor,
  type SalesPoint,
} from '@surtivox/pos-core';
import { getDb } from './db';
import { currencyConfigFor } from './branding';
import { newId, DEVICE_ID } from './id';
import { voidSaleOn } from './saleOps';
import { checkoutSaleOn, recordCustomerPaymentOn, type CheckoutLine, type CheckoutOptions, type Receipt } from './checkoutOps';
import { reportSummaryOn, type ReportSummary } from './reportOps';
import { getSaleOn, processReturnOn, type SaleDetail, type ReturnPick, type RefundMethod, type ReturnReceipt } from './returnOps';
import { seedColombianCatalog as runSeedCatalog, type SeedResult } from './seedCatalog';
import { createInFlightRequests, fetchMarketPrices, isMarketPricesStale, marketPricesRefreshFailureStatus, MarketPricesError, type MarketPriceErrorKind, type MarketPriceProviderError, type MarketPriceResult } from './marketPrices';
import { type Role, hashPin, verifyPin } from './roles';
import * as Crypto from 'expo-crypto';
import { createStaffOn, updateStaffOn, deleteStaffOn, attemptPinOn, lockRetryAtOn, type StaffDeps, type PinAttempt } from './staffOps';
import { setupRecoveryOn, hasRecoveryOn, resetPinWithRecoveryOn, type RecoveryDeps, type RecoveryResult } from './recoveryOps';
import { defaultDraftName, draftCost, tracksInventory } from './pos/stockPolicy';

export type ReceiptPaper = 'a4' | 'thermal80' | 'thermal58';

export interface Store {
  id: string;
  name: string;
  currency_code: string;
  currency_locale: string;
  currency_decimals: number;
  // Shop profile + receipt look. All optional; NULL means "use the default".
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  tax_id?: string | null;
  tagline?: string | null;
  logo_uri?: string | null;
  receipt_footer?: string | null;
  receipt_terms?: string | null;
  receipt_accent?: string | null;
  receipt_paper?: ReceiptPaper | null;
  receipt_show_logo?: number | null;
  receipt_show_contact?: number | null;
  receipt_show_staff?: number | null;
}

/** The editable subset of Store (everything except identity + currency). */
export interface StoreProfile {
  name: string;
  address: string; phone: string; email: string; website: string; taxId: string; tagline: string;
  logoUri: string | null;
  receiptFooter: string; receiptTerms: string; receiptAccent: string;
  receiptPaper: ReceiptPaper;
  showLogo: boolean; showContact: boolean; showStaff: boolean;
}

export const DEFAULT_RECEIPT_ACCENT = '#087f5b';
export const DEFAULT_RECEIPT_FOOTER = '¡Gracias por su compra!\n¡Vuelva pronto!';

export function profileOf(s: Store): StoreProfile {
  return {
    name: s.name, address: s.address ?? '', phone: s.phone ?? '', email: s.email ?? '', website: s.website ?? '',
    taxId: s.tax_id ?? '', tagline: s.tagline ?? '', logoUri: s.logo_uri ?? null,
    receiptFooter: s.receipt_footer ?? '', receiptTerms: s.receipt_terms ?? '',
    receiptAccent: s.receipt_accent ?? DEFAULT_RECEIPT_ACCENT,
    receiptPaper: s.receipt_paper ?? 'a4',
    showLogo: (s.receipt_show_logo ?? 1) === 1, showContact: (s.receipt_show_contact ?? 1) === 1, showStaff: (s.receipt_show_staff ?? 1) === 1,
  };
}

const clean = (v: string) => v.trim() || null;

export interface Product {
  id: string;
  name: string;
  barcode: string | null;
  image_uri: string | null;
  selling_price: number;
  cost_price: number;
  tax_bps: number;
  stock: number;
  track_inventory?: number;
  sku?: string | null;
  unit?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  low_stock_threshold?: number | null;
  isQuick?: boolean; // true for ad-hoc "quick sale" lines with no catalog product
}

export type { PaymentMethod, CheckoutProduct, CheckoutLine, CheckoutOptions, Receipt } from './checkoutOps';
export type { SaleHeader, SaleItemRow, SaleDetail, RefundMethod, ReturnPick, ReturnReceipt } from './returnOps';

const PRODUCT_SELECT = `
  SELECT p.id, p.name, p.barcode, p.image_uri, p.selling_price, p.cost_price, p.tax_bps,
         p.track_inventory, p.sku, p.unit, p.category_id, p.low_stock_threshold, c.name AS category_name,
         COALESCE((SELECT SUM(sm.quantity_delta) FROM stock_movements sm WHERE sm.product_id = p.id), 0) AS stock
  FROM products p LEFT JOIN categories c ON c.id = p.category_id`;

/** Stock level at or below which a product counts as "low" (per-product, default 5). */
export const DEFAULT_LOW_STOCK = 5;
export const isLowStock = (p: Pick<Product, 'stock' | 'low_stock_threshold' | 'track_inventory'>) =>
  tracksInventory(p) && p.stock > 0 && p.stock <= (p.low_stock_threshold ?? DEFAULT_LOW_STOCK);

async function normalizedStore(store: Store): Promise<Store> {
  return store;
}

/** The shop currently in use on this device (multi-shop aware). */
export async function getStore(): Promise<Store | null> {
  const db = getDb();
  const ptr = await db.getFirstAsync<{ current_store_id: string | null }>('SELECT current_store_id FROM app_state WHERE id=1');
  if (ptr?.current_store_id) {
    const s = await db.getFirstAsync<Store>('SELECT * FROM stores WHERE id=?', [ptr.current_store_id]);
    if (s) return normalizedStore(s);
  }
  // No/stale pointer: fall back to the oldest shop and adopt it as current.
  const first = await db.getFirstAsync<Store>('SELECT * FROM stores ORDER BY created_at LIMIT 1');
  if (first) await db.runAsync('UPDATE app_state SET current_store_id=? WHERE id=1', [first.id]);
  return first ? normalizedStore(first) : null;
}

/** All shops on this device, oldest first. */
export async function listStores(): Promise<Store[]> {
  return getDb().getAllAsync<Store>('SELECT * FROM stores ORDER BY created_at');
}

/** Point the device at a different shop. */
export async function setCurrentStore(id: string): Promise<void> {
  await getDb().runAsync('UPDATE app_state SET current_store_id=? WHERE id=1', [id]);
}

export async function createStore(
  name: string,
  currency: { code: string; locale: string; decimals: number },
  profile: Partial<StoreProfile> = {},
): Promise<Store> {
  const id = newId();
  const now = Date.now();
  const p = profile;
  await getDb().runAsync(
    `INSERT INTO stores (id,name,currency_code,currency_locale,currency_decimals,
        address,phone,email,website,tax_id,tagline,logo_uri,
        receipt_footer,receipt_terms,receipt_accent,receipt_paper,receipt_show_logo,receipt_show_contact,receipt_show_staff,
        created_at,updated_at,device_id,version)
     VALUES (?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?,1)`,
    [id, name, currency.code, currency.locale, currency.decimals,
      clean(p.address ?? ''), clean(p.phone ?? ''), clean(p.email ?? ''), clean(p.website ?? ''), clean(p.taxId ?? ''), clean(p.tagline ?? ''), p.logoUri ?? null,
      clean(p.receiptFooter ?? ''), clean(p.receiptTerms ?? ''), p.receiptAccent ?? null, p.receiptPaper ?? 'a4',
      p.showLogo === false ? 0 : 1, p.showContact === false ? 0 : 1, p.showStaff === false ? 0 : 1,
      now, now, DEVICE_ID],
  );
  await setCurrentStore(id); // a newly created shop becomes the active one
  return (await getDb().getFirstAsync<Store>('SELECT * FROM stores WHERE id=?', [id]))!;
}

/** Save the shop profile + receipt look. Bumps version so it syncs. */
export async function updateStoreProfile(storeId: string, p: StoreProfile): Promise<Store> {
  if (!p.name.trim()) throw new Error('El nombre de la tienda es obligatorio');
  await getDb().runAsync(
    `UPDATE stores SET name=?, address=?, phone=?, email=?, website=?, tax_id=?, tagline=?, logo_uri=?,
        receipt_footer=?, receipt_terms=?, receipt_accent=?, receipt_paper=?,
        receipt_show_logo=?, receipt_show_contact=?, receipt_show_staff=?,
        updated_at=?, version=version+1 WHERE id=?`,
    [p.name.trim(), clean(p.address), clean(p.phone), clean(p.email), clean(p.website), clean(p.taxId), clean(p.tagline), p.logoUri,
      clean(p.receiptFooter), clean(p.receiptTerms), p.receiptAccent || null, p.receiptPaper,
      p.showLogo ? 1 : 0, p.showContact ? 1 : 0, p.showStaff ? 1 : 0, Date.now(), storeId],
  );
  return (await getStore())!;
}

export async function updateAllStoreCurrencies(code: string): Promise<void> {
  const config = currencyConfigFor(code);
  await getDb().runAsync(
    'UPDATE stores SET currency_code=?, currency_locale=?, currency_decimals=?, updated_at=?, version=version+1',
    [config.code, config.locale, 0, Date.now()],
  );
}

/* ------------------------------ categories ------------------------------ */

export interface Category { id: string; name: string }

export async function listCategories(storeId: string): Promise<Category[]> {
  return getDb().getAllAsync<Category>(
    'SELECT id, name FROM categories WHERE store_id=? ORDER BY sort_order, name', [storeId],
  );
}

/** Returns the existing category with this name (case-insensitive) or creates it. */
export async function ensureCategory(storeId: string, name: string): Promise<string> {
  const n = name.trim();
  if (!n) throw new Error('El nombre de la categoría es obligatorio');
  const db = getDb();
  const hit = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM categories WHERE store_id=? AND lower(name)=lower(?)', [storeId, n]);
  if (hit) return hit.id;
  const id = newId();
  const now = Date.now();
  const order = (await db.getFirstAsync<{ m: number | null }>('SELECT MAX(sort_order) AS m FROM categories WHERE store_id=?', [storeId]))?.m ?? 0;
  await db.runAsync(
    `INSERT INTO categories (id,store_id,name,sort_order,created_at,updated_at,device_id,version) VALUES (?,?,?,?,?,?,?,1)`,
    [id, storeId, n, order + 1, now, now, DEVICE_ID]);
  return id;
}

export async function listProducts(storeId: string): Promise<Product[]> {
  return getDb().getAllAsync<Product>(
    `${PRODUCT_SELECT}
     WHERE p.store_id = ? AND p.active = 1 AND p.deleted_at IS NULL
     ORDER BY p.name`,
    [storeId],
  );
}

export async function listProductsToReview(storeId: string): Promise<Product[]> {
  return getDb().getAllAsync<Product>(
    `${PRODUCT_SELECT}
     JOIN product_review pr ON pr.product_id = p.id
     WHERE p.store_id = ? AND p.active = 1 AND p.deleted_at IS NULL
     ORDER BY pr.created_at DESC, p.name`,
    [storeId],
  );
}

export async function countProductsToReview(storeId: string): Promise<number> {
  const row = await getDb().getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c
     FROM product_review pr
     JOIN products p ON p.id = pr.product_id
     WHERE p.store_id = ? AND p.active = 1 AND p.deleted_at IS NULL`,
    [storeId],
  );
  return row?.c ?? 0;
}

/** Look up a product by scanned barcode. Null if no active product matches. */
export async function findProductByBarcode(storeId: string, barcode: string): Promise<Product | null> {
  return (
    (await getDb().getFirstAsync<Product>(
      `${PRODUCT_SELECT}
       WHERE p.store_id = ? AND p.barcode = ? AND p.active = 1 AND p.deleted_at IS NULL
       LIMIT 1`,
      [storeId, barcode],
    )) ?? null
  );
}

export async function createProduct(input: {
  storeId: string;
  name: string;
  barcode?: string | null;
  imageUri?: string | null;
  sellingPrice: Minor;
  costPrice: Minor;
  taxBps: number;
  openingStock: number;
  sku?: string | null;
  unit?: string | null;
  categoryId?: string | null;
  lowStockThreshold?: number | null;
}): Promise<string> {
  const db = getDb();
  const id = newId();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO products (id,store_id,category_id,name,sku,barcode,image_uri,cost_price,selling_price,unit,track_inventory,low_stock_threshold,tax_bps,active,created_at,updated_at,device_id,version)
       VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?,1,?,?,?,1)`,
      [id, input.storeId, input.categoryId ?? null, input.name, input.sku?.trim() || null, input.barcode?.trim() || null, input.imageUri || null,
        input.costPrice, input.sellingPrice, input.unit?.trim() || 'unit', input.lowStockThreshold ?? null, input.taxBps, now, now, DEVICE_ID],
    );
    if (input.openingStock > 0) {
      await db.runAsync(
        `INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,reference_type,note,created_at,device_id)
         VALUES (?,?,?,'opening_stock',?, 'opening', 'initial stock', ?, ?)`,
        [newId(), input.storeId, id, input.openingStock, now, DEVICE_ID],
      );
    }
  });
  return id;
}

export async function createDraftProduct(input: {
  storeId: string;
  barcode: string;
  name?: string | null;
  sellingPrice: Minor;
  costPrice?: Minor;
}): Promise<Product> {
  const barcode = input.barcode.trim();
  if (!barcode) throw new Error('El código de barras es obligatorio');
  if (input.sellingPrice <= 0) throw new Error('El precio debe ser mayor que 0');

  const db = getDb();
  const id = newId();
  const now = Date.now();
  let existing: Product | null = null;

  await db.withTransactionAsync(async () => {
    existing = await db.getFirstAsync<Product>(
      `${PRODUCT_SELECT}
       WHERE p.store_id = ? AND p.barcode = ? AND p.active = 1 AND p.deleted_at IS NULL
       LIMIT 1`,
      [input.storeId, barcode],
    );
    if (existing) return;

    const name = input.name?.trim() || defaultDraftName(barcode);
    const costPrice = draftCost(input.costPrice);
    await db.runAsync(
      `INSERT INTO products (id,store_id,category_id,name,sku,barcode,image_uri,cost_price,selling_price,unit,track_inventory,low_stock_threshold,tax_bps,active,created_at,updated_at,device_id,version)
       VALUES (?,?,NULL,?,NULL,?,NULL,?,?,'unit',0,NULL,0,1,?,?,?,1)`,
      [id, input.storeId, name, barcode, costPrice, input.sellingPrice, now, now, DEVICE_ID],
    );
    await db.runAsync(
      'INSERT INTO product_review (product_id,created_at) VALUES (?,?) ON CONFLICT(product_id) DO NOTHING',
      [id, now],
    );
  });

  if (existing) return existing;
  const created = await getProduct(id);
  if (!created) throw new Error('No se pudo crear el producto');
  return created;
}

export async function clearProductReview(productId: string): Promise<void> {
  await getDb().runAsync('DELETE FROM product_review WHERE product_id=?', [productId]);
}

export interface BarcodeLookupRow {
  barcode: string;
  status: 'found' | 'not_found';
  name: string | null;
  image_url: string | null;
  source: 'market' | 'off' | null;
  checked_at: number;
}

export async function getBarcodeLookup(barcode: string): Promise<BarcodeLookupRow | null> {
  return (await getDb().getFirstAsync<BarcodeLookupRow>(
    'SELECT barcode,status,name,image_url,source,checked_at FROM barcode_lookups WHERE barcode=?',
    [barcode],
  )) ?? null;
}

export async function saveBarcodeLookup(input: {
  barcode: string;
  status: 'found' | 'not_found';
  name?: string | null;
  imageUrl?: string | null;
  source?: 'market' | 'off' | null;
  checkedAt?: number;
}): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO barcode_lookups (barcode,status,name,image_url,source,checked_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(barcode) DO UPDATE SET
       status=excluded.status,
       name=excluded.name,
       image_url=excluded.image_url,
       source=excluded.source,
       checked_at=excluded.checked_at`,
    [input.barcode, input.status, input.name ?? null, input.imageUrl ?? null, input.source ?? null, input.checkedAt ?? Date.now()],
  );
}

export interface CatalogOutboxRow {
  id: string;
  barcode: string;
  name: string;
  presentation: string | null;
  attempts: number;
  created_at: number;
}

export interface CatalogCacheRow {
  barcode: string;
  name: string | null;
  presentation: string | null;
  contributors: number | null;
  status: 'found' | 'not_found';
  checked_at: number;
}

export async function enqueueCatalogContribution(input: {
  barcode: string;
  name: string;
  presentation?: string | null;
}): Promise<boolean> {
  const result = await getDb().runAsync(
    'INSERT OR IGNORE INTO catalog_outbox (id,barcode,name,presentation,attempts,created_at) VALUES (?,?,?,?,0,?)',
    [newId(), input.barcode.trim(), input.name.trim(), input.presentation?.trim() || null, Date.now()],
  );
  return (result.changes ?? 0) > 0;
}

export async function listCatalogOutbox(limit = 100): Promise<CatalogOutboxRow[]> {
  return getDb().getAllAsync<CatalogOutboxRow>(
    'SELECT id,barcode,name,presentation,attempts,created_at FROM catalog_outbox ORDER BY created_at LIMIT ?',
    [limit],
  );
}

export async function deleteCatalogContributions(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  await getDb().runAsync(`DELETE FROM catalog_outbox WHERE id IN (${placeholders})`, [...ids]);
}

export async function incrementCatalogAttempts(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  await getDb().runAsync(`UPDATE catalog_outbox SET attempts=attempts+1 WHERE id IN (${placeholders})`, [...ids]);
}

export async function clearCatalogOutbox(): Promise<void> {
  await getDb().runAsync('DELETE FROM catalog_outbox');
}

export async function getCatalogCache(barcode: string): Promise<CatalogCacheRow | null> {
  return (await getDb().getFirstAsync<CatalogCacheRow>(
    'SELECT barcode,name,presentation,contributors,status,checked_at FROM catalog_cache WHERE barcode=?',
    [barcode],
  )) ?? null;
}

export async function saveCatalogCache(input: CatalogCacheRow): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO catalog_cache (barcode,name,presentation,contributors,status,checked_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(barcode) DO UPDATE SET
       name=excluded.name,
       presentation=excluded.presentation,
       contributors=excluded.contributors,
       status=excluded.status,
       checked_at=excluded.checked_at`,
    [input.barcode, input.name, input.presentation, input.contributors, input.status, input.checked_at],
  );
}

export async function getLocalSetting(key: string): Promise<string | null> {
  const row = await getDb().getFirstAsync<{ value: string }>(
    'SELECT value FROM local_settings WHERE key=?',
    [key],
  );
  return row?.value ?? null;
}

export async function setLocalSetting(key: string, value: string): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO local_settings (key,value) VALUES (?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    [key, value],
  );
}

export async function updateProductImage(productId: string, imageUri: string): Promise<void> {
  await getDb().runAsync(
    'UPDATE products SET image_uri=?, updated_at=?, version=version+1 WHERE id=?',
    [imageUri, Date.now(), productId],
  );
}

export async function updateProductPrices(
  storeId: string,
  productId: string,
  updates: { selling_price: number; cost_price: number },
): Promise<void> {
  await getDb().runAsync(
    'UPDATE products SET selling_price=?, cost_price=?, updated_at=?, version=version+1 WHERE id=? AND store_id=?',
    [updates.selling_price, updates.cost_price, Date.now(), productId, storeId],
  );
}

export interface MarketPriceRow {
  id: string;
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

export interface MarketPricesCache {
  rows: MarketPriceRow[];
  fetchedAt: number | null;
}

export interface MarketPricesRefresh extends MarketPricesCache {
  status: 'fresh' | 'cached' | 'stale' | 'offline' | 'error';
  errors: MarketPriceProviderError[];
  errorKind?: MarketPriceErrorKind;
}

const marketPriceRequests = createInFlightRequests<MarketPricesRefresh>();
const marketPriceFailures = new Map<string, { at: number; kind: MarketPriceErrorKind }>();
const MARKET_PRICE_FAILURE_BACKOFF_MS = 60_000;

export async function listMarketPrices(ean: string): Promise<MarketPriceRow[]> {
  return getDb().getAllAsync<MarketPriceRow>(
    `SELECT id, ean, provider_id, supermarket_name, location, context_key, price_minor,
            currency_code, product_name, presentation, product_url, source,
            source_updated_at, fetched_at, match_quality
     FROM market_prices
     WHERE ean=?
     ORDER BY price_minor, supermarket_name`,
    [ean],
  );
}

export async function getMarketPricesCache(ean: string): Promise<MarketPricesCache> {
  const rows = await listMarketPrices(ean);
  const fetchedAt = rows.reduce<number | null>(
    (latest, row) => (latest === null || row.fetched_at > latest ? row.fetched_at : latest),
    null,
  );
  return { rows, fetchedAt };
}

async function saveMarketPrices(ean: string, results: MarketPriceResult[], fetchedAt: number, clearExisting = false): Promise<MarketPriceRow[]> {
  const db = getDb();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    if (clearExisting) await db.runAsync('DELETE FROM market_prices WHERE ean=?', [ean]);
    for (const result of results) {
      if (result.ean !== ean || !Number.isSafeInteger(result.price_minor) || result.price_minor <= 0) continue;
      const id = newId();
      const resultFetchedAt = Number.isFinite(result.fetched_at) && result.fetched_at > 0 ? result.fetched_at : fetchedAt;
      await db.runAsync(
        `INSERT INTO market_prices
          (id, ean, provider_id, supermarket_name, location, context_key, price_minor, currency_code,
           product_name, presentation, product_url, source, source_updated_at, fetched_at, match_quality, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(ean, provider_id, context_key) DO UPDATE SET
           supermarket_name=excluded.supermarket_name,
           location=excluded.location,
           price_minor=excluded.price_minor,
           currency_code=excluded.currency_code,
           product_name=excluded.product_name,
           presentation=excluded.presentation,
           product_url=excluded.product_url,
           source=excluded.source,
           source_updated_at=excluded.source_updated_at,
           fetched_at=excluded.fetched_at,
           match_quality=excluded.match_quality,
           updated_at=excluded.updated_at`,
        [
          id, ean, result.provider_id, result.supermarket_name, result.location, result.context_key,
          result.price_minor, result.currency_code, result.product_name, result.presentation,
          result.product_url, result.source, result.source_updated_at, resultFetchedAt,
          result.match_quality, now, now,
        ],
      );
    }
  });
  return listMarketPrices(ean);
}

export async function refreshMarketPrices(ean: string, force = false): Promise<MarketPricesRefresh> {
  const cached = await getMarketPricesCache(ean);
  if (!force && cached.rows.length > 0 && !isMarketPricesStale(cached.fetchedAt)) {
    return { ...cached, status: 'cached', errors: [] };
  }
  if (!force) {
    const failure = marketPriceFailures.get(ean);
    if (failure && Date.now() - failure.at < MARKET_PRICE_FAILURE_BACKOFF_MS) {
      return {
        ...cached,
        status: marketPricesRefreshFailureStatus(cached.rows.length > 0, failure.kind),
        errors: [],
        errorKind: failure.kind,
      };
    }
  }
  return marketPriceRequests.run(ean, async () => {
    try {
      const payload = await fetchMarketPrices(ean);
      const rows = await saveMarketPrices(ean, payload.results, payload.fetched_at, (payload.errors ?? []).length === 0);
      marketPriceFailures.delete(ean);
      return { rows, fetchedAt: payload.fetched_at, status: 'fresh', errors: payload.errors ?? [] };
    } catch (error) {
      const kind: MarketPriceErrorKind = error instanceof MarketPricesError ? error.kind : 'http';
      marketPriceFailures.set(ean, { at: Date.now(), kind });
      return {
        ...cached,
        status: marketPricesRefreshFailureStatus(cached.rows.length > 0, kind),
        errors: [],
        errorKind: kind,
      };
    }
  });
}

export async function checkoutSale(
  storeId: string,
  lines: CheckoutLine[],
  opts: CheckoutOptions,
): Promise<Receipt> {
  return checkoutSaleOn(getDb(), { newId, deviceId: DEVICE_ID }, storeId, lines, opts);
}

export async function salesCount(): Promise<number> {
  const row = await getDb().getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM sales');
  return row?.c ?? 0;
}

/* ------------------------------ dashboard ------------------------------- */

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface TodayStats { totalSales: number; orders: number; itemsSold: number }

export async function todayStats(storeId: string): Promise<TodayStats> {
  const db = getDb();
  const since = startOfToday();
  const sale = await db.getFirstAsync<{ total: number; orders: number }>(
    `SELECT COALESCE(SUM(grand_total),0) AS total, COUNT(*) AS orders
     FROM sales WHERE store_id=? AND status='completed' AND sold_at >= ?`, [storeId, since],
  );
  const items = await db.getFirstAsync<{ n: number }>(
    `SELECT COALESCE(SUM(si.quantity),0) AS n FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE s.store_id=? AND s.status='completed' AND s.sold_at >= ?`, [storeId, since],
  );
  return { totalSales: sale?.total ?? 0, orders: sale?.orders ?? 0, itemsSold: items?.n ?? 0 };
}

export interface SaleSummary {
  id: string; invoice_no: string; grand_total: number; sold_at: number; item_count: number;
  payment_method: string; staff_name: string | null;
}

export async function listSales(opts: { storeId: string; since?: number; limit?: number }): Promise<SaleSummary[]> {
  const { storeId, since, limit = 200 } = opts;
  return getDb().getAllAsync<SaleSummary>(
    `SELECT s.id, s.invoice_no, s.grand_total, s.sold_at,
            (SELECT COALESCE(SUM(quantity),0) FROM sale_items si WHERE si.sale_id = s.id) AS item_count,
            COALESCE((SELECT type FROM payments WHERE sale_id = s.id LIMIT 1), 'credit') AS payment_method,
            (SELECT name FROM staff WHERE staff.id = s.staff_id) AS staff_name
     FROM sales s WHERE s.store_id=? AND s.status='completed' ${since ? 'AND s.sold_at >= ?' : ''}
     ORDER BY s.sold_at DESC LIMIT ?`,
    since ? [storeId, since, limit] : [storeId, limit],
  );
}

export async function voidSale(storeId: string, saleId: string): Promise<void> {
  await voidSaleOn(getDb(), { newId, deviceId: DEVICE_ID }, storeId, saleId);
}

/** Distinct products from recent sales, most-recently-sold first. */
export async function recentlySold(storeId: string, limit = 6): Promise<Product[]> {
  return getDb().getAllAsync<Product>(
    `${PRODUCT_SELECT}
     JOIN (
       SELECT si.product_id, MAX(s.sold_at) AS last_sold
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE si.product_id IS NOT NULL AND s.status='completed'
       GROUP BY si.product_id
       ORDER BY last_sold DESC LIMIT ?
     ) r ON r.product_id = p.id
     WHERE p.store_id = ? AND p.active = 1 AND p.deleted_at IS NULL
     ORDER BY r.last_sold DESC`, [limit, storeId],
  );
}

/* ------------------------------ customers ------------------------------- */

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  balance: number; // derived from ledger; + = customer owes the store
}

const CUSTOMER_SELECT = `
  SELECT c.id, c.name, c.phone, c.email, c.address, c.notes,
         COALESCE((SELECT SUM(l.amount) FROM customer_ledger l WHERE l.customer_id = c.id), 0) AS balance
  FROM customers c`;

export async function listCustomers(storeId: string): Promise<Customer[]> {
  return getDb().getAllAsync<Customer>(
    `${CUSTOMER_SELECT}
     WHERE c.store_id = ? AND c.deleted_at IS NULL
     ORDER BY c.name`, [storeId],
  );
}

export async function searchCustomers(storeId: string, q: string): Promise<Customer[]> {
  const like = `%${q.trim()}%`;
  return getDb().getAllAsync<Customer>(
    `${CUSTOMER_SELECT}
     WHERE c.store_id = ? AND c.deleted_at IS NULL AND (c.name LIKE ? OR c.phone LIKE ?)
     ORDER BY c.name`, [storeId, like, like],
  );
}

export async function getCustomer(id: string): Promise<Customer | null> {
  return (await getDb().getFirstAsync<Customer>(`${CUSTOMER_SELECT} WHERE c.id = ?`, [id])) ?? null;
}

export async function createCustomer(input: {
  storeId: string; name: string; phone?: string | null; email?: string | null; address?: string | null; notes?: string | null;
}): Promise<string> {
  const id = newId();
  const now = Date.now();
  await getDb().runAsync(
    `INSERT INTO customers (id,store_id,name,phone,email,address,notes,created_at,updated_at,device_id,version)
     VALUES (?,?,?,?,?,?,?,?,?,?,1)`,
    [id, input.storeId, input.name.trim(), input.phone?.trim() || null, input.email?.trim() || null, input.address?.trim() || null, input.notes?.trim() || null, now, now, DEVICE_ID],
  );
  return id;
}

export interface LedgerEntry {
  id: string;
  type: 'sale' | 'payment' | 'refund' | 'adjustment';
  amount: number; // signed minor units
  reference_id: string | null;
  note: string | null;
  created_at: number;
}

export async function customerLedger(customerId: string, limit = 100): Promise<LedgerEntry[]> {
  return getDb().getAllAsync<LedgerEntry>(
    `SELECT id, type, amount, reference_id, note, created_at
     FROM customer_ledger WHERE customer_id = ?
     ORDER BY created_at DESC LIMIT ?`, [customerId, limit],
  );
}

/** Record a customer paying down their balance. Adds a negative ledger entry. */
export async function recordCustomerPayment(
  storeId: string, customerId: string, amount: Minor, note?: string,
): Promise<void> {
  await recordCustomerPaymentOn(getDb(), { newId, deviceId: DEVICE_ID }, storeId, customerId, amount, note);
}

export interface OutstandingTotal { totalOwed: number; customersWithBalance: number }

export async function outstandingCredit(storeId: string): Promise<OutstandingTotal> {
  const row = await getDb().getFirstAsync<{ owed: number; n: number }>(
    `SELECT COALESCE(SUM(bal),0) AS owed, COUNT(*) AS n FROM (
       SELECT SUM(l.amount) AS bal FROM customer_ledger l
       JOIN customers c ON c.id = l.customer_id
       WHERE c.store_id = ? AND c.deleted_at IS NULL
       GROUP BY l.customer_id HAVING bal > 0
     )`, [storeId],
  );
  return { totalOwed: row?.owed ?? 0, customersWithBalance: row?.n ?? 0 };
}

/* -------------------------------- reports ------------------------------- */

export type { ReportSummary } from './reportOps';

export async function reportSummary(storeId: string, since: number): Promise<ReportSummary> {
  return reportSummaryOn(getDb(), storeId, since);
}

export interface PaymentSlice { type: string; amount: number }

/** Amount tendered per method in range, plus a synthetic 'credit' slice for
 *  the unpaid balance of credit sales (which have no payment rows). */
export async function paymentBreakdown(storeId: string, since: number): Promise<PaymentSlice[]> {
  const db = getDb();
  const rows = await db.getAllAsync<PaymentSlice>(
    `SELECT p.type AS type, SUM(p.amount) AS amount
     FROM payments p JOIN sales s ON s.id = p.sale_id
     WHERE s.store_id=? AND s.status='completed' AND s.sold_at>=?
     GROUP BY p.type`, [storeId, since],
  );
  const paid = rows.reduce((n, r) => n + r.amount, 0);
  const totalRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(grand_total),0) AS total FROM sales WHERE store_id=? AND status='completed' AND sold_at>=?`,
    [storeId, since],
  );
  const credit = (totalRow?.total ?? 0) - paid;
  if (credit > 0) rows.push({ type: 'credit', amount: credit });
  return rows.sort((a, b) => b.amount - a.amount);
}

export interface BestSeller { name: string; qty: number; revenue: number }

export async function bestSellers(storeId: string, since: number, limit = 5): Promise<BestSeller[]> {
  return getDb().getAllAsync<BestSeller>(
    `SELECT si.product_name_snapshot AS name, SUM(si.quantity) AS qty, SUM(si.line_total) AS revenue
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.store_id=? AND s.status='completed' AND s.sold_at>=?
     GROUP BY si.product_name_snapshot
     ORDER BY qty DESC LIMIT ?`, [storeId, since, limit],
  );
}

export interface LowStockItem { id: string; name: string; stock: number; threshold: number | null }

export async function lowStockProducts(storeId: string, limit = 20): Promise<LowStockItem[]> {
  return getDb().getAllAsync<LowStockItem>(
    `SELECT p.id, p.name, p.low_stock_threshold AS threshold,
            COALESCE((SELECT SUM(quantity_delta) FROM stock_movements sm WHERE sm.product_id = p.id), 0) AS stock
     FROM products p
     WHERE p.store_id=? AND p.active=1 AND p.deleted_at IS NULL AND p.track_inventory=1
       AND COALESCE((SELECT SUM(quantity_delta) FROM stock_movements sm WHERE sm.product_id = p.id), 0)
           <= COALESCE(p.low_stock_threshold, 5)
     ORDER BY stock ASC LIMIT ?`, [storeId, limit],
  );
}

interface ReorderProductStockRow {
  product_id: string;
  product_name: string;
  current_stock: number;
}

interface ReorderDailySalesRow {
  product_id: string;
  sale_date: string;
  quantity: number;
}

export interface ReorderRow {
  product_id: string;
  product_name: string;
  current_stock: number;
  units_per_day: number;
  days_of_stock_left: number | null;
  suggested_quantity: number;
  urgency: 'critical' | 'low' | 'ok';
}

export async function getReorderSuggestions(storeId: string): Promise<ReorderRow[]> {
  const db = getDb();
  const since = Date.now() - 28 * 86_400_000;

  const products = await db.getAllAsync<ReorderProductStockRow>(
    `SELECT p.id AS product_id, p.name AS product_name,
            COALESCE(SUM(sm.quantity_delta), 0) AS current_stock
     FROM products p
     LEFT JOIN stock_movements sm ON sm.product_id = p.id
     WHERE p.store_id=? AND p.active=1 AND p.deleted_at IS NULL AND p.track_inventory=1
     GROUP BY p.id, p.name`,
    [storeId],
  );

  const dailySales = await db.getAllAsync<ReorderDailySalesRow>(
    `SELECT product_id, sale_date, SUM(quantity) AS quantity
     FROM (
       SELECT si.product_id AS product_id,
              date(s.sold_at / 1000, 'unixepoch', 'localtime') AS sale_date,
              si.quantity AS quantity
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN products p ON p.id = si.product_id
       WHERE s.store_id=? AND s.status='completed' AND s.sold_at >= ?
         AND p.store_id=? AND p.active=1 AND p.deleted_at IS NULL AND p.track_inventory=1
       UNION ALL
       SELECT ri.product_id AS product_id,
              date(r.created_at / 1000, 'unixepoch', 'localtime') AS sale_date,
              -ri.quantity AS quantity
       FROM return_items ri
       JOIN returns r ON r.id = ri.return_id
       JOIN products p ON p.id = ri.product_id
       WHERE r.store_id=? AND r.created_at >= ?
         AND p.store_id=? AND p.active=1 AND p.deleted_at IS NULL AND p.track_inventory=1
     )
     GROUP BY product_id, sale_date`,
    [storeId, since, storeId, storeId, since, storeId],
  );

  const pointsByProduct = new Map<string, SalesPoint[]>();
  for (const row of dailySales) {
    const points = pointsByProduct.get(row.product_id) ?? [];
    points.push({ date: row.sale_date, quantity: row.quantity });
    pointsByProduct.set(row.product_id, points);
  }

  const urgencyRank: Record<ReorderRow['urgency'], number> = { critical: 0, low: 1, ok: 2 };

  return products
    .map((product) => {
      const suggestion = suggestReorder(pointsByProduct.get(product.product_id) ?? [], product.current_stock, {
        lookbackDays: 14,
        fallbackLookbackDays: 28,
        coverDays: 7,
      });
      return {
        product_id: product.product_id,
        product_name: product.product_name,
        current_stock: product.current_stock,
        units_per_day: suggestion.unitsPerDay,
        days_of_stock_left: suggestion.daysOfStockLeft,
        suggested_quantity: suggestion.suggestedQuantity,
        urgency: suggestion.urgency,
      };
    })
    .filter((row) => !(row.suggested_quantity === 0 && row.urgency === 'ok'))
    .sort((a, b) =>
      urgencyRank[a.urgency] - urgencyRank[b.urgency]
      || (a.days_of_stock_left ?? Number.POSITIVE_INFINITY) - (b.days_of_stock_left ?? Number.POSITIVE_INFINITY)
      || b.suggested_quantity - a.suggested_quantity,
    );
}

/* ------------------------------- returns -------------------------------- */

export async function getSale(saleId: string): Promise<SaleDetail | null> {
  return getSaleOn(getDb(), saleId);
}

export async function processReturn(
  storeId: string, saleId: string, picks: ReturnPick[], refundMethod: RefundMethod, reason?: string,
): Promise<ReturnReceipt> {
  return processReturnOn(getDb(), { newId, deviceId: DEVICE_ID }, storeId, saleId, picks, refundMethod, reason);
}

/* ---------------------------- suppliers/purchases ----------------------- */

export interface Supplier {
  id: string; name: string; phone: string | null; email: string | null; address: string | null; notes: string | null;
}

export async function listSuppliers(storeId: string): Promise<Supplier[]> {
  return getDb().getAllAsync<Supplier>(
    `SELECT id, name, phone, email, address, notes FROM suppliers
     WHERE store_id=? AND deleted_at IS NULL ORDER BY name`, [storeId],
  );
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  return (await getDb().getFirstAsync<Supplier>(
    `SELECT id, name, phone, email, address, notes FROM suppliers WHERE id=?`, [id])) ?? null;
}

export async function createSupplier(input: {
  storeId: string; name: string; phone?: string | null; email?: string | null; address?: string | null; notes?: string | null;
}): Promise<string> {
  const id = newId();
  const now = Date.now();
  await getDb().runAsync(
    `INSERT INTO suppliers (id,store_id,name,phone,email,address,notes,created_at,updated_at,device_id,version)
     VALUES (?,?,?,?,?,?,?,?,?,?,1)`,
    [id, input.storeId, input.name.trim(), input.phone?.trim() || null, input.email?.trim() || null, input.address?.trim() || null, input.notes?.trim() || null, now, now, DEVICE_ID],
  );
  return id;
}

export interface PurchaseLine { productId: string; name: string; quantity: number; unitCost: Minor }
export interface PurchaseReceipt { referenceNo: string; total: Minor; itemCount: number }

/**
 * Receive a purchase atomically: writes purchases + purchase_items, restocks
 * each product with a positive 'purchase' movement, and updates the product's
 * cost_price to the latest cost (past sale snapshots are untouched).
 */
export async function createPurchase(
  storeId: string, supplierId: string | null, lines: PurchaseLine[], note?: string,
): Promise<PurchaseReceipt> {
  const valid = lines.filter((l) => l.quantity > 0);
  if (valid.length === 0) throw new Error('Agrega al menos un artículo a la compra');
  const db = getDb();
  const now = Date.now();
  const purchaseId = newId();
  const total = valid.reduce((n, l) => n + l.unitCost * l.quantity, 0);
  const countRow = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM purchases');
  const referenceNo = `PO-${String((countRow?.c ?? 0) + 1).padStart(4, '0')}`;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO purchases (id,store_id,supplier_id,reference_no,total,note,status,purchased_at,created_at,updated_at,device_id,version)
       VALUES (?,?,?,?,?,?, 'received', ?,?,?,?,1)`,
      [purchaseId, storeId, supplierId, referenceNo, total, note?.trim() || null, now, now, now, DEVICE_ID],
    );
    for (const l of valid) {
      await db.runAsync(
        `INSERT INTO purchase_items (id,purchase_id,product_id,product_name_snapshot,unit_cost,quantity,line_total,created_at,device_id)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [newId(), purchaseId, l.productId, l.name, l.unitCost, l.quantity, l.unitCost * l.quantity, now, DEVICE_ID],
      );
      await db.runAsync(
        `INSERT INTO stock_movements (id,store_id,product_id,type,quantity_delta,reference_type,reference_id,created_at,device_id)
         VALUES (?,?,?,'purchase',?, 'purchase', ?, ?, ?)`,
        [newId(), storeId, l.productId, l.quantity, purchaseId, now, DEVICE_ID],
      );
      await db.runAsync(
        `UPDATE products SET cost_price=?, updated_at=?, version=version+1 WHERE id=?`,
        [l.unitCost, now, l.productId],
      );
    }
  });

  return { referenceNo, total: total as Minor, itemCount: valid.length };
}

export interface PurchaseSummary {
  id: string; reference_no: string; supplier_name: string | null; total: number; purchased_at: number; item_count: number;
}

export async function listPurchases(storeId: string, limit = 50): Promise<PurchaseSummary[]> {
  return getDb().getAllAsync<PurchaseSummary>(
    `SELECT p.id, p.reference_no, s.name AS supplier_name, p.total, p.purchased_at,
            (SELECT COALESCE(SUM(quantity),0) FROM purchase_items pi WHERE pi.purchase_id = p.id) AS item_count
     FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.store_id=? AND p.status='received'
     ORDER BY p.purchased_at DESC LIMIT ?`, [storeId, limit],
  );
}

/* ------------------------------ csv backup ------------------------------ */

/** Update editable product fields (used by CSV import for existing products). */
export async function updateProductFields(input: {
  id: string; name: string; sellingPrice: Minor; costPrice: Minor; taxBps: number; barcode?: string | null;
  // Optional: omitted keys are left untouched (CSV import only sets the basics).
  sku?: string | null; unit?: string | null; categoryId?: string | null; lowStockThreshold?: number | null; imageUri?: string | null;
}): Promise<void> {
  const sets = ['name=?', 'selling_price=?', 'cost_price=?', 'tax_bps=?', 'barcode=?'];
  const args: (string | number | null)[] = [input.name.trim(), input.sellingPrice, input.costPrice, input.taxBps, input.barcode?.trim() || null];
  const opt = (col: string, key: keyof typeof input, val: string | number | null) => {
    if (input[key] !== undefined) { sets.push(`${col}=?`); args.push(val); }
  };
  opt('sku', 'sku', input.sku?.trim() || null);
  opt('unit', 'unit', input.unit?.trim() || 'unit');
  opt('category_id', 'categoryId', input.categoryId ?? null);
  opt('low_stock_threshold', 'lowStockThreshold', input.lowStockThreshold ?? null);
  opt('image_uri', 'imageUri', input.imageUri ?? null);
  await getDb().runAsync(
    `UPDATE products SET ${sets.join(', ')}, updated_at=?, version=version+1 WHERE id=?`,
    [...args, Date.now(), input.id],
  );
}

export async function getProduct(id: string): Promise<Product | null> {
  return (await getDb().getFirstAsync<Product>(`${PRODUCT_SELECT} WHERE p.id = ?`, [id])) ?? null;
}

/** Soft-delete a product: it leaves the catalog (active=0, deleted_at set) but
 * past sales keep their snapshotted name/price, so history is never broken. The
 * tombstone syncs like any other change. */
export async function deleteProduct(id: string): Promise<void> {
  const now = Date.now();
  await getDb().withTransactionAsync(async () => {
    await getDb().runAsync('DELETE FROM product_review WHERE product_id=?', [id]);
    await getDb().runAsync(
      `UPDATE products SET active=0, deleted_at=?, updated_at=?, version=version+1 WHERE id=?`,
      [now, now, id],
    );
  });
}

const RESET_TABLES = [
  'barcode_lookups', 'product_review', 'market_prices', 'local_settings', 'catalog_outbox', 'catalog_cache', 'return_items', 'returns', 'payments', 'sale_items', 'sales',
  'customer_ledger', 'customers', 'purchase_items', 'purchases',
  'suppliers', 'stock_movements', 'products', 'categories', 'staff', 'stores',
];

export async function resetAllData(): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const table of RESET_TABLES) await db.runAsync(`DELETE FROM ${table}`);
    await db.runAsync('UPDATE app_state SET current_store_id=NULL WHERE id=1');
    await db.runAsync('UPDATE sync_state SET server_url=NULL, token=NULL, last_pushed_at=0, last_pulled_at=0, last_synced_at=NULL WHERE id=1');
  });
}

export async function seedColombianCatalog(storeId: string): Promise<SeedResult> {
  return runSeedCatalog(getDb(), storeId, { newId, deviceId: DEVICE_ID });
}

export interface SalesExportRow {
  invoice_no: string; sold_at: number; product: string; quantity: number;
  unit_price: number; line_total: number; grand_total: number;
}

export interface BackupSalesCounts {
  totalSales: number;
  salesSinceBackup: number;
}

export async function salesBackupCounts(lastBackupAt: number | null): Promise<BackupSalesCounts> {
  const row = await getDb().getFirstAsync<{ total: number; since: number }>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN sold_at > ? THEN 1 ELSE 0 END), 0) AS since
     FROM sales WHERE status='completed'`,
    [lastBackupAt ?? 0],
  );
  return { totalSales: row?.total ?? 0, salesSinceBackup: row?.since ?? 0 };
}

export async function salesExportRows(storeId: string): Promise<SalesExportRow[]> {
  return getDb().getAllAsync<SalesExportRow>(
    `SELECT s.invoice_no, s.sold_at, si.product_name_snapshot AS product, si.quantity,
            si.unit_price, si.line_total, s.grand_total
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.store_id=? AND s.status='completed'
     ORDER BY s.sold_at DESC, si.rowid`, [storeId],
  );
}

/* -------------------------------- staff --------------------------------- */

export interface Staff {
  id: string;
  name: string;
  role: Role;
  created_at: number;
}

/** Active (non-deleted) staff for the store, owners first. */
export async function listStaff(storeId: string): Promise<Staff[]> {
  return getDb().getAllAsync<Staff>(
    `SELECT id, name, role, created_at FROM staff
     WHERE store_id=? AND active=1 AND deleted_at IS NULL
     ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, name`,
    [storeId],
  );
}

export async function staffCount(storeId: string): Promise<number> {
  const row = await getDb().getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM staff WHERE store_id=? AND active=1 AND deleted_at IS NULL`, [storeId],
  );
  return row?.c ?? 0;
}

const staffDeps: StaffDeps = {
  newId,
  deviceId: DEVICE_ID,
  salt: () => Array.from(Crypto.getRandomBytes(8), (byte) => byte.toString(16).padStart(2, '0')).join(''),
  hash: hashPin,
  verify: verifyPin,
};

export async function createStaff(input: {
  storeId: string; name: string; role: Role; pin: string;
}): Promise<string> {
  return createStaffOn(getDb(), staffDeps, input);
}

export async function updateStaff(input: {
  id: string; name: string; role: Role; pin?: string;
}): Promise<void> {
  await updateStaffOn(getDb(), staffDeps, input);
}

export async function deleteStaff(storeId: string, id: string, actingId: string | null = null): Promise<void> {
  await deleteStaffOn(getDb(), storeId, id, actingId);
}

export async function staffLockRetryAt(id: string): Promise<number | null> {
  return lockRetryAtOn(getDb(), id, Date.now());
}

export async function attemptStaffPin(id: string, pin: string): Promise<PinAttempt> {
  return attemptPinOn(getDb(), staffDeps, id, pin, Date.now());
}

const recoveryDeps: RecoveryDeps = {
  randomBytes: (length) => Crypto.getRandomBytes(length),
  digest: (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text),
  salt: staffDeps.salt,
  hashPin,
};

export async function setupRecovery(storeId: string): Promise<string> {
  return setupRecoveryOn(getDb(), recoveryDeps, storeId);
}

export async function hasRecovery(storeId: string): Promise<boolean> {
  return hasRecoveryOn(getDb(), storeId);
}

export async function resetOwnerPin(input: { storeId: string; ownerId: string; code: string; newPin: string }): Promise<RecoveryResult> {
  return resetPinWithRecoveryOn(getDb(), recoveryDeps, { ...input, now: Date.now() });
}
