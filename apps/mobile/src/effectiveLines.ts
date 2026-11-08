export function mulDivRound(a: number, b: number, c: number): number {
  if (c === 0) return 0;
  const num = BigInt(a) * BigInt(b);
  const den = BigInt(c);
  const negative = num < 0n !== den < 0n;
  const absNum = num < 0n ? -num : num;
  const absDen = den < 0n ? -den : den;
  const q = (2n * absNum + absDen) / (2n * absDen);
  return Number(negative ? -q : q);
}

export function allocateLargestRemainder(total: number, weights: readonly number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  if (!Number.isSafeInteger(total) || total < 0) throw new RangeError('El total a repartir debe ser un entero no negativo');
  const sum = weights.reduce((acc, w) => acc + w, 0);
  const equal = sum <= 0;
  const effectiveWeights = equal ? weights.map(() => 1) : weights;
  const denominator = BigInt(equal ? n : sum);
  const bigTotal = BigInt(total);
  const floors: bigint[] = [];
  const remainders: bigint[] = [];
  let assigned = 0n;
  for (const w of effectiveWeights) {
    const product = bigTotal * BigInt(Math.max(0, w));
    floors.push(product / denominator);
    remainders.push(product % denominator);
    assigned += product / denominator;
  }
  let left = Number(bigTotal - assigned);
  const order = remainders
    .map((remainder, index) => ({ remainder, index }))
    .sort((a, b) => (a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1));
  const out = floors.map((f) => Number(f));
  for (let i = 0; left > 0 && i < order.length; i++, left--) out[order[i]!.index]! += 1;
  return out;
}

export interface EffectiveItemInput {
  id: string;
  quantity: number;
  line_total: number;
  tax: number;
  returned?: number;
  refunded?: number;
  refunded_tax?: number;
}

export interface EffectiveItem {
  id: string;
  effectiveTotal: number;
  effectiveTax: number;
}

export function effectiveItems(saleTotal: number, items: readonly EffectiveItemInput[]): EffectiveItem[] {
  const totals = allocateLargestRemainder(saleTotal, items.map((i) => i.line_total));
  return items.map((item, index) => {
    const effectiveTotal = totals[index]!;
    const effectiveTax = item.line_total > 0
      ? Math.min(effectiveTotal, mulDivRound(item.tax, effectiveTotal, item.line_total))
      : 0;
    return { id: item.id, effectiveTotal, effectiveTax };
  });
}

export interface RefundShare { id: string; line: number; tax: number }

export function computeReturnRefunds(
  saleTotal: number,
  items: readonly EffectiveItemInput[],
  picks: ReadonlyArray<{ saleItemId: string; quantity: number }>,
): RefundShare[] {
  const effective = effectiveItems(saleTotal, items);
  const shares: RefundShare[] = [];
  for (const pick of picks) {
    if (pick.quantity <= 0) continue;
    const index = items.findIndex((i) => i.id === pick.saleItemId);
    if (index < 0) continue;
    const item = items[index]!;
    const eff = effective[index]!;
    const done = (item.returned ?? 0) + pick.quantity;
    const alreadyLine = item.refunded ?? 0;
    const alreadyTax = item.refunded_tax ?? 0;
    const lineTarget = mulDivRound(eff.effectiveTotal, done, item.quantity);
    const line = Math.max(0, Math.min(lineTarget - alreadyLine, eff.effectiveTotal - alreadyLine));
    const taxTarget = mulDivRound(eff.effectiveTax, done, item.quantity);
    const tax = Math.max(0, Math.min(taxTarget - alreadyTax, eff.effectiveTax - alreadyTax, line));
    shares.push({ id: item.id, line, tax });
  }
  return shares;
}

export type RefundChoice = 'cash' | 'card' | 'bank' | 'account';

export function allowedRefundMethods(paymentMethod: string, hasCustomer: boolean): RefundChoice[] {
  if (paymentMethod === 'credit') return hasCustomer ? ['account'] : [];
  const direct: RefundChoice = paymentMethod === 'cash' ? 'cash' : paymentMethod === 'card' ? 'card' : 'bank';
  return hasCustomer ? [direct, 'account'] : [direct];
}

const PAID_WITH: Record<string, string> = {
  cash: 'efectivo',
  card: 'tarjeta',
  bank: 'transferencia',
  wallet: 'Nequi o Daviplata',
};

export function refundMethodError(paymentMethod: string, hasCustomer: boolean): string {
  if (paymentMethod === 'credit') {
    return hasCustomer
      ? 'Esta venta fue fiada y no se ha pagado en caja: la devolución solo se puede abonar a la cuenta del cliente.'
      : 'Esta venta fue fiada y no tiene cliente: no se puede devolver.';
  }
  const label = PAID_WITH[paymentMethod] ?? 'otro medio';
  return hasCustomer
    ? `Esta venta se pagó con ${label}: devuelve por ese medio o a la cuenta del cliente.`
    : `Esta venta se pagó con ${label}: la devolución debe hacerse por ese medio.`;
}
