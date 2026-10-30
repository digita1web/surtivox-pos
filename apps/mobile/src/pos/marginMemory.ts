import { roundHalfAwayFromZero } from '@surtivox/pos-core';

export const DEFAULT_MARKUPS_BPS = [2000, 3000] as const;

export function parseLastMarkup(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 500 || parsed > 10000 || parsed % 500 !== 0) return null;
  return parsed;
}

export function markupsForLast(value: string | null): number[] {
  const current = parseLastMarkup(value);
  const values = current === null ? [...DEFAULT_MARKUPS_BPS] : [current, ...DEFAULT_MARKUPS_BPS];
  return [...new Set(values)];
}

export function implicitMarkupBps(price: number, reference: number): number | null {
  if (reference <= 0 || price <= 0) return null;
  const raw = roundHalfAwayFromZero(((price - reference) * 10000) / reference);
  const rounded = roundHalfAwayFromZero(raw / 500) * 500;
  if (rounded < 500 || rounded > 10000) return null;
  return rounded;
}
