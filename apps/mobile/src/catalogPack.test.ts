import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import * as core from '../../../catalog-data/src/search.ts';
import { foldKey as coreFold } from '../../../catalog-data/src/normalize.ts';
import { buildPackages } from '../../../catalog-data/src/package.ts';
import { loadTaxonomy } from '../../../catalog-data/src/taxonomy.ts';
import { validateProduct } from '../../../catalog-data/src/validate.ts';
import type { Product } from '../../../catalog-data/src/types.ts';
import {
  BUSINESS_TYPES, PACK_SETTING, PACK_TYPE_SETTING, attributionOn, barcodePackOn, base64ToBytes, bytesToHex, checkPackOn, firstBarcodeOn,
  foldKey, installPackOn, isUpToDate, matchQuery, packUrl, parseInstalled, parseManifest, searchPackOn,
  BARCODE_SQL, SEARCH_SQL, type PackDb, type PackIo,
} from './catalogPack.ts';

const CATALOG = new URL('../../../catalog-data/', import.meta.url);
const SHA = 'a'.repeat(64);
const manifest = (packages: unknown[] = [{ id: 'tienda', file: 'tienda.sqlite', items: 3, bytes: 4096, sha256: SHA }]) =>
  ({ format_version: 1, catalog_version: '2026.11.16', license: 'ODbL-1.0', packages });

test('la búsqueda de la app es idéntica a la de catalog-data', () => {
  assert.equal(SEARCH_SQL, core.SEARCH_SQL);
  assert.equal(BARCODE_SQL, core.BARCODE_SQL);
  for (const q of ['Café águila', 'ARROZ  diana 500g', 'piña', 'Ñame', '¿?', 'a b c d e f g h', 'Pan de bono!']) {
    assert.equal(matchQuery(q), core.matchQuery(q), q);
    assert.equal(foldKey(q), coreFold(q), q);
  }
});

test('los tipos de negocio de la app son los de catalog-data', () => {
  const types = JSON.parse(readFileSync(new URL('taxonomy/business-types.json', CATALOG), 'utf8')) as { id: string; name: string }[];
  assert.deepEqual(BUSINESS_TYPES.map((t) => ({ id: t.id, name: t.name })), types.map((t) => ({ id: t.id, name: t.name })));
});

test('parseManifest acepta el formato publicado y rechaza lo inválido', () => {
  assert.equal(parseManifest(manifest()).packages[0]!.file, 'tienda.sqlite');
  const bad = (m: unknown) => assert.throws(() => parseManifest(m), /no es válido/);
  bad(null);
  bad({ ...manifest(), format_version: 2 });
  bad({ ...manifest(), catalog_version: 'ayer' });
  bad(manifest([{ id: 'tienda', file: '../x.sqlite', items: 3, bytes: 10, sha256: SHA }]));
  bad(manifest([{ id: 'tienda', file: 'tienda.sqlite', items: 0, bytes: 10, sha256: SHA }]));
  bad(manifest([{ id: 'tienda', file: 'tienda.sqlite', items: 3, bytes: 10, sha256: 'xyz' }]));
  bad(manifest([{ id: 'tienda', file: 'tienda.sqlite', items: 3, bytes: 999_999_999, sha256: SHA }]));
});

test('base64ToBytes y bytesToHex coinciden con Node para tamaños variados', () => {
  for (const n of [0, 1, 2, 3, 4, 5, 100, 4097]) {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 255);
    const b64 = Buffer.from(bytes).toString('base64');
    assert.deepEqual(Array.from(base64ToBytes(b64)), Array.from(bytes), String(n));
    assert.equal(bytesToHex(bytes), Buffer.from(bytes).toString('hex'));
  }
  assert.deepEqual(Array.from(base64ToBytes('aGVs\nbG8=')), Array.from(Buffer.from('hello')));
  assert.throws(() => base64ToBytes('a*b='));
});

