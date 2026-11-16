import type { SQLiteDatabase } from 'expo-sqlite';

export const CATALOG_PACK_BASE = 'https://digita1web.github.io/surtivox-pos/catalogo';
export const PACK_FORMAT_VERSION = 1;
export const PACK_SETTING = 'catalog_pack';
export const PACK_TYPE_SETTING = 'catalog_pack_type';
export const MAX_PACK_BYTES = 60 * 1024 * 1024;

export const BUSINESS_TYPES = [
  { id: 'tienda', name: 'Tienda de barrio' },
  { id: 'minimercado', name: 'Minimercado' },
  { id: 'drogueria', name: 'Droguería' },
  { id: 'ferreteria', name: 'Ferretería' },
  { id: 'papeleria', name: 'Papelería' },
  { id: 'licorera', name: 'Licorera' },
] as const;

export type BusinessTypeId = (typeof BUSINESS_TYPES)[number]['id'];

export function isBusinessType(value: unknown): value is BusinessTypeId {
  return BUSINESS_TYPES.some((t) => t.id === value);
}

export interface PackInfo {
  id: string;
  file: string;
  items: number;
  bytes: number;
  sha256: string;
}

export interface PackManifest {
  format_version: number;
  catalog_version: string;
  license: string;
  packages: PackInfo[];
}

export interface InstalledPack {
  type: BusinessTypeId;
  version: string;
  sha256: string;
  items: number;
  bytes: number;
  installedAt: number;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseManifest(raw: unknown): PackManifest {
  const bad = (why: string) => new Error(`El catálogo publicado no es válido: ${why}`);
  if (!isObject(raw)) throw bad('no es un objeto');
  if (raw['format_version'] !== PACK_FORMAT_VERSION) throw bad('formato no compatible con esta versión de la app');
  const version = raw['catalog_version'];
  if (typeof version !== 'string' || !/^\d{4}\.\d{2}\.\d{2}(?:-\d+)?$/.test(version)) throw bad('versión inválida');
  const license = raw['license'];
  if (typeof license !== 'string' || !license) throw bad('falta la licencia');
  const list = raw['packages'];
  if (!Array.isArray(list)) throw bad('falta la lista de paquetes');
  const packages: PackInfo[] = list.map((p) => {
    if (!isObject(p)) throw bad('paquete inválido');
    const { id, file, items, bytes, sha256 } = p;
    if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id)) throw bad('id de paquete inválido');
    if (typeof file !== 'string' || !/^[a-z0-9-]+\.sqlite$/.test(file)) throw bad(`archivo inválido en ${id}`);
    if (typeof items !== 'number' || !Number.isInteger(items) || items < 1) throw bad(`cantidad inválida en ${id}`);
    if (typeof bytes !== 'number' || !Number.isInteger(bytes) || bytes < 1 || bytes > MAX_PACK_BYTES) throw bad(`tamaño inválido en ${id}`);
    if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) throw bad(`sha256 inválido en ${id}`);
    return { id, file, items, bytes, sha256 };
  });
  return { format_version: PACK_FORMAT_VERSION, catalog_version: version, license, packages };
}

export function packageFor(manifest: PackManifest, type: BusinessTypeId): PackInfo | null {
  return manifest.packages.find((p) => p.id === type) ?? null;
}

export function parseInstalled(raw: string | null): InstalledPack | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!isObject(v) || !isBusinessType(v['type'])) return null;
    const { version, sha256, items, bytes, installedAt } = v;
    if (typeof version !== 'string' || typeof sha256 !== 'string' || typeof items !== 'number' || typeof bytes !== 'number' || typeof installedAt !== 'number') return null;
    return { type: v['type'], version, sha256, items, bytes, installedAt };
  } catch {
    return null;
  }
}

export function isUpToDate(installed: InstalledPack | null, type: BusinessTypeId, pkg: PackInfo): boolean {
  return !!installed && installed.type === type && installed.sha256 === pkg.sha256;
}

