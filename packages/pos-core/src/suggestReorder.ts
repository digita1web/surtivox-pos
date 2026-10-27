export interface SalesPoint {
  date: string;
  quantity: number;
}

export interface ReorderOptions {
  lookbackDays?: number;
  fallbackLookbackDays?: number;
  coverDays?: number;
  maxUnits?: number;
  medianMultiplier?: number;
}

export interface ReorderSuggestion {
  unitsPerDay: number;
  daysOfStockLeft: number | null;
  suggestedQuantity: number;
  urgency: 'critical' | 'low' | 'ok';
  usedFallbackWindow: boolean;
  cappedBy: 'none' | 'maxUnits' | 'median';
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function isoDateDaysAgo(days: number): string {
  const now = new Date();
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  return cutoff.toISOString().slice(0, 10);
}

function pointsWithinDays(sales: readonly SalesPoint[], days: number): SalesPoint[] {
  const cutoff = isoDateDaysAgo(days);
  return sales.filter((point) => point.date >= cutoff);
}

function sumQuantities(points: readonly SalesPoint[]): number {
  return points.reduce((total, point) => total + point.quantity, 0);
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

export function suggestReorder(
  sales: SalesPoint[],
  currentStock: number,
  options?: ReorderOptions,
): ReorderSuggestion {
  const lookbackDays = Math.max(1, options?.lookbackDays ?? 14);
  const fallbackLookbackDays = Math.max(1, options?.fallbackLookbackDays ?? 28);
  const coverDays = Math.max(0, options?.coverDays ?? 7);
  const maxUnits = Math.max(0, options?.maxUnits ?? 500);
  const medianMultiplier = Math.max(0, options?.medianMultiplier ?? 3);
  const normalizedStock = Math.max(0, currentStock);

  let usedFallbackWindow = false;
  let windowDays = lookbackDays;
  let windowSales = pointsWithinDays(sales, lookbackDays);

  if (windowSales.length === 0) {
    const fallbackSales = pointsWithinDays(sales, fallbackLookbackDays);
    if (fallbackSales.some((point) => point.quantity > 0)) {
      windowSales = fallbackSales;
      windowDays = fallbackLookbackDays;
      usedFallbackWindow = true;
    }
  }

  const totalQuantity = sumQuantities(windowSales);
  const unitsPerDay = roundToTwoDecimals(totalQuantity / windowDays);

  if (unitsPerDay === 0) {
    return {
      unitsPerDay: 0,
      daysOfStockLeft: null,
      suggestedQuantity: 0,
      urgency: 'ok',
      usedFallbackWindow,
      cappedBy: 'none',
    };
  }

  const daysOfStockLeft = normalizedStock / unitsPerDay;
  let suggestedQuantity = Math.max(0, Math.ceil(unitsPerDay * coverDays) - normalizedStock);
  let cappedBy: ReorderSuggestion['cappedBy'] = 'none';

  const soldQuantities = windowSales
    .filter((point) => point.quantity > 0)
    .map((point) => point.quantity);
  const medianDaily = median(soldQuantities);

  if (medianDaily > 0) {
    const medianCap = Math.ceil(medianDaily * medianMultiplier * coverDays);
    if (suggestedQuantity > medianCap) {
      suggestedQuantity = medianCap;
      cappedBy = 'median';
    }
  }

  if (suggestedQuantity > maxUnits && cappedBy === 'none') {
    suggestedQuantity = maxUnits;
    cappedBy = 'maxUnits';
  }

  const urgency: ReorderSuggestion['urgency'] =
    daysOfStockLeft <= 3 ? 'critical' : daysOfStockLeft <= 7 ? 'low' : 'ok';

  return {
    unitsPerDay,
    daysOfStockLeft,
    suggestedQuantity: Math.round(suggestedQuantity),
    urgency,
    usedFallbackWindow,
    cappedBy,
  };
}
