import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BusinessType, Category, Issue, License, Source, Taxonomy, Unit } from './types.ts';

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UNIT_ID = /^[A-Za-z]{1,8}$/;
const KINDS = new Set(['count', 'mass', 'volume', 'length']);
const STATUSES = new Set(['approved', 'pending', 'rejected']);

export interface TaxonomyFiles {
  businessTypes: unknown;
  categories: unknown;
  units: unknown;
  licenses: unknown;
  sources: unknown;
}

export function readTaxonomyFiles(root: string): TaxonomyFiles {
  const read = (path: string): unknown => JSON.parse(readFileSync(join(root, path), 'utf8'));
  return {
    businessTypes: read('taxonomy/business-types.json'),
    categories: read('taxonomy/categories.json'),
    units: read('taxonomy/units.json'),
    licenses: read('sources/licenses.json'),
    sources: read('sources/sources.json'),
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v === v.trim();

function list(raw: unknown, file: string, issues: Issue[]): Record<string, unknown>[] {
  if (!Array.isArray(raw)) {
    issues.push({ level: 'error', code: 'taxonomia_no_es_lista', message: `${file} debe ser una lista`, file });
    return [];
  }
  return raw.filter((item, i) => {
    if (isObject(item)) return true;
    issues.push({ level: 'error', code: 'taxonomia_elemento_invalido', message: `${file}[${i}] no es un objeto`, file });
    return false;
  });
}

function collect<T extends { id: string }>(
  items: Record<string, unknown>[],
  file: string,
  issues: Issue[],
  idPattern: RegExp,
  check: (item: Record<string, unknown>, fail: (msg: string) => void) => T | null,
): Map<string, T> {
  const out = new Map<string, T>();
  for (const item of items) {
    const id = item['id'];
    const fail = (message: string) => issues.push({ level: 'error', code: 'taxonomia_campo_invalido', message, file, id: typeof id === 'string' ? id : undefined });
    if (typeof id !== 'string' || !idPattern.test(id)) {
      fail(`${file}: id inválido ${JSON.stringify(id)}`);
      continue;
    }
    if (out.has(id)) {
      issues.push({ level: 'error', code: 'taxonomia_id_duplicado', message: `${file}: id repetido ${id}`, file, id });
      continue;
    }
    const value = check(item, fail);
    if (value) out.set(id, value);
  }
  return out;
}

export function buildTaxonomy(files: TaxonomyFiles): { taxonomy: Taxonomy; issues: Issue[] } {
  const issues: Issue[] = [];

  const businessTypes = collect<BusinessType>(list(files.businessTypes, 'business-types.json', issues), 'business-types.json', issues, SLUG, (it, fail) => {
    if (!isText(it['name']) || !isText(it['description'])) { fail(`business-types.json: ${String(it['id'])} necesita name y description`); return null; }
    return { id: it['id'] as string, name: it['name'], description: it['description'] };
  });

  const categories = collect<Category>(list(files.categories, 'categories.json', issues), 'categories.json', issues, SLUG, (it, fail) => {
    const types = it['business_types'];
    if (!isText(it['name']) || !isText(it['emoji'])) { fail(`categories.json: ${String(it['id'])} necesita name y emoji`); return null; }
    if (!Array.isArray(types) || types.length === 0 || !types.every((t) => typeof t === 'string')) {
      fail(`categories.json: ${String(it['id'])} necesita business_types`);
      return null;
    }
    const unknown = types.filter((t) => !businessTypes.has(t as string));
    if (unknown.length) { fail(`categories.json: ${String(it['id'])} usa tipos de negocio inexistentes: ${unknown.join(', ')}`); return null; }
    if (new Set(types).size !== types.length) { fail(`categories.json: ${String(it['id'])} repite tipos de negocio`); return null; }
    return { id: it['id'] as string, name: it['name'], emoji: it['emoji'], business_types: types as string[] };
  });

  const names = new Map<string, string>();
  for (const c of categories.values()) {
    const key = c.name.toLowerCase();
    const other = names.get(key);
    if (other) issues.push({ level: 'error', code: 'taxonomia_nombre_duplicado', message: `categories.json: ${c.id} y ${other} se llaman igual`, file: 'categories.json', id: c.id });
    names.set(key, c.id);
  }

  const units = collect<Unit>(list(files.units, 'units.json', issues), 'units.json', issues, UNIT_ID, (it, fail) => {
    const factor = it['factor'];
    if (!isText(it['name']) || !isText(it['plural'])) { fail(`units.json: ${String(it['id'])} necesita name y plural`); return null; }
    if (typeof it['kind'] !== 'string' || !KINDS.has(it['kind'])) { fail(`units.json: ${String(it['id'])} tiene kind inválido`); return null; }
    if (typeof factor !== 'number' || !Number.isFinite(factor) || factor <= 0) { fail(`units.json: ${String(it['id'])} tiene factor inválido`); return null; }
    if (typeof it['sale'] !== 'boolean' || typeof it['presentation'] !== 'boolean') { fail(`units.json: ${String(it['id'])} necesita sale y presentation booleanos`); return null; }
    return { id: it['id'] as string, name: it['name'], plural: it['plural'], kind: it['kind'] as Unit['kind'], factor, sale: it['sale'], presentation: it['presentation'] };
  });

  const licenses = collect<License>(list(files.licenses, 'licenses.json', issues), 'licenses.json', issues, /^[A-Za-z0-9.-]+$/, (it, fail) => {
    if (!isText(it['name']) || !isText(it['url']) || !/^https:\/\//.test(it['url'])) { fail(`licenses.json: ${String(it['id'])} necesita name y url https`); return null; }
    for (const key of ['compatible', 'share_alike', 'attribution']) {
      if (typeof it[key] !== 'boolean') { fail(`licenses.json: ${String(it['id'])} necesita ${key} booleano`); return null; }
    }
    return { id: it['id'] as string, name: it['name'], url: it['url'], compatible: it['compatible'] as boolean, share_alike: it['share_alike'] as boolean, attribution: it['attribution'] as boolean };
  });

  const sources = collect<Source>(list(files.sources, 'sources.json', issues), 'sources.json', issues, SLUG, (it, fail) => {
    const license = it['license'];
    if (!isText(it['name']) || !isText(it['url']) || !/^https:\/\//.test(it['url'])) { fail(`sources.json: ${String(it['id'])} necesita name y url https`); return null; }
    if (typeof license !== 'string' || !licenses.has(license)) { fail(`sources.json: ${String(it['id'])} tiene una licencia desconocida`); return null; }
    if (typeof it['status'] !== 'string' || !STATUSES.has(it['status'])) { fail(`sources.json: ${String(it['id'])} tiene status inválido`); return null; }
    const lic = licenses.get(license)!;
    if (lic.attribution && !isText(it['attribution'])) { fail(`sources.json: ${String(it['id'])} exige atribución y no la tiene`); return null; }
    if (it['status'] === 'approved' && !lic.compatible) { fail(`sources.json: ${String(it['id'])} está aprobada con una licencia incompatible (${license})`); return null; }
    if (it['notes'] !== undefined && typeof it['notes'] !== 'string') { fail(`sources.json: ${String(it['id'])} tiene notes inválido`); return null; }
    const source: Source = {
      id: it['id'] as string, name: it['name'], url: it['url'], license,
      attribution: typeof it['attribution'] === 'string' ? it['attribution'] : '', status: it['status'] as Source['status'],
    };
    if (typeof it['notes'] === 'string') source.notes = it['notes'];
    return source;
  });

  return { taxonomy: { businessTypes, categories, units, licenses, sources }, issues };
}

export function loadTaxonomy(root: string): { taxonomy: Taxonomy; issues: Issue[] } {
  return buildTaxonomy(readTaxonomyFiles(root));
}
