import { isValidGtin } from './gtin.ts';
import { foldKey, hasControlChars, isShouting, normalizeName } from './normalize.ts';
import type { Issue, Presentation, Product, ProductSource, Taxonomy } from './types.ts';

export const PRODUCT_FIELDS = ['id', 'name', 'brand', 'category', 'unit', 'presentation', 'synonyms', 'barcodes', 'business_types', 'source', 'license'] as const;
export const REQUIRED_FIELDS = ['id', 'name', 'category', 'unit', 'business_types', 'source', 'license'] as const;
const PRESENTATION_FIELDS = new Set(['quantity', 'unit', 'count']);
const SOURCE_FIELDS = new Set(['id', 'ref', 'retrieved_at']);
const ID_PATTERN = /^([a-z0-9]+(?:-[a-z0-9]+)*):[A-Za-z0-9._-]{1,80}$/;
const MAX_SYNONYMS = 20;
const MAX_BARCODES = 10;

export interface Location {
  file?: string;
  line?: number;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function checkText(value: unknown, label: string, min: number, max: number, err: (code: string, msg: string) => void, warn: (code: string, msg: string) => void): string | null {
  if (typeof value !== 'string') { err('tipo_invalido', `${label} debe ser texto`); return null; }
  if (hasControlChars(value)) { err('caracteres_de_control', `${label} tiene caracteres de control`); return null; }
  if (value !== normalizeName(value)) { err('texto_sin_normalizar', `${label} no está normalizado: ${JSON.stringify(value)} → ${JSON.stringify(normalizeName(value))}`); return null; }
  if (value.length < min || value.length > max) { err('largo_invalido', `${label} debe tener entre ${min} y ${max} caracteres`); return null; }
  if (isShouting(value)) warn('texto_en_mayusculas', `${label} está todo en mayúsculas: ${JSON.stringify(value)}`);
  return value;
}

function checkPresentation(raw: unknown, tax: Taxonomy, err: (code: string, msg: string) => void): Presentation | null {
  if (!isObject(raw)) { err('presentacion_invalida', 'presentation debe ser un objeto'); return null; }
  const extra = Object.keys(raw).filter((k) => !PRESENTATION_FIELDS.has(k));
  if (extra.length) { err('campo_desconocido', `presentation tiene campos desconocidos: ${extra.join(', ')}`); return null; }
  const { quantity, unit, count } = raw;
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) { err('presentacion_invalida', 'presentation.quantity debe ser un número mayor que 0'); return null; }
  const u = typeof unit === 'string' ? tax.units.get(unit) : undefined;
  if (!u || !u.presentation) { err('unidad_invalida', `presentation.unit no es una unidad de presentación: ${JSON.stringify(unit)}`); return null; }
  const out: Presentation = { quantity, unit: u.id };
  if (count !== undefined) {
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 2 || count > 1000) { err('presentacion_invalida', 'presentation.count debe ser un entero entre 2 y 1000'); return null; }
    out.count = count;
  }
  return out;
}

function checkSource(raw: unknown, idPrefix: string | null, tax: Taxonomy, err: (code: string, msg: string) => void): ProductSource | null {
  if (!isObject(raw)) { err('fuente_invalida', 'source debe ser un objeto'); return null; }
  const extra = Object.keys(raw).filter((k) => !SOURCE_FIELDS.has(k));
  if (extra.length) { err('campo_desconocido', `source tiene campos desconocidos: ${extra.join(', ')}`); return null; }
  const id = raw['id'];
  const source = typeof id === 'string' ? tax.sources.get(id) : undefined;
  if (!source) { err('fuente_desconocida', `source.id no está registrada en sources.json: ${JSON.stringify(id)}`); return null; }
  if (source.status !== 'approved') { err('fuente_no_aprobada', `la fuente ${source.id} está en estado ${source.status}; no se puede ingerir`); return null; }
  if (idPrefix !== null && idPrefix !== source.id) { err('id_fuente_distinta', `el prefijo del id (${idPrefix}) no coincide con source.id (${source.id})`); return null; }
  const out: ProductSource = { id: source.id };
  if (raw['ref'] !== undefined) {
    if (typeof raw['ref'] !== 'string' || !raw['ref'] || raw['ref'].length > 200) { err('fuente_invalida', 'source.ref debe ser texto de hasta 200 caracteres'); return null; }
    out.ref = raw['ref'];
  }
  if (raw['retrieved_at'] !== undefined) {
    const d = raw['retrieved_at'];
    if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(`${d}T00:00:00Z`)) || new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) !== d) {
      err('fecha_invalida', 'source.retrieved_at debe ser una fecha AAAA-MM-DD');
      return null;
    }
    out.retrieved_at = d;
  }
  return out;
}

