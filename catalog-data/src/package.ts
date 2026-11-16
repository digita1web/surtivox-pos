import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { gzipSync } from 'node:zlib';
import { foldKey } from './normalize.ts';
import type { Product, Taxonomy } from './types.ts';

export const FORMAT_VERSION = 1;

export type FtsDetail = 'full' | 'column' | 'none';

export interface BuildOptions {
  catalogVersion: string;
  detail?: FtsDetail;
  gzip?: boolean;
}

export interface PackageInfo {
  id: string;
  file: string;
  items: number;
  bytes: number;
  sha256: string;
  gzip_file?: string;
  gzip_bytes?: number;
  gzip_sha256?: string;
  sources: string[];
}

export interface Manifest {
  format_version: number;
  catalog_version: string;
  license: string;
  packages: PackageInfo[];
}

const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

const SCHEMA = (detail: FtsDetail) => `
PRAGMA page_size = 4096;
PRAGMA journal_mode = OFF;
PRAGMA synchronous = OFF;
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, emoji TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE units (id TEXT PRIMARY KEY, name TEXT NOT NULL, plural TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE sources (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, license TEXT NOT NULL, attribution TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE products (
  rowid INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT,
  category_id TEXT NOT NULL,
  unit TEXT NOT NULL,
  pres_qty REAL,
  pres_unit TEXT,
  pres_count INTEGER,
  source_id TEXT NOT NULL
);
CREATE TABLE barcodes (code TEXT PRIMARY KEY, product_rowid INTEGER NOT NULL) WITHOUT ROWID;
CREATE VIRTUAL TABLE products_fts USING fts5(
  name, brand, synonyms,
  content = '',
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3',
  detail = ${detail}
);
`;

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function productsFor(businessType: string, products: readonly Product[]): Product[] {
  return products
    .filter((p) => p.business_types.includes(businessType))
    .map((p) => ({ p, key: foldKey(p.name) }))
    .sort((a, b) => a.key.length - b.key.length || compare(a.key, b.key) || compare(a.p.id, b.p.id))
    .map(({ p }) => p);
}

export function buildPackageDb(path: string, businessType: string, products: readonly Product[], tax: Taxonomy, opts: BuildOptions): void {
  rmSync(path, { force: true });
  const db = new DatabaseSync(path);
  try {
    db.exec(SCHEMA(opts.detail ?? 'none'));
    db.exec('BEGIN');
    const meta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    meta.run('format_version', String(FORMAT_VERSION));
    meta.run('catalog_version', opts.catalogVersion);
    meta.run('business_type', businessType);
    meta.run('items', String(products.length));

    const usedCategories = new Set(products.map((p) => p.category));
    const cat = db.prepare('INSERT INTO categories (id, name, emoji) VALUES (?, ?, ?)');
    for (const c of [...tax.categories.values()].filter((c) => usedCategories.has(c.id))) cat.run(c.id, c.name, c.emoji);
    const unit = db.prepare('INSERT INTO units (id, name, plural) VALUES (?, ?, ?)');
    for (const u of tax.units.values()) unit.run(u.id, u.name, u.plural);
    const usedSources = [...new Set(products.map((p) => p.source.id))].sort();
    const src = db.prepare('INSERT INTO sources (id, name, url, license, attribution) VALUES (?, ?, ?, ?, ?)');
    for (const id of usedSources) {
      const s = tax.sources.get(id)!;
      src.run(s.id, s.name, s.url, s.license, s.attribution);
    }

    const insert = db.prepare('INSERT INTO products (rowid, id, name, brand, category_id, unit, pres_qty, pres_unit, pres_count, source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const code = db.prepare('INSERT INTO barcodes (code, product_rowid) VALUES (?, ?)');
    const fts = db.prepare('INSERT INTO products_fts (rowid, name, brand, synonyms) VALUES (?, ?, ?, ?)');
    products.forEach((p, i) => {
      const rowid = i + 1;
      insert.run(rowid, p.id, p.name, p.brand ?? null, p.category, p.unit, p.presentation?.quantity ?? null, p.presentation?.unit ?? null, p.presentation?.count ?? null, p.source.id);
      for (const b of p.barcodes ?? []) code.run(b, rowid);
      fts.run(rowid, p.name, p.brand ?? '', (p.synonyms ?? []).join(' · '));
    });
    db.exec('COMMIT');
    db.exec("INSERT INTO products_fts (products_fts) VALUES ('optimize')");
    db.exec('VACUUM');
  } finally {
    db.close();
  }
}

export function buildPackages(outDir: string, products: readonly Product[], tax: Taxonomy, opts: BuildOptions): Manifest {
  mkdirSync(outDir, { recursive: true });
  const packages: PackageInfo[] = [];
  for (const type of [...tax.businessTypes.keys()].sort()) {
    const subset = productsFor(type, products);
    if (subset.length === 0) continue;
    const file = `${type}.sqlite`;
    const path = join(outDir, file);
    buildPackageDb(path, type, subset, tax, opts);
    const raw = readFileSync(path);
    const info: PackageInfo = {
      id: type, file, items: subset.length, bytes: raw.length, sha256: sha256(raw),
      sources: [...new Set(subset.map((p) => p.source.id))].sort(),
    };
    if (opts.gzip !== false) {
      const gz = gzipSync(raw, { level: 9 });
      info.gzip_file = `${file}.gz`;
      info.gzip_bytes = gz.length;
      info.gzip_sha256 = sha256(gz);
      writeFileSync(join(outDir, info.gzip_file), gz);
    }
    packages.push(info);
  }
  const manifest: Manifest = { format_version: FORMAT_VERSION, catalog_version: opts.catalogVersion, license: 'ODbL-1.0', packages };
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
