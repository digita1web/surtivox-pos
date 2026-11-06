import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OFF_UA_PATTERN, buildOffUserAgent, createOffCache, sameProductName } from './offClient.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('el User-Agent sigue el formato NombreApp/Version (correo)', () => {
  const ua = buildOffUserAgent({ name: 'Surtivox POS', version: '1.1.2', contact: 'contacto@ejemplo.test' });
  assert.equal(ua, 'SurtivoxPOS/1.1.2 (contacto@ejemplo.test)');
  assert.match(ua, OFF_UA_PATTERN);
});

test('sin version valida usa 0.0.0 y sin correo no inventa uno', () => {
  assert.equal(buildOffUserAgent({ name: 'App', version: null, contact: 'a@b.test' }), 'App/0.0.0 (a@b.test)');
  assert.equal(buildOffUserAgent({ name: 'App', version: 'beta', contact: 'a@b.test' }), 'App/0.0.0 (a@b.test)');
  const noContact = buildOffUserAgent({ name: 'App', version: '1.0.0', contact: '  ' });
  assert.equal(noContact, 'App/1.0.0');
  assert.doesNotMatch(noContact, OFF_UA_PATTERN);
});

test('el User-Agent de lookup.ts sale de la configuracion de la app y no esta escrito a mano', () => {
  const lookup = read('./pos/lookup.ts');
  assert.match(lookup, /'User-Agent': offUserAgent\(\)/);
  assert.match(lookup, /Constants\.expoConfig\?\.version/);
  assert.match(lookup, /contact: LEGAL_CONTACT/);
  assert.doesNotMatch(lookup, /offline POS/);
});

test('la cache guarda, vence por tiempo y limita su tamano', () => {
  let clock = 1000;
  const cache = createOffCache<string>(500, () => clock, 2);
  cache.set('a', 'uno');
  assert.equal(cache.get('a'), 'uno');
  clock += 501;
  assert.equal(cache.get('a'), undefined);
  cache.set('b', '2');
  cache.set('c', '3');
  cache.set('d', '4');
  assert.equal(cache.size(), 2);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('d'), '4');
});

test('lookup.ts consulta la cache antes de la red y solo guarda resultados definitivos', () => {
  const lookup = read('./pos/lookup.ts');
  const body = lookup.slice(lookup.indexOf('export async function lookupBarcode'), lookup.indexOf('export async function downloadProductImage'));
  assert.ok(body.indexOf('sessionCache.get(code)') < body.indexOf('fetch('));
  assert.doesNotMatch(body.slice(body.indexOf('} catch {')), /sessionCache\.set/);
});

test('las consultas a Open Food Facts nunca se disparan al teclear', () => {
  const addProduct = read('../app/add-product.tsx');
  assert.doesNotMatch(addProduct, /onChangeText=\{[^}]*lookup\(/);
  assert.match(addProduct, /onEndEditing=\{\(\) => \{ if \(marketEanForLookup\(barcode\)\) void lookup\(barcode, true\); \}\}/);
  const sheet = read('./pos/UnknownBarcodeSheet.tsx');
  const effect = sheet.slice(sheet.indexOf('resolveHints(code, controller.signal)'), sheet.indexOf('}, [code]);'));
  assert.ok(effect.length > 0);
  assert.doesNotMatch(sheet, /onChangeText=\{[^}]*resolveHints|onChangeText=\{[^}]*lookupBarcode/);
  assert.doesNotMatch(read('./productWizard.ts') + read('../app/product-wizard.tsx'), /lookupBarcode|resolveHints/);
});

test('una sugerencia de otra fuente no se envia al catalogo como aporte de la tienda', () => {
  assert.equal(sameProductName('Gaseosa  Postobón 400 ML', 'gaseosa postobon 400 ml'), true);
  assert.equal(sameProductName('Gaseosa', 'Gaseosa Postobón'), false);
  assert.equal(sameProductName('', ''), false);
  const sheet = read('./pos/UnknownBarcodeSheet.tsx');
  assert.match(sheet, /if \(!nameTouched\.current \|\| !CATALOG_URL\.trim\(\)\) return;/);
  assert.match(sheet, /if \(resolveHint\?\.name && sameProductName\(productName, resolveHint\.name\)\) return;/);
});

test('ningun archivo del catalogo importa datos de Open Food Facts', () => {
  assert.doesNotMatch(read('./catalog.ts'), /openfoodfacts|lookupBarcode|resolveBarcode/i);
});

test('la pantalla de licencias atribuye a Open Food Facts con ODbL, DbCL y CC BY-SA', () => {
  const licenses = read('../app/licenses.tsx');
  for (const text of ['Open Food Facts', 'ODbL', 'Database Contents License (DbCL)', 'CC BY-SA', 'https://openfoodfacts.org']) {
    assert.ok(licenses.includes(text), text);
  }
  assert.doesNotMatch(licenses, /<Image|logotipo|\.png|\.svg/i);
});
