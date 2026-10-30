import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getMarketPricesCache, refreshMarketPrices, type MarketPriceRow } from '../repos';
import { dataAgeLabel, lowestComparablePrice, presentationsDiffer } from '../marketPriceSummary';
import { isValidEan } from '../marketPrices';
import {
  isCurrentMarketRequest,
  isOldMarketData,
  statusFromCache,
  statusFromRefresh,
  type MarketViewStatus,
} from '../marketPricesView';

export interface MarketPricesHook {
  rows: MarketPriceRow[];
  fetchedAt: number | null;
  status: MarketViewStatus;
  stale: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
  lowest: ReturnType<typeof lowestComparablePrice>;
  mixedPresentations: boolean;
  ageLabel: string | null;
  old: boolean;
}

export function useMarketPrices(ean: string): MarketPricesHook {
  const [rows, setRows] = useState<MarketPriceRow[]>([]);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<MarketViewStatus>('loading');
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  const requestId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isValidEan(ean)) {
      setRows([]);
      setFetchedAt(null);
      setStatus('empty');
      setStale(false);
      return;
    }

    let active = true;
    const current = ++requestId.current;
    setRows([]);
    setFetchedAt(null);
    setStatus('loading');
    setStale(false);

    getMarketPricesCache(ean)
      .then((cached) => {
        if (!active || !isCurrentMarketRequest(current, requestId.current)) return;
        setRows(cached.rows);
        setFetchedAt(cached.fetchedAt);
        setStatus(statusFromCache(cached.rows));
      })
      .catch(() => {});

    refreshMarketPrices(ean)
      .then((result) => {
        if (!active || !isCurrentMarketRequest(current, requestId.current)) return;
        setRows(result.rows);
        setFetchedAt(result.fetchedAt);
        setStale(result.status === 'stale');
        setStatus(statusFromRefresh(result.rows, result.status));
      })
      .catch(() => {
        if (active && current === requestId.current) {
          setStatus((value) => (value === 'loading' ? 'error' : value));
        }
      });

    return () => {
      active = false;
    };
  }, [ean]);

  const refresh = useCallback(async () => {
    if (!isValidEan(ean) || refreshing) return;
    setRefreshing(true);
    const current = requestId.current;
    try {
      const result = await refreshMarketPrices(ean, true);
      if (!mounted.current || !isCurrentMarketRequest(current, requestId.current)) return;
      setRows(result.rows);
      setFetchedAt(result.fetchedAt);
      setStale(result.status === 'stale');
      setStatus(statusFromRefresh(result.rows, result.status));
    } catch {
      if (mounted.current) {
        setStatus((value) => (value === 'loading' ? 'error' : value));
      }
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [ean, refreshing]);

  const lowest = useMemo(() => lowestComparablePrice(rows), [rows]);
  const mixedPresentations = useMemo(() => presentationsDiffer(rows), [rows]);
  const ageLabel = useMemo(() => dataAgeLabel(fetchedAt), [fetchedAt]);
  const old = useMemo(() => isOldMarketData(fetchedAt), [fetchedAt]);

  return {
    rows,
    fetchedAt,
    status,
    stale,
    refreshing,
    refresh,
    lowest,
    mixedPresentations,
    ageLabel,
    old,
  };
}