export function packFileName(type: BusinessTypeId): string {
  return `catalogo-${type}.sqlite`;
}

export function packUrl(base: string, pkg: PackInfo): string {
  return `${base.replace(/\/+$/, '')}/${pkg.file}?v=${pkg.sha256.slice(0, 12)}`;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX = new Int16Array(128).fill(-1);
for (let i = 0; i < B64.length; i++) B64_INDEX[B64.charCodeAt(i)] = i;

export function base64ToBytes(text: string): Uint8Array {
  const clean = text.replace(/[\s=]+/g, '');
  if (clean.length % 4 === 1) throw new Error('base64 inválido');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    let chunk = 0;
    let n = 0;
    for (let j = 0; j < 4; j++) {
      const c = clean.charCodeAt(i + j);
      if (Number.isNaN(c)) { chunk <<= 6; continue; }
      const v = c < 128 ? B64_INDEX[c]! : -1;
      if (v < 0) throw new Error('base64 inválido');
      chunk = (chunk << 6) | v;
      n++;
    }
    if (n === 4) { out[o++] = (chunk >> 16) & 255; out[o++] = (chunk >> 8) & 255; out[o++] = chunk & 255; }
    else if (n === 3) { out[o++] = (chunk >> 16) & 255; out[o++] = (chunk >> 8) & 255; }
    else if (n === 2) { out[o++] = (chunk >> 16) & 255; }
  }
  return out.subarray(0, o);
}

export function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i]!.toString(16).padStart(2, '0');
  return s;
}

export const MAX_QUERY_TOKENS = 6;

export function foldKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]+/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function matchQuery(input: string): string | null {
  const tokens = foldKey(input).split(' ').filter(Boolean).slice(0, MAX_QUERY_TOKENS);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(' ');
}

export const SEARCH_CANDIDATES = 300;

export const SEARCH_SQL = `
SELECT p.id, p.name, p.brand, p.category_id, p.unit, p.pres_qty, p.pres_unit, p.pres_count
FROM (
  SELECT rowid AS rid, bm25(products_fts, 10.0, 4.0, 2.0) AS score
  FROM products_fts
  WHERE products_fts MATCH ?
  LIMIT ${SEARCH_CANDIDATES}
) c
JOIN products p ON p.rowid = c.rid
ORDER BY c.score, length(p.name), p.rowid
LIMIT ?`;

export const BARCODE_SQL = `
SELECT p.id, p.name, p.brand, p.category_id, p.unit, p.pres_qty, p.pres_unit, p.pres_count
FROM barcodes b JOIN products p ON p.rowid = b.product_rowid
WHERE b.code = ?`;

export const FIRST_BARCODE_SQL = 'SELECT b.code FROM barcodes b JOIN products p ON p.rowid = b.product_rowid WHERE p.id = ? ORDER BY b.code LIMIT 1';

export interface PackRow {
  id: string;
  name: string;
  brand: string | null;
  category_id: string;
  unit: string;
}

export interface PackHit {
  id: string;
  name: string;
  brand: string | null;
  unit: string;
  categoryName: string | null;
}

export type PackDb = Pick<SQLiteDatabase, 'getAllAsync' | 'getFirstAsync'>;

const categoryCache = new WeakMap<object, Map<string, string>>();

async function categoryNames(db: PackDb): Promise<Map<string, string>> {
  const cached = categoryCache.get(db);
  if (cached) return cached;
  const rows = await db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM categories');
  const map = new Map(rows.map((r) => [r.id, r.name]));
  categoryCache.set(db, map);
  return map;
}

async function toHits(db: PackDb, rows: PackRow[]): Promise<PackHit[]> {
  const names = await categoryNames(db);
  return rows.map((r) => ({ id: r.id, name: r.name, brand: r.brand, unit: r.unit, categoryName: names.get(r.category_id) ?? null }));
}