export function validateProduct(raw: unknown, tax: Taxonomy, at: Location = {}): { product: Product | null; issues: Issue[] } {
  const issues: Issue[] = [];
  const rawId = isObject(raw) && typeof raw['id'] === 'string' ? raw['id'] : undefined;
  const push = (level: Issue['level']) => (code: string, message: string) => {
    const issue: Issue = { level, code, message, ...at };
    if (rawId !== undefined) issue.id = rawId;
    issues.push(issue);
  };
  const err = push('error');
  const warn = push('warning');

  if (!isObject(raw)) { err('registro_invalido', 'cada línea debe ser un objeto JSON'); return { product: null, issues }; }
  const extra = Object.keys(raw).filter((k) => !(PRODUCT_FIELDS as readonly string[]).includes(k));
  if (extra.length) err('campo_desconocido', `campos desconocidos: ${extra.join(', ')}`);
  const missing = REQUIRED_FIELDS.filter((k) => raw[k] === undefined);
  if (missing.length) err('campo_obligatorio', `faltan campos obligatorios: ${missing.join(', ')}`);
  if (extra.length || missing.length) return { product: null, issues };

  const match = typeof raw['id'] === 'string' ? ID_PATTERN.exec(raw['id']) : null;
  if (!match) err('id_invalido', `id debe tener la forma fuente:clave, recibido ${JSON.stringify(raw['id'])}`);

  const name = checkText(raw['name'], 'name', 2, 120, err, warn);
  const brand = raw['brand'] === undefined ? undefined : checkText(raw['brand'], 'brand', 1, 60, err, warn);

  const category = typeof raw['category'] === 'string' ? tax.categories.get(raw['category']) : undefined;
  if (!category) err('categoria_desconocida', `category no existe: ${JSON.stringify(raw['category'])}`);

  const unit = typeof raw['unit'] === 'string' ? tax.units.get(raw['unit']) : undefined;
  if (!unit || !unit.sale) err('unidad_invalida', `unit no es una unidad de venta: ${JSON.stringify(raw['unit'])}`);

  const types = raw['business_types'];
  let businessTypes: string[] | null = null;
  if (!Array.isArray(types) || types.length === 0 || !types.every((t) => typeof t === 'string')) {
    err('tipos_de_negocio_invalidos', 'business_types debe ser una lista no vacía de ids');
  } else if (new Set(types).size !== types.length) {
    err('tipos_de_negocio_invalidos', 'business_types tiene ids repetidos');
  } else {
    const unknown = types.filter((t) => !tax.businessTypes.has(t));
    if (unknown.length) err('tipo_de_negocio_desconocido', `business_types inexistentes: ${unknown.join(', ')}`);
    else {
      businessTypes = types as string[];
      if (category) {
        const outside = businessTypes.filter((t) => !category.business_types.includes(t));
        if (outside.length) err('categoria_fuera_de_negocio', `la categoría ${category.id} no aplica a: ${outside.join(', ')}`);
      }
    }
  }

  const presentation = raw['presentation'] === undefined ? undefined : checkPresentation(raw['presentation'], tax, err);

  let synonyms: string[] | undefined;
  if (raw['synonyms'] !== undefined) {
    const list = raw['synonyms'];
    if (!Array.isArray(list) || list.length === 0 || list.length > MAX_SYNONYMS) {
      err('sinonimos_invalidos', `synonyms debe ser una lista de 1 a ${MAX_SYNONYMS} textos`);
    } else {
      const keys = new Set<string>(name ? [foldKey(name)] : []);
      const out: string[] = [];
      for (const s of list) {
        const text = checkText(s, 'synonyms[]', 2, 80, err, warn);
        if (text === null) continue;
        const key = foldKey(text);
        if (keys.has(key)) { err('sinonimo_repetido', `sinónimo repetido o igual al nombre: ${JSON.stringify(text)}`); continue; }
        keys.add(key);
        out.push(text);
      }
      synonyms = out;
    }
  }

  let barcodes: string[] | undefined;
  if (raw['barcodes'] !== undefined) {
    const list = raw['barcodes'];
    if (!Array.isArray(list) || list.length === 0 || list.length > MAX_BARCODES || !list.every((b) => typeof b === 'string')) {
      err('codigos_invalidos', `barcodes debe ser una lista de 1 a ${MAX_BARCODES} textos`);
    } else if (new Set(list).size !== list.length) {
      err('codigo_repetido', 'barcodes tiene códigos repetidos');
    } else {
      const bad = list.filter((b) => !isValidGtin(b));
      if (bad.length) err('gtin_invalido', `códigos GTIN inválidos (largo o dígito de control): ${bad.join(', ')}`);
      else barcodes = list as string[];
    }
  }

  const source = checkSource(raw['source'], match ? match[1]! : null, tax, err);
  const license = raw['license'];
  if (source) {
    const expected = tax.sources.get(source.id)!.license;
    if (license !== expected) err('licencia_distinta', `license (${JSON.stringify(license)}) no coincide con la de la fuente (${expected})`);
  }

  if (issues.some((i) => i.level === 'error')) return { product: null, issues };

  const product: Product = {
    id: raw['id'] as string,
    name: name!,
    category: category!.id,
    unit: unit!.id,
    business_types: businessTypes!,
    source: source!,
    license: license as string,
  };
  if (brand) product.brand = brand;
  if (presentation) product.presentation = presentation;
  if (synonyms && synonyms.length) product.synonyms = synonyms;
  if (barcodes) product.barcodes = barcodes;
  return { product, issues };
}

