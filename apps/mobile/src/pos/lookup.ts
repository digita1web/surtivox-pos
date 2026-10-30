import * as FileSystem from 'expo-file-system/legacy';
import { newId } from '../id';

const DIR = FileSystem.documentDirectory + 'products/';
const LOOKUP_TIMEOUT_MS = 2500;
const EAN_PATTERN = /^\d{8,14}$/;
const SCALE_PATTERN = /^2\d{11,12}$/;

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
        headers: { 'User-Agent': 'SurtivoxPOS/1.0 (offline POS)' },
        signal: controller.signal,
      },
    );
    if (res.status === 404) return { status: 'not_found' };
    if (!res.ok) return { status: 'error', kind: 'http' };

    const json: any = await res.json();
    if (json.status !== 1 || !json.product) return { status: 'not_found' };
    const p = json.product;
    const brand = typeof p.brands === 'string' ? p.brands.split(',')[0]?.trim() : '';
    const title = typeof p.product_name === 'string' ? p.product_name.trim() : '';
    const name = [brand, title].filter(Boolean).join(' ') || undefined;
    const imageUrl = p.image_front_url || p.image_url || undefined;
    if (!name && !imageUrl) return { status: 'not_found' };
    return { status: 'found', info: { name, imageUrl } };
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