export async function searchPackOn(db: PackDb, query: string, limit = 6): Promise<PackHit[]> {
  const match = matchQuery(query);
  if (!match || foldKey(query).length < 2) return [];
  return toHits(db, await db.getAllAsync<PackRow>(SEARCH_SQL, [match, limit]));
}

export async function barcodePackOn(db: PackDb, code: string): Promise<PackHit | null> {
  const row = await db.getFirstAsync<PackRow>(BARCODE_SQL, [code.trim()]);
  return row ? (await toHits(db, [row]))[0]! : null;
}

export async function firstBarcodeOn(db: PackDb, productId: string): Promise<string | null> {
  return (await db.getFirstAsync<{ code: string }>(FIRST_BARCODE_SQL, [productId]))?.code ?? null;
}

export async function checkPackOn(db: PackDb, type: BusinessTypeId): Promise<void> {
  const rows = await db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM meta WHERE key IN ('format_version','business_type')");
  const meta = new Map(rows.map((r) => [r.key, r.value]));
  if (meta.get('format_version') !== String(PACK_FORMAT_VERSION) || meta.get('business_type') !== type) {
    throw new Error('El archivo del catálogo no corresponde a este tipo de negocio o a esta versión de la app.');
  }
}

export async function attributionOn(db: PackDb): Promise<string[]> {
  const rows = await db.getAllAsync<{ attribution: string; name: string }>('SELECT name, attribution FROM sources ORDER BY id');
  return rows.map((r) => r.attribution || r.name);
}

export interface PackIo {
  fetchManifest(url: string): Promise<unknown>;
  download(url: string, path: string): Promise<void>;
  sha256(path: string): Promise<string>;
  size(path: string): Promise<number | null>;
  move(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
  release(): Promise<void>;
  verify(path: string, type: BusinessTypeId): Promise<void>;
  readSetting(key: string): Promise<string | null>;
  writeSetting(key: string, value: string): Promise<void>;
  now(): number;
}

export type InstallResult = { status: 'installed' | 'up_to_date'; pack: InstalledPack; version: string };

export async function installPackOn(io: PackIo, opts: { base: string; dir: string; type: BusinessTypeId }): Promise<InstallResult> {
  const manifest = parseManifest(await io.fetchManifest(`${opts.base.replace(/\/+$/, '')}/manifest.json`));
  const pkg = packageFor(manifest, opts.type);
  if (!pkg) throw new Error('Todavía no hay catálogo publicado para este tipo de negocio.');
  const installed = parseInstalled(await io.readSetting(PACK_SETTING));
  if (installed && isUpToDate(installed, opts.type, pkg)) return { status: 'up_to_date', pack: installed, version: manifest.catalog_version };

  const target = `${opts.dir}${packFileName(opts.type)}`;
  const part = `${target}.part`;
  await io.remove(part);
  try {
    await io.download(packUrl(opts.base, pkg), part);
    const size = await io.size(part);
    if (size !== pkg.bytes) throw new Error(`La descarga quedó incompleta (${size ?? 0} de ${pkg.bytes} bytes). Intenta de nuevo con buena señal.`);
    if ((await io.sha256(part)) !== pkg.sha256) throw new Error('El catálogo descargado no coincide con el publicado (sha256 distinto). No se instaló.');
    await io.verify(part, opts.type);
    await io.release();
    if (installed && installed.type !== opts.type) await io.remove(`${opts.dir}${packFileName(installed.type)}`);
    await io.remove(target);
    await io.move(part, target);
  } catch (e) {
    await io.remove(part);
    throw e;
  }
  const pack: InstalledPack = { type: opts.type, version: manifest.catalog_version, sha256: pkg.sha256, items: pkg.items, bytes: pkg.bytes, installedAt: io.now() };
  await io.writeSetting(PACK_SETTING, JSON.stringify(pack));
  await io.writeSetting(PACK_TYPE_SETTING, opts.type);
  return { status: 'installed', pack, version: manifest.catalog_version };
}
