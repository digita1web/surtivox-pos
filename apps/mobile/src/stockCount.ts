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
