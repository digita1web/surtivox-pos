export type CountKind = 'faltante' | 'sobrante' | 'sin_diferencia';

export interface CountDiff {
  delta: number;
  kind: CountKind;
  units: number;
  value: number;
}

export function countDiff(expected: number, counted: number, unitCost: number): CountDiff {
  const delta = counted - expected;
  const units = Math.abs(delta);
  const kind: CountKind = delta < 0 ? 'faltante' : delta > 0 ? 'sobrante' : 'sin_diferencia';
  return { delta, kind, units, value: units * Math.max(0, unitCost) };
}

export function parseCounted(text: string): number | null {
  const clean = text.trim();
  if (!/^\d{1,7}$/.test(clean)) return null;
  return Number(clean);
}

export function diffLabel(diff: Pick<CountDiff, 'kind' | 'units'>): string {
  if (diff.kind === 'sin_diferencia') return 'Sin diferencia';
  const noun = diff.units === 1 ? 'unidad' : 'unidades';
  return diff.kind === 'faltante' ? `Faltante: ${diff.units} ${noun}` : `Sobrante: ${diff.units} ${noun}`;
}

export interface CountableProduct {
  id: string;
  name: string;
  barcode?: string | null;
  sku?: string | null;
  track_inventory?: number;
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function countableProducts<T extends CountableProduct>(products: readonly T[]): T[] {
  return products.filter((p) => (p.track_inventory ?? 1) === 1);
}

export function searchCountable<T extends CountableProduct>(products: readonly T[], query: string, limit = 40): T[] {
  const q = fold(query);
  if (!q) return [];
  const words = q.split(/\s+/);
  return countableProducts(products)
    .filter((p) => p.barcode === query.trim() || (p.sku ?? '').toLowerCase() === q || words.every((w) => fold(p.name).includes(w)))
    .slice(0, limit);
}

export function productForCode<T extends CountableProduct>(products: readonly T[], code: string): T | null {
  const c = code.trim();
  if (!c) return null;
  return countableProducts(products).find((p) => p.barcode === c || (p.sku ?? '') === c) ?? null;
}

export type CountPeriod = 'hoy' | '7d' | '30d' | 'todo';

export const PERIOD_LABEL: Record<CountPeriod, string> = {
  hoy: 'Hoy',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  todo: 'Todo',
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function periodRange(period: CountPeriod, now: number): { from: number; to: number } {
  const to = now + 1;
  if (period === 'todo') return { from: 0, to };
  if (period === 'hoy') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return { from: d.getTime(), to };
  }
  return { from: now - (period === '7d' ? 7 : 30) * DAY_MS, to };
}
