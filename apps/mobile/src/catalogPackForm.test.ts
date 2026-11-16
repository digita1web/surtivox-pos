import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { packHitSubtitle, resolvePackCategory } from './catalogPackForm.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('la categoría sugerida usa la de la tienda si existe, sin importar tildes ni mayúsculas', () => {
  const cats = [{ id: 'c1', name: 'Lacteos' }, { id: 'c2', name: 'Granos' }];
  assert.deepEqual(resolvePackCategory('Lácteos', cats), { kind: 'existing', id: 'c1' });
  assert.deepEqual(resolvePackCategory('Snacks', cats), { kind: 'new', name: 'Snacks' });
  assert.deepEqual(resolvePackCategory(null, cats), { kind: 'none' });
});

test('el subtítulo de la sugerencia no repite la marca que ya está en el nombre', () => {
  assert.equal(packHitSubtitle({ name: 'Galletas de leche Colombina 12 g', brand: 'Colombina', categoryName: 'Snacks' }), 'Snacks');
  assert.equal(packHitSubtitle({ name: 'Leche entera 1 L', brand: 'Alpina', categoryName: 'Lácteos' }), 'Alpina · Lácteos');
  assert.equal(packHitSubtitle({ name: 'Tinto', brand: null, categoryName: null }), '');
});

test('agregar producto sugiere del catálogo solo al crear y busca primero el código en el teléfono', () => {
  const form = read('../app/add-product.tsx');
  assert.match(form, /if \(editId \|\| picked\.current === name\) \{ setSuggestions\(\[\]\); return; \}/);
  assert.match(form, /searchCatalog\(name, 5\)/);
  assert.match(form, /resolvePackCategory\(hit\.categoryName, categories\)/);
  const lookup = form.slice(form.indexOf('const lookup = async'), form.indexOf('const onScanned'));
  assert.ok(lookup.indexOf('lookupCatalogBarcode(bc)') > 0 && lookup.indexOf('lookupCatalogBarcode(bc)') < lookup.indexOf('lookupBarcode(bc)'));
  assert.match(lookup, /if \(!silent && !fromPack\) showAlert\('No encontrado'/);
  assert.doesNotMatch(form, /openDatabaseAsync|catalogo-/);
});

test('el catálogo vive en Más, protegido por el permiso de productos, y su licencia se atribuye', () => {
  assert.match(read('../app/(tabs)/more.tsx'), /route: '\/catalog-pack', show: can\(role, 'products'\)/);
  assert.match(read('../app/licenses.tsx'), /Catálogo de productos sin conexión[\s\S]*Open Database License[\s\S]*Open Food Facts/);
  const runtime = read('./catalogPackRuntime.ts');
  assert.match(runtime, /const DIR = `\$\{FileSystem\.documentDirectory\}SQLite\/`;/);
  assert.match(runtime, /installPackOn\(io, \{ base: CATALOG_PACK_BASE, dir: DIR, type \}\)/);
  assert.match(read('../app/catalog-pack.tsx'), /attribution\.map/);
});
