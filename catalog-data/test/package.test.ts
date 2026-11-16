import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { buildPackages, productsFor, type Manifest } from '../src/package.ts';
import { BARCODE_SQL, SEARCH_CANDIDATES, SEARCH_SQL, looksLikeBarcode, matchQuery } from '../src/search.ts';
import { SYNTHETIC_SOURCE, syntheticProducts } from '../src/synthetic.ts';
import { buildTaxonomy, readTaxonomyFiles } from '../src/taxonomy.ts';
import { validateProduct } from '../src/validate.ts';
import type { Product } from '../src/types.ts';
import { ROOT, TEST_SOURCES, product, testTaxonomy } from './fixtures.ts';

const tax = testTaxonomy();
const valid = (raw: Record<string, unknown>): Product => {
  const r = validateProduct(raw, tax);
  assert.deepEqual(r.issues, []);
  return r.product!;
};

const PRODUCTS: Product[] = [
  valid(product()),
  valid(product({ id: 'prueba:cafe', name: 'Café Águila Roja 250 g', brand: 'Águila Roja', category: 'abarrotes', presentation: { quantity: 250, unit: 'g' }, synonyms: ['Tinto molido'], barcodes: ['7702032102013'], business_types: ['tienda'] })),
  valid(product({ id: 'prueba:martillo', name: 'Martillo de uña 16 oz', brand: 'Stanley', category: 'herramientas', presentation: undefined, synonyms: undefined, barcodes: ['076174510126'], business_types: ['ferreteria'] })),
];

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

function build(products = PRODUCTS, version = '2026.11.16'): { dir: string; manifest: Manifest } {
  const dir = mkdtempSync(join(tmpdir(), 'paquete-'));
  return { dir, manifest: buildPackages(dir, products, tax, { catalogVersion: version }) };
}

test('matchQuery convierte lo escrito en prefijos sin tildes y sin operadores de FTS5', () => {
  assert.equal(matchQuery('Café  águila'), '"cafe"* "aguila"*');
  assert.equal(matchQuery('arroz OR "x" NEAR(y)'), '"arroz"* "or"* "x"* "near"* "y"*');
  assert.equal(matchQuery('  ¿?  '), null);
  assert.equal(matchQuery('a b c d e f g h')!.split(' ').length, 6);
  assert.equal(looksLikeBarcode(' 7702511000045 '), true);
  assert.equal(looksLikeBarcode('arroz 500'), false);
});

