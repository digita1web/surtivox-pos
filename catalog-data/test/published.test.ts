import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCatalog } from '../src/catalog.ts';
import { buildPackages, type Manifest } from '../src/package.ts';
import { ROOT } from './fixtures.ts';

const PUBLISHED = new URL('../../landing/catalogo/', import.meta.url);
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

test('los paquetes publicados en la landing coinciden con su manifest', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', PUBLISHED), 'utf8')) as Manifest;
  assert.equal(manifest.license, 'ODbL-1.0');
  assert.ok(manifest.packages.length > 0);
  for (const p of manifest.packages) {
    const raw = readFileSync(new URL(p.file, PUBLISHED));
    assert.equal(raw.length, p.bytes, p.file);
    assert.equal(sha(raw), p.sha256, p.file);
    assert.equal(p.gzip_file, undefined);
  }
});

test('lo publicado es exactamente lo que se compila hoy desde data/', async () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', PUBLISHED), 'utf8')) as Manifest;
  const { products, taxonomy } = await loadCatalog(ROOT);
  const dir = mkdtempSync(join(tmpdir(), 'publicado-'));
  try {
    const fresh = buildPackages(dir, products, taxonomy, { catalogVersion: manifest.catalog_version, gzip: false });
    assert.deepEqual(
      fresh.packages.map((p) => [p.id, p.items, p.sha256]),
      manifest.packages.map((p) => [p.id, p.items, p.sha256]),
      'data/ cambió: recompila con node catalog-data/src/cli/build.ts --version=AAAA.MM.DD --out=landing/catalogo --gzip=false',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
