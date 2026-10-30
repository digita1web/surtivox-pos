export type MarketViewStatus = 'loading' | 'ready' | 'empty' | 'offline' | 'error';

export type MarketRefreshStatus = 'fresh' | 'cached' | 'stale' | 'offline' | 'error';

export function statusFromCache(rows: readonly unknown[]): MarketViewStatus {
  return rows.length > 0 ? 'ready' : 'loading';
}

export function statusFromRefresh(
  rows: readonly unknown[],
  status: MarketRefreshStatus,
): MarketViewStatus {
  if (status === 'offline' && rows.length === 0) return 'offline';
  if (status === 'error' && rows.length === 0) return 'error';
  return rows.length > 0 ? 'ready' : 'empty';
}

export function isOldMarketData(
  fetchedAt: number | null | undefined,
  now = Date.now(),
  days = 7,
): boolean {
  if (!fetchedAt || fetchedAt <= 0) return false;
  return now - fetchedAt > days * 24 * 60 * 60 * 1000;
}

export function isCurrentMarketRequest(requestId: number, current: number): boolean {
  return requestId === current;
}