test('se genera un paquete por tipo de negocio con productos, solo si tiene productos', () => {
  const { dir, manifest } = build();
  try {
    assert.deepEqual(manifest.packages.map((p) => [p.id, p.items]), [['ferreteria', 1], ['minimercado', 1], ['tienda', 2]]);
    assert.equal(manifest.license, 'ODbL-1.0');
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')), manifest);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('el manifest declara tamaños y sha256 exactos de cada archivo', () => {
  const { dir, manifest } = build();
  try {
    for (const p of manifest.packages) {
      const raw = readFileSync(join(dir, p.file));
      const gz = readFileSync(join(dir, p.gzip_file));
      assert.equal(raw.length, p.bytes);
      assert.equal(sha(raw), p.sha256);
      assert.equal(gz.length, p.gzip_bytes);
      assert.equal(sha(gz), p.gzip_sha256);
      assert.deepEqual(gunzipSync(gz), raw);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('la compilación es reproducible: mismos datos, mismos bytes', () => {
  const a = build();
  const b = build([...PRODUCTS].reverse());
  try {
    assert.deepEqual(a.manifest.packages.map((p) => p.gzip_sha256), b.manifest.packages.map((p) => p.gzip_sha256));
  } finally {
    rmSync(a.dir, { recursive: true, force: true });
    rmSync(b.dir, { recursive: true, force: true });
  }
});

test('el paquete busca por prefijo sin tildes, por marca, por sinónimo y por código', () => {
  const { dir } = build();
  const db = new DatabaseSync(join(dir, 'tienda.sqlite'), { readOnly: true });
  try {
    const search = db.prepare(SEARCH_SQL);
    const names = (q: string) => search.all(matchQuery(q)!, 10).map((r) => (r as { name: string }).name);
    assert.deepEqual(names('cafe agui'), ['Café Águila Roja 250 g']);
    assert.deepEqual(names('ARR'), ['Arroz Diana 500 g']);
    assert.deepEqual(names('tinto'), ['Café Águila Roja 250 g']);
    assert.deepEqual(names('diana'), ['Arroz Diana 500 g']);
    assert.deepEqual(names('martillo'), []);
    const hit = db.prepare(BARCODE_SQL).get('7702032102013') as { id: string; unit: string; pres_qty: number; pres_unit: string };
    assert.deepEqual({ id: hit.id, unit: hit.unit, pres_qty: hit.pres_qty, pres_unit: hit.pres_unit }, { id: 'prueba:cafe', unit: 'unit', pres_qty: 250, pres_unit: 'g' });
    const meta = Object.fromEntries(db.prepare('SELECT key, value FROM meta').all().map((r) => [(r as { key: string }).key, (r as { value: string }).value]));
    assert.deepEqual(meta, { business_type: 'tienda', catalog_version: '2026.11.16', format_version: '1', items: '2' });
    const sources = db.prepare('SELECT id, license, attribution FROM sources').all().map((r) => ({ ...r }));
    assert.deepEqual(sources, [{ id: 'prueba', license: 'ODbL-1.0', attribution: '© Prueba, ODbL' }]);
    const cats = db.prepare('SELECT id FROM categories ORDER BY id').all().map((r) => (r as { id: string }).id);
    assert.deepEqual(cats, ['abarrotes', 'granos']);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('los nombres más cortos van primero, para que la búsqueda corte temprano', () => {
  const list = productsFor('tienda', PRODUCTS).map((p) => p.name);
  assert.deepEqual(list, ['Arroz Diana 500 g', 'Café Águila Roja 250 g']);
  assert.ok(SEARCH_CANDIDATES >= 100);
});

test('los datos sintéticos son deterministas y pasan el validador', () => {
  const { taxonomy } = buildTaxonomy({ ...readTaxonomyFiles(ROOT), sources: [SYNTHETIC_SOURCE] });
  const a = syntheticProducts(2000, taxonomy);
  assert.deepEqual(syntheticProducts(2000, taxonomy), a);
  const errors = a.flatMap((p) => validateProduct(p, taxonomy).issues.filter((i) => i.level === 'error'));
  assert.deepEqual(errors, []);
  assert.equal(new Set(a.flatMap((p) => p.barcodes ?? [])).size, a.filter((p) => p.barcodes).length);
});

const BUILD = fileURLToPath(new URL('../src/cli/build.ts', import.meta.url));

function workspace(lines: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'catalogo-build-'));
  cpSync(join(ROOT, 'taxonomy'), join(dir, 'taxonomy'), { recursive: true });
  mkdirSync(join(dir, 'sources'));
  cpSync(join(ROOT, 'sources/licenses.json'), join(dir, 'sources/licenses.json'));
  writeFileSync(join(dir, 'sources/sources.json'), JSON.stringify(TEST_SOURCES));
  mkdirSync(join(dir, 'data/prueba'), { recursive: true });
  writeFileSync(join(dir, 'data/prueba/a.jsonl'), lines.join('\n') + '\n');
  return dir;
}

test('el comando build compila desde data/ y se niega si hay errores o falta la versión', () => {
  const ok = workspace([JSON.stringify(product())]);
  const bad = workspace([JSON.stringify(product({ category: 'joyeria' }))]);
  try {
    const run = (dir: string, ...extra: string[]) => spawnSync(process.execPath, ['--no-warnings', BUILD, `--root=${dir}`, `--out=${join(dir, 'dist')}`, ...extra], { encoding: 'utf8' });
    const good = run(ok, '--version=2026.11.16');
    assert.equal(good.status, 0, good.stdout + good.stderr);
    assert.match(good.stdout, /Catálogo 2026\.11\.16: 1 productos, 2 paquetes/);
    const manifest = JSON.parse(readFileSync(join(ok, 'dist/manifest.json'), 'utf8')) as Manifest;
    assert.deepEqual(manifest.packages.map((p) => p.id), ['minimercado', 'tienda']);
    assert.equal(run(bad, '--version=2026.11.16').status, 1);
    assert.equal(run(ok).status, 2);
    assert.equal(run(ok, '--version=v1').status, 2);
  } finally {
    rmSync(ok, { recursive: true, force: true });
    rmSync(bad, { recursive: true, force: true });
  }
});
