import { isValidGtin } from '../gtin.ts';
import { foldKey, isShouting, normalizeName } from '../normalize.ts';
import type { Presentation, Taxonomy } from '../types.ts';
import { validateProduct } from '../validate.ts';

export interface OffRaw {
  code?: unknown;
  product_name?: unknown;
  product_name_es?: unknown;
  brands?: unknown;
  quantity?: unknown;
  categories_tags?: unknown;
  countries_tags?: unknown;
  lang?: unknown;
}

export interface CategoryRule {
  tag: string;
  category: string;
}

export type TransformResult =
  | { ok: true; product: Record<string, unknown> }
  | { ok: false; reason: string; detail?: string };

const UNIT_ALIASES: Record<string, { unit: string; scale: number }> = {
  g: { unit: 'g', scale: 1 }, gr: { unit: 'g', scale: 1 }, grs: { unit: 'g', scale: 1 }, gramos: { unit: 'g', scale: 1 },
  kg: { unit: 'kg', scale: 1 }, kgs: { unit: 'kg', scale: 1 }, kilo: { unit: 'kg', scale: 1 }, kilos: { unit: 'kg', scale: 1 },
  mg: { unit: 'mg', scale: 1 },
  ml: { unit: 'ml', scale: 1 }, cc: { unit: 'ml', scale: 1 }, cl: { unit: 'ml', scale: 10 },
  l: { unit: 'L', scale: 1 }, lt: { unit: 'L', scale: 1 }, lts: { unit: 'L', scale: 1 }, litro: { unit: 'L', scale: 1 }, litros: { unit: 'L', scale: 1 },
  lb: { unit: 'lb', scale: 1 }, libra: { unit: 'lb', scale: 1 }, libras: { unit: 'lb', scale: 1 },
  und: { unit: 'unit', scale: 1 }, unds: { unit: 'unit', scale: 1 }, un: { unit: 'unit', scale: 1 }, unidad: { unit: 'unit', scale: 1 }, unidades: { unit: 'unit', scale: 1 },
};

const num = (s: string) => Number(s.replace(',', '.'));
const round = (n: number) => Math.round(n * 1000) / 1000;

export function parseQuantity(text: unknown): Presentation | null {
  if (typeof text !== 'string') return null;
  const t = text.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();
  const multi = /^(\d{1,4})\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*([a-z]+)\.?$/.exec(t);
  if (multi) {
    const u = UNIT_ALIASES[multi[3]!];
    const count = Number(multi[1]);
    const q = round(num(multi[2]!) * (u?.scale ?? 1));
    if (!u || u.unit === 'unit' || count < 2 || count > 1000 || !(q > 0)) return null;
    return { quantity: q, unit: u.unit, count };
  }
  const single = /^(?:x\s*)?(\d+(?:[.,]\d+)?)\s*([a-z]+)\.?$/.exec(t);
  if (!single) return null;
  const u = UNIT_ALIASES[single[2]!];
  const q = round(num(single[1]!) * (u?.scale ?? 1));
  if (!u || !(q > 0) || q > 1_000_000) return null;
  if (u.unit === 'unit' && (!Number.isInteger(q) || q < 2)) return null;
  return { quantity: q, unit: u.unit };
}

export function presentationText(p: Presentation): string {
  if (p.unit === 'unit') return `x ${p.quantity}`;
  const q = String(p.quantity);
  return p.count ? `${p.count} x ${q} ${p.unit}` : `${q} ${p.unit}`;
}

export function pickBrand(brands: unknown): string | null {
  if (typeof brands !== 'string') return null;
  const first = brands.split(',').map((b) => normalizeName(b)).find((b) => b.length >= 2 && b.length <= 60);
  return first ? brandCase(first) : null;
}

const MEASURE_IN_NAME = /\d\s?(?:mg|g|kg|ml|L|lb)\b/;

export function hasMeasure(name: string): boolean {
  return MEASURE_IN_NAME.test(normalizeName(name));
}

export function presentationFits(name: string, pres: Presentation | null): Presentation | null {
  if (!pres || !hasMeasure(name)) return pres;
  return ` ${foldKey(normalizeName(name))} `.includes(` ${foldKey(presentationText(pres))} `) ? pres : null;
}

export function composeName(base: string, brand: string | null, pres: Presentation | null): string {
  let name = normalizeName(base);
  const key = () => ` ${foldKey(name)} `;
  if (brand && !key().includes(` ${foldKey(brand)} `)) name = `${name} ${brand}`;
  if (pres && !hasMeasure(name)) {
    const text = presentationText(pres);
    if (!key().includes(` ${foldKey(text)} `)) name = `${name} ${text}`;
  }
  name = normalizeName(name);
  return name.charAt(0).toLocaleUpperCase('es') + name.slice(1);
}

