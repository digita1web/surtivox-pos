export interface ComparableMarketPrice {
  price_minor: number;
  supermarket_name: string;
  presentation: string | null;
}

export interface LowestComparablePrice {
  price_minor: number;
  supermarket_name: string;
  presentation: string;
}

export interface LowestMarketPrice {
  price_minor: number;
  supermarket_name: string;
}

const UNIT_ALIASES: Record<string, string> = {
  g: 'g',
  gr: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  lb: 'lb',
  un: 'un',
  und: 'un',
  unidad: 'un',
  unidades: 'un',
  pack: 'pack',
  paquete: 'pack',
  paquetes: 'pack',
  botella: 'botella',
  botellas: 'botella',
};

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

export function normalizePresentation(value: string | null | undefined): string | null {
  const text = (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!text) return null;
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gr|ml|l|lb|un|und|unidad|unidades|pack|paquete|paquetes|botella|botellas)\b/);
  if (!match?.[1] || !match[2]) return text;
  let quantity = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(quantity) || quantity <= 0) return text;
  let unit = UNIT_ALIASES[match[2]] ?? match[2];
  if (unit === 'g' && quantity >= 1000) {
    quantity /= 1000;
    unit = 'kg';
  }
  if (unit === 'ml' && quantity >= 1000) {
    quantity /= 1000;
    unit = 'l';
  }
  return `${formatQuantity(quantity)} ${unit}`;
}

export function presentationsDiffer(rows: readonly ComparableMarketPrice[]): boolean {
  if (rows.length < 2) return false;
  const normalized = rows.map((row) => normalizePresentation(row.presentation));
  const known = normalized.filter((value): value is string => value !== null);
  return known.length < rows.length || new Set(known).size > 1;
}

export function lowestComparablePrice(
  rows: readonly ComparableMarketPrice[],
): LowestComparablePrice | null {
  const groups = new Map<string, ComparableMarketPrice[]>();
  for (const row of rows) {
    const presentation = normalizePresentation(row.presentation);
    if (!presentation) continue;
    const group = groups.get(presentation) ?? [];
    group.push(row);
    groups.set(presentation, group);
  }
  const comparable = [...groups.entries()]
    .filter(([, group]) => group.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)[0];
  if (!comparable) return null;
  const [presentation, group] = comparable;
  const lowest = group.reduce((best, row) => (row.price_minor < best.price_minor ? row : best));
  return {
    price_minor: lowest.price_minor,
    supermarket_name: lowest.supermarket_name,
    presentation,
  };
}

export function lowestMarketPrice(
  rows: readonly ComparableMarketPrice[],
): LowestMarketPrice | null {
  if (rows.length === 0) return null;
  const lowest = rows.reduce((best, row) => (row.price_minor < best.price_minor ? row : best));
  return {
    price_minor: lowest.price_minor,
    supermarket_name: lowest.supermarket_name,
  };
}

export function dataAgeLabel(fetchedAt: number | null | undefined, now = Date.now()): string | null {
  if (!fetchedAt || fetchedAt <= 0) return null;
  const elapsed = Math.max(0, now - fetchedAt);
  if (elapsed < 60_000) return 'hace menos de 1 min';
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
}