test('parseInstalled e isUpToDate deciden si hay que descargar', () => {
  const inst = { type: 'tienda', version: '2026.11.16', sha256: SHA, items: 3, bytes: 4096, installedAt: 1 };
  assert.deepEqual(parseInstalled(JSON.stringify(inst)), inst);
  assert.equal(parseInstalled('{roto'), null);
  assert.equal(parseInstalled(JSON.stringify({ ...inst, type: 'joyeria' })), null);
  const pkg = parseManifest(manifest()).packages[0]!;
  assert.equal(isUpToDate(parseInstalled(JSON.stringify(inst)), 'tienda', pkg), true);
  assert.equal(isUpToDate(parseInstalled(JSON.stringify(inst)), 'drogueria', pkg), false);
  assert.equal(isUpToDate(parseInstalled(JSON.stringify({ ...inst, sha256: 'b'.repeat(64) })), 'tienda', pkg), false);
  assert.equal(packUrl('https://x.test/catalogo/', pkg), `https://x.test/catalogo/tienda.sqlite?v=${SHA.slice(0, 12)}`);
});

function realPack() {
  const { taxonomy } = loadTaxonomy(join(CATALOG.pathname));
  const raw = [
    { id: 'surtivox:cafe', name: 'Café molido por libra', category: 'abarrotes', unit: 'lb', synonyms: ['Tinto para preparar'], business_types: ['tienda'], source: { id: 'surtivox' }, license: 'ODbL-1.0' },
    { id: 'surtivox:arroz', name: 'Arroz blanco por libra', category: 'granos', unit: 'lb', business_types: ['tienda'], source: { id: 'surtivox' }, license: 'ODbL-1.0' },
    { id: 'off:7702011000019', name: 'Galletas de leche Colombina 12 g', brand: 'Colombina', category: 'snacks', unit: 'unit', barcodes: ['7702011000019'], business_types: ['tienda'], source: { id: 'off', ref: '7702011000019' }, license: 'ODbL-1.0' },
  ];
  const products = raw.map((r) => {
    const v = validateProduct(r, taxonomy);
    assert.deepEqual(v.issues, []);
    return v.product as Product;
  });
  const dir = mkdtempSync(join(tmpdir(), 'pack-app-'));
  buildPackages(dir, products, taxonomy, { catalogVersion: '2026.11.16', gzip: false });
  return { dir, db: new DatabaseSync(join(dir, 'tienda.sqlite'), { readOnly: true }) };
}

function adapter(db: DatabaseSync): PackDb {
  return {
    getAllAsync: async (sql: string, params: unknown[] = []) => db.prepare(sql).all(...(params as (string | number)[])),
    getFirstAsync: async (sql: string, params: unknown[] = []) => db.prepare(sql).get(...(params as (string | number)[])) ?? null,
  } as unknown as PackDb;
}

