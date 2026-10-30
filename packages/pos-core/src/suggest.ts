import type { Bps, Minor } from '@surtivox/types';
import { add, applyRate, asBps, asMinor, format, roundHalfAwayFromZero } from './money.ts';

export interface SuggestedPrice {
  label: string;
  price: Minor;
}

export interface DescribeMarginInput {
  price: Minor;
  reference?: Minor | null;
  cost?: Minor | null;
  referenceName?: string;
}

export type MarginTone = 'neutral' | 'warn' | 'danger';

export interface MarginDescription {
  text: string;
  tone: MarginTone;
}

const COP = { code: 'COP', locale: 'es-CO', decimals: 0 } as const;

function moneyText(amount: Minor): string {
  return format(amount, COP).replace(/\u00A0/g, ' ');
}

function percent(part: number, whole: number): number {
  return roundHalfAwayFromZero((part * 100) / whole);
}

export function roundToStep(amount: Minor, step: number): Minor {
  if (!Number.isSafeInteger(amount)) throw new RangeError('amount must be an integer');
  if (!Number.isSafeInteger(step) || step <= 0) throw new RangeError('step must be a positive integer');
  return asMinor(roundHalfAwayFromZero(amount / step) * step);
}

export function priceStep(amount: Minor): number {
  return amount < 1000 ? 50 : 100;
}

export function suggestPrices(input: {
  reference?: Minor | null;
  markupsBps?: readonly number[];
}): SuggestedPrice[] {
  const reference = input.reference ?? null;
  if (reference === null || reference <= 0) return [];

  const result: SuggestedPrice[] = [{ label: 'Igualar', price: reference }];
  const seen = new Set<number>([reference]);
  const markups = input.markupsBps ?? [2000, 3000];

  for (const markup of markups) {
    if (!Number.isFinite(markup) || markup <= 0) continue;
    const target = add(reference, applyRate(reference, asBps(Math.round(markup)) as Bps));
    const price = roundToStep(target, priceStep(reference));
    if (price <= 0 || seen.has(price)) continue;
    seen.add(price);
    result.push({ label: `+${Math.round(markup) / 100}%`, price });
  }

  return result;
}

export function describeMargin(input: DescribeMarginInput): MarginDescription {
  const reference = input.reference ?? null;
  const cost = input.cost ?? null;
  const referenceName = input.referenceName?.trim() || 'la referencia';

  if (cost !== null && cost > 0) {
    if (input.price < cost) return { text: 'Vendes por debajo de tu costo', tone: 'danger' };
    const profit = asMinor(input.price - cost);
    const profitPct = percent(profit, cost);
    const overReference = reference !== null && reference > 0
      && roundHalfAwayFromZero(((input.price - reference) * 10000) / reference) > 2500;
    return {
      text: `Ganas ${moneyText(profit)} por unidad (${profitPct}%)`,
      tone: overReference ? 'warn' : 'neutral',
    };
  }

  if (reference !== null && reference > 0) {
    const diff = input.price - reference;
    if (diff === 0) return { text: `Igual al precio más bajo (${referenceName})`, tone: 'neutral' };
    if (diff > 0) {
      const diffPct = percent(diff, reference);
      const tone: MarginTone = roundHalfAwayFromZero((diff * 10000) / reference) > 2500 ? 'warn' : 'neutral';
      return {
        text: `Estás ${moneyText(asMinor(diff))} por encima de ${referenceName} (${diffPct}%)`,
        tone,
      };
    }
    return {
      text: `Estás ${moneyText(asMinor(-diff))} por debajo de ${referenceName}`,
      tone: 'neutral',
    };
  }

  return { text: 'Precio de venta definido', tone: 'neutral' };
}
