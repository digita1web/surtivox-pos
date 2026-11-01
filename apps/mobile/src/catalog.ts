import {
  clearCatalogOutbox,
  deleteCatalogContributions,
  enqueueCatalogContribution,
  getCatalogCache,
  getLocalSetting,
  incrementCatalogAttempts,
  listCatalogOutbox,
  saveCatalogCache,
  setLocalSetting,
} from './repos';
import { newId } from './id';
import {
  canAttemptCatalog,
  isCatalogCacheFresh,
  isCatalogEnabled,
  isCatalogEan,
  isCatalogName,
  isCatalogUuid,
  isGenericCatalogName,
} from './catalogCore';

export const CATALOG_URL = 'https://surtivox-catalog.surtivox.workers.dev';

const LOOKUP_TIMEOUT_MS = 2500;
const FLUSH_TIMEOUT_MS = 8000;

export type CatalogLookupResult =
  | { status: 'found'; name: string; presentation: string | null; contributors: number }
  | { status: 'not_found' }
  | { status: 'disabled' }
  | { status: 'error' };

export async function getInstallId(): Promise<string> {
  const saved = await getLocalSetting('catalog_install_id');
  if (isCatalogUuid(saved)) return saved;
  const created = newId();
  await setLocalSetting('catalog_install_id', created);
  return created;
}

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

export async function lookupCatalog(code: string, signal?: AbortSignal): Promise<CatalogLookupResult> {
  const barcode = code.trim();
  if (!isCatalogEan(barcode)) return { status: 'not_found' };

  try {
    const cached = await getCatalogCache(barcode);
    if (cached && isCatalogCacheFresh(cached.checked_at, cached.status)) {
      if (cached.status === 'not_found') return { status: 'not_found' };
      return {
        status: 'found',
        name: cached.name ?? '',
        presentation: cached.presentation,
        contributors: cached.contributors ?? 0,
      };
    }
  } catch {
    return { status: 'error' };
  }

  if (!isCatalogEnabled(CATALOG_URL)) return { status: 'disabled' };

  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  signal?.addEventListener('abort', abort);

  try {
    const response = await fetch(`${CATALOG_URL.replace(/\/+$/, '')}/catalog/lookup?code=${encodeURIComponent(barcode)}`, {
      signal: controller.signal,
    });
    if (!response.ok) return { status: 'error' };
    const payload = await readJson(response) as {
      found?: unknown;
      name?: unknown;
      presentation?: unknown;
      contributors?: unknown;
    };
    if (payload.found === true && typeof payload.name === 'string') {
      const presentation = typeof payload.presentation === 'string' ? payload.presentation : null;
      const contributors = typeof payload.contributors === 'number' ? payload.contributors : 0;
      await saveCatalogCache({
        barcode,
        name: payload.name,
        presentation,
        contributors,
        status: 'found',
        checked_at: Date.now(),
      });
      return { status: 'found', name: payload.name, presentation, contributors };
    }
    if (payload.found === false) {
      await saveCatalogCache({
        barcode,
        name: null,
        presentation: null,
        contributors: null,
        status: 'not_found',
        checked_at: Date.now(),
      });
      return { status: 'not_found' };
    }
    return { status: 'error' };
  } catch {
    return { status: 'error' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function enqueueContribution(input: {
  code: string;
  name: string;
  presentation?: string | null;
}): Promise<boolean> {
  if (!isCatalogEnabled(CATALOG_URL)) return false;
  const barcode = input.code.trim();
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (!isCatalogEan(barcode) || !isCatalogName(name) || isGenericCatalogName(name)) return false;
  const presentation = input.presentation?.trim() || null;
  if (presentation && presentation.length > 20) return false;
  return enqueueCatalogContribution({ barcode, name, presentation });
}

let flushing: Promise<void> | null = null;

async function runFlush(): Promise<void> {
  if (!isCatalogEnabled(CATALOG_URL)) return;
  let ready: Awaited<ReturnType<typeof listCatalogOutbox>> = [];
  try {
    const rows = await listCatalogOutbox(100);
    ready = rows.filter((row) => canAttemptCatalog(row.created_at, row.attempts)).slice(0, 20);
    if (ready.length === 0) return;
    const installId = await getInstallId();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FLUSH_TIMEOUT_MS);
    try {
      const response = await fetch(`${CATALOG_URL.replace(/\/+$/, '')}/catalog/contribute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          install_id: installId,
          items: ready.map((row) => ({
            code: row.barcode,
            name: row.name,
            presentation: row.presentation ?? undefined,
          })),
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('catalog_flush_failed');
      const payload = await response.json() as { accepted?: unknown; rejected?: unknown };
      if (typeof payload.accepted !== 'number' || typeof payload.rejected !== 'number') {
        throw new Error('catalog_flush_invalid');
      }
      await deleteCatalogContributions(ready.map((row) => row.id));
    } finally {
      clearTimeout(timer);
    }
  } catch {
    if (ready.length > 0) {
      await incrementCatalogAttempts(ready.map((row) => row.id)).catch(() => {});
    }
  }
}

export function flushOutbox(): Promise<void> {
  if (!isCatalogEnabled(CATALOG_URL)) return Promise.resolve();
  if (flushing) return flushing;
  flushing = runFlush().finally(() => { flushing = null; });
  return flushing;
}

export async function clearCatalogQueue(): Promise<void> {
  await clearCatalogOutbox();
}
