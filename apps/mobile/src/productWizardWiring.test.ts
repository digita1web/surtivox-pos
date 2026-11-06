import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { capabilityForPath } from './routeAccess.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const screen = read('../app/product-wizard.tsx');
const scan = read('../app/scan.tsx');
const sheet = read('./pos/UnknownBarcodeSheet.tsx');

test('existe la ruta del asistente y no exige un permiso que el cajero no tenga', () => {
  assert.ok(existsSync(new URL('../app/product-wizard.tsx', import.meta.url)));
  assert.equal(capabilityForPath('/product-wizard'), null);
});

test('la hoja de producto desconocido abre el asistente y conserva la venta rapida y el alta manual', () => {
  assert.match(sheet, /onStartWizard\?: \(code: string\) => void/);
  assert.match(sheet, /Registrar paso a paso/);
  assert.match(sheet, /accessibilityLabel="Venta única"/);
  assert.match(sheet, /accessibilityLabel="Agregar a la venta"/);
  assert.match(scan, /pathname: '\/product-wizard', params: \{ code: wizardCode \}/);
  assert.match(scan, /pathname: '\/add-product', params: \{ barcode: code \}/);
});

test('el escaner reabre la hoja con el codigo cuando se pide vender sin registrar y muestra el mensaje de cierre', () => {
  assert.match(scan, /takeQuickSale\(\)/);
  assert.match(scan, /if \(quickCode\) setUnknownCode\(quickCode\)/);
  assert.match(scan, /takeMessage\(\)/);
});

test('Vender ahora sin registrar solo traspasa el codigo: no crea producto ni borrador', () => {
  const start = screen.indexOf('const quickSale = () => {');
  const body = screen.slice(start, screen.indexOf('};', start));
  assert.match(body, /requestQuickSale\(code\)/);
  assert.doesNotMatch(body, /finishWizardOn|saveDraftOn|createProduct|createDraftProduct|enqueueContribution/);
});

test('el asistente solo envia al catalogo desde la finalizacion con consentimiento y nunca la foto', () => {
  assert.equal((screen.match(/enqueueContribution\(/g) ?? []).length, 1);
  assert.equal((screen.match(/finishWizardOn\(/g) ?? []).length, 1);
  assert.match(screen, /getCatalogOptIn: \(\) => getLocalSetting\('catalog_opt_in'\)/);
  assert.doesNotMatch(screen, /fetch\(|upload|FormData/);
});

test('la pantalla no precarga datos de terceros ni usa marcas de terceros', () => {
  assert.doesNotMatch(screen, /openfoodfacts|Open Food Facts|resolveHints|lookupBarcode|downloadProductImage/i);
});

test('los botones tienen etiquetas de accesibilidad y la barra de progreso es un progressbar', () => {
  assert.match(screen, /accessibilityRole="progressbar"/);
  assert.match(screen, /accessibilityLabel="Atrás"/);
  assert.match(screen, /accessibilityRole="header"/);
  assert.ok((screen.match(/accessibilityLabel=/g) ?? []).length >= 10);
});

test('el campo de marca no usa autocorreccion agresiva y el pie queda sobre el teclado', () => {
  const brand = screen.slice(screen.indexOf('ref={brandInput}'), screen.indexOf('accessibilityLabel="Marca"'));
  assert.match(brand, /autoCorrect=\{false\}/);
  assert.match(brand, /spellCheck=\{false\}/);
  assert.match(screen, /<KeyboardAvoidingView style=\{\{ flex: 1 \}\} behavior="padding">/);
  assert.match(screen, /keyboardShouldPersistTaps="handled"/);
});