export function duplicateKey(p: Product): string {
  const pres = p.presentation ? `${p.presentation.quantity}${p.presentation.unit}x${p.presentation.count ?? 1}` : '';
  return `${foldKey(p.brand ?? '')}|${foldKey(p.name)}|${pres}`;
}

export class CatalogChecker {
  private readonly ids = new Map<string, Location>();
  private readonly barcodes = new Map<string, string>();
  private readonly keys = new Map<string, string>();
  count = 0;

  add(p: Product, at: Location = {}): Issue[] {
    const issues: Issue[] = [];
    const first = this.ids.get(p.id);
    if (first) {
      issues.push({ level: 'error', code: 'id_duplicado', message: `id repetido; ya aparece en ${first.file ?? '?'}:${first.line ?? '?'}`, id: p.id, ...at });
      return issues;
    }
    this.ids.set(p.id, at);
    this.count++;
    for (const code of p.barcodes ?? []) {
      const owner = this.barcodes.get(code);
      if (owner) issues.push({ level: 'error', code: 'codigo_en_dos_productos', message: `el código ${code} ya pertenece a ${owner}`, id: p.id, ...at });
      else this.barcodes.set(code, p.id);
    }
    const key = duplicateKey(p);
    const twin = this.keys.get(key);
    if (twin) issues.push({ level: 'warning', code: 'posible_duplicado', message: `mismo nombre, marca y presentación que ${twin}`, id: p.id, ...at });
    else this.keys.set(key, p.id);
    return issues;
  }
}
