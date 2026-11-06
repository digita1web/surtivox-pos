import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { newId } from '../id';
import { LEGAL_CONTACT } from '../legalText';
import { buildOffUserAgent, createOffCache } from '../offClient';

const DIR = FileSystem.documentDirectory + 'products/';
const LOOKUP_TIMEOUT_MS = 2500;
const EAN_PATTERN = /^\d{8,14}$/;
const SCALE_PATTERN = /^2\d{11,12}$/;
const SESSION_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const sessionCache = createOffCache<BarcodeLookupOutcome>(SESSION_CACHE_TTL_MS, () => Date.now());

function offUserAgent(): string {
  return buildOffUserAgent({
    name: Constants.expoConfig?.name ?? 'SurtivoxPOS',
    version: Constants.expoConfig?.version ?? null,
    contact: LEGAL_CONTACT,
  });
}

export interface BarcodeInfo {
  name?: string;
  imageUrl?: string;
}

export type BarcodeLookupErrorKind = 'offline' | 'timeout' | 'http';

export type BarcodeLookupOutcome =
  | { status: 'found'; info: BarcodeInfo }
  | { status: 'not_found' }
  | { status: 'error'; kind: BarcodeLookupErrorKind };

export async function lookupBarcode(
  barcode: string,
  signal?: AbortSignal,
): Promise<BarcodeLookupOutcome> {
  const code = barcode.trim();
  if (!EAN_PATTERN.test(code) || SCALE_PATTERN.test(code)) return { status: 'not_found' };
  const cached = sessionCache.get(code);
  if (cached) return cached;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, LOOKUP_TIMEOUT_MS);
  const forwardAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      return { status: 'error', kind: 'timeout' };
    }
    signal.addEventListener('abort', forwardAbort);
  }

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,image_front_url,image_url`,
      {
        headers: { 'User-Agent': offUserAgent() },
        signal: controller.signal,
      },
    );
    if (res.status === 404) {
      sessionCache.set(code, { status: 'not_found' });
      return { status: 'not_found' };
    }
    if (!res.ok) return { status: 'error', kind: 'http' };

    const json: any = await res.json();
    if (json.status !== 1 || !json.product) {
      sessionCache.set(code, { status: 'not_found' });
      return { status: 'not_found' };
    }
    const p = json.product;
    const brand = typeof p.brands === 'string' ? p.brands.split(',')[0]?.trim() : '';
    const title = typeof p.product_name === 'string' ? p.product_name.trim() : '';
    const name = [brand, title].filter(Boolean).join(' ') || undefined;
    const imageUrl = p.image_front_url || p.image_url || undefined;
    if (!name && !imageUrl) {
      sessionCache.set(code, { status: 'not_found' });
      return { status: 'not_found' };
    }
    const found: BarcodeLookupOutcome = { status: 'found', info: { name, imageUrl } };
    sessionCache.set(code, found);
    return found;
  } catch {
    return { status: 'error', kind: timedOut ? 'timeout' : 'offline' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

export async function downloadProductImage(url: string): Promise<string | null> {
  try {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
    const base = url.split('?')[0] ?? url;
    const ext = base.split('.').pop()?.toLowerCase();
    const safe = ext && ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
    const dest = `${DIR}${newId()}.${safe}`;
    const r = await FileSystem.downloadAsync(url, dest);
    return r.uri;
  } catch {
    return null;
  }
}