export const NAME_RULES: readonly { pattern: RegExp; category: string }[] = [
  { pattern: /\bmalta\b/, category: 'bebidas' },
];

export function categoryByName(name: string): string | null {
  const key = foldKey(name);
  return NAME_RULES.find((r) => r.pattern.test(key))?.category ?? null;
}

export function mapCategory(tags: unknown, rules: readonly CategoryRule[]): string | null {
  if (!Array.isArray(tags)) return null;
  const set = new Set(tags.filter((t): t is string => typeof t === 'string'));
  for (const rule of rules) if (set.has(rule.tag)) return rule.category;
  return null;
}

const SPANISH_MARKERS = /\b(de|del|con|sin|para|la|el|los|las|leche|agua|arroz|galletas?|bebida|jugo|sal|aceite|harina|queso|pan|cafe|chocolate|crema|yogurt|avena|frijol|azucar|panela|salsa|mantequilla|margarina|toallitas|pa[nñ]ales|jabon|detergente|gaseosa|refresco|cereal|natural|entera|integral|tostado|maiz|platano|papas?)\b/;
const ENGLISH_MARKERS = /\b(the|and|with|water|milk|whole|juice|cookies?|sugar|free|protection|flavor|flavored|drink|chips|snack bar|peanut)\b/;

export function looksSpanish(name: string): boolean {
  const key = foldKey(name);
  if (ENGLISH_MARKERS.test(key)) return false;
  return /[áéíóúñü]/i.test(name) || SPANISH_MARKERS.test(key);
}

function spanishName(raw: OffRaw, code: string): string | null {
  const es = typeof raw.product_name_es === 'string' ? raw.product_name_es.trim() : '';
  if (es) return es;
  const any = typeof raw.product_name === 'string' ? raw.product_name.trim() : '';
  if (!any) return null;
  if (raw.lang === 'es') return any;
  return code.startsWith('770') && looksSpanish(any) ? any : null;
}

export function brandCase(brand: string): string {
  if (!isShouting(brand)) return brand;
  const single = !/\s/.test(brand);
  return brand.replace(/\p{L}+/gu, (word) => (single && word.length <= 3 ? word : word.charAt(0) + word.slice(1).toLowerCase()));
}

export function transformOff(raw: OffRaw, rules: readonly CategoryRule[], tax: Taxonomy, retrievedAt: string): TransformResult {
  const code = typeof raw.code === 'string' ? raw.code.trim() : '';
  if (!isValidGtin(code)) return { ok: false, reason: 'gtin_invalido', detail: code };
  if (!Array.isArray(raw.countries_tags) || !raw.countries_tags.includes('en:colombia')) return { ok: false, reason: 'no_vendido_en_colombia' };
  const base = spanishName(raw, code);
  if (!base) return { ok: false, reason: 'sin_nombre_en_espanol' };
  if (/\d{6,}/.test(base)) return { ok: false, reason: 'nombre_con_codigo', detail: base };
  if (isShouting(base)) return { ok: false, reason: 'nombre_en_mayusculas', detail: base };
  if (foldKey(base).length < 3) return { ok: false, reason: 'nombre_muy_corto', detail: base };
  const brand = pickBrand(raw.brands);
  if (!brand) return { ok: false, reason: 'sin_marca' };
  const category = categoryByName(base) ?? mapCategory(raw.categories_tags, rules);
  if (!category) return { ok: false, reason: 'categoria_sin_equivalencia' };
  const cat = tax.categories.get(category);
  if (!cat) return { ok: false, reason: 'categoria_inexistente', detail: category };
  const pres = presentationFits(base, parseQuantity(raw.quantity));
  const product: Record<string, unknown> = {
    id: `off:${code}`,
    name: composeName(base, brand, pres),
    brand,
    category,
    unit: 'unit',
    barcodes: [code],
    business_types: [...cat.business_types],
    source: { id: 'off', ref: code, retrieved_at: retrievedAt },
    license: 'ODbL-1.0',
  };
  if (pres) product['presentation'] = pres;
  const check = validateProduct(product, tax);
  const errors = check.issues.filter((i) => i.level === 'error');
  if (errors.length) return { ok: false, reason: `validador:${errors[0]!.code}`, detail: errors[0]!.message };
  if (check.issues.some((i) => i.code === 'texto_en_mayusculas')) return { ok: false, reason: 'texto_en_mayusculas', detail: String(product['name']) };
  return { ok: true, product };
}