test('la app busca en un paquete real por nombre sin tildes, sinónimo y código', async () => {
  const { dir, db } = realPack();
  try {
    const a = adapter(db);
    assert.deepEqual((await searchPackOn(a, 'cafe')).map((h) => h.name), ['Café molido por libra']);
    assert.deepEqual((await searchPackOn(a, 'tinto')).map((h) => h.name), ['Café molido por libra']);
    assert.deepEqual(await searchPackOn(a, 'a'), []);
    const hit = (await searchPackOn(a, 'galletas colom'))[0]!;
    assert.deepEqual(hit, { id: 'off:7702011000019', name: 'Galletas de leche Colombina 12 g', brand: 'Colombina', unit: 'unit', categoryName: 'Snacks' });
    assert.equal((await barcodePackOn(a, ' 7702011000019 '))!.categoryName, 'Snacks');
    assert.equal(await barcodePackOn(a, '7702011000026'), null);
    assert.equal(await firstBarcodeOn(a, 'off:7702011000019'), '7702011000019');
    assert.equal(await firstBarcodeOn(a, 'surtivox:arroz'), null);
    await checkPackOn(a, 'tienda');
    await assert.rejects(checkPackOn(a, 'drogueria'), /no corresponde/);
    assert.equal((await attributionOn(a)).length, 2);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

function fakeIo(over: Partial<PackIo> & { files?: Map<string, Buffer>; remote?: Buffer; man?: unknown } = {}) {
  const files = over.files ?? new Map<string, Buffer>();
  const settings = new Map<string, string>();
  const remote = over.remote ?? Buffer.from('paquete');
  const log: string[] = [];
  const io: PackIo = {
    fetchManifest: async () => over.man ?? manifest([{ id: 'tienda', file: 'tienda.sqlite', items: 3, bytes: remote.length, sha256: createHash('sha256').update(remote).digest('hex') }]),
    download: async (url, path) => { log.push(`download ${url}`); files.set(path, remote); },
    sha256: async (path) => createHash('sha256').update(files.get(path)!).digest('hex'),
    size: async (path) => files.get(path)?.length ?? null,
    move: async (from, to) => { log.push(`move ${to}`); files.set(to, files.get(from)!); files.delete(from); },
    remove: async (path) => { files.delete(path); },
    release: async () => { log.push('release'); },
    verify: async () => { log.push('verify'); },
    readSetting: async (k) => settings.get(k) ?? null,
    writeSetting: async (k, v) => { settings.set(k, v); },
    now: () => 42,
    ...over,
  };
  return { io, files, settings, log };
}

const OPTS = { base: 'https://x.test/catalogo', dir: '/data/SQLite/', type: 'tienda' as const };

test('instalar descarga, verifica tamaño y sha256, reemplaza y recuerda la versión', async () => {
  const { io, files, settings, log } = fakeIo();
  const r = await installPackOn(io, OPTS);
  assert.equal(r.status, 'installed');
  assert.ok(files.has('/data/SQLite/catalogo-tienda.sqlite'));
  assert.ok(!files.has('/data/SQLite/catalogo-tienda.sqlite.part'));
  assert.deepEqual(log.map((l) => l.split(' ')[0]), ['download', 'verify', 'release', 'move']);
  assert.match(log[0]!, /tienda\.sqlite\?v=[0-9a-f]{12}$/);
  assert.equal(parseInstalled(settings.get(PACK_SETTING)!)!.items, 3);
  assert.equal(settings.get(PACK_TYPE_SETTING), 'tienda');
  const again = await installPackOn(io, OPTS);
  assert.equal(again.status, 'up_to_date');
});

test('un archivo alterado o incompleto no se instala y no deja restos', async () => {
  const good = Buffer.from('paquete');
  const shaGood = createHash('sha256').update(good).digest('hex');
  const tampered = fakeIo({ remote: Buffer.from('paquetX'), man: manifest([{ id: 'tienda', file: 'tienda.sqlite', items: 3, bytes: 7, sha256: shaGood }]) });
  await assert.rejects(installPackOn(tampered.io, OPTS), /sha256 distinto/);
  assert.equal(tampered.files.size, 0);
  assert.equal(tampered.settings.size, 0);
  const short = fakeIo({ remote: Buffer.from('paq'), man: manifest([{ id: 'tienda', file: 'tienda.sqlite', items: 3, bytes: 7, sha256: shaGood }]) });
  await assert.rejects(installPackOn(short.io, OPTS), /incompleta/);
  assert.equal(short.files.size, 0);
  const wrong = fakeIo({ verify: async () => { throw new Error('no corresponde'); } });
  await assert.rejects(installPackOn(wrong.io, OPTS), /no corresponde/);
  assert.equal(wrong.files.size, 0);
  const missing = fakeIo({ man: manifest([{ id: 'drogueria', file: 'drogueria.sqlite', items: 3, bytes: 7, sha256: shaGood }]) });
  await assert.rejects(installPackOn(missing.io, OPTS), /Todavía no hay catálogo/);
});

test('cambiar de tipo de negocio borra el paquete anterior', async () => {
  const files = new Map<string, Buffer>([['/data/SQLite/catalogo-drogueria.sqlite', Buffer.from('viejo')]]);
  const { io, settings } = fakeIo({ files });
  settings.set(PACK_SETTING, JSON.stringify({ type: 'drogueria', version: '2026.11.01', sha256: SHA, items: 1, bytes: 5, installedAt: 1 }));
  await installPackOn(io, OPTS);
  assert.ok(!files.has('/data/SQLite/catalogo-drogueria.sqlite'));
  assert.ok(files.has('/data/SQLite/catalogo-tienda.sqlite'));
});

test('el manifest publicado en la landing pasa el validador de la app y trae los seis tipos de negocio', () => {
  const published = JSON.parse(readFileSync(new URL('../../../landing/catalogo/manifest.json', import.meta.url), 'utf8'));
  const m = parseManifest(published);
  assert.deepEqual(m.packages.map((p) => p.id).sort(), BUSINESS_TYPES.map((t) => t.id).sort());
  for (const p of m.packages) assert.match(packUrl('https://digita1web.github.io/surtivox-pos/catalogo', p), /^https:\/\/digita1web\.github\.io\/surtivox-pos\/catalogo\/[a-z]+\.sqlite\?v=[0-9a-f]{12}$/);
});
