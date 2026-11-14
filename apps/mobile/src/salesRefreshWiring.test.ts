import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const layout = read('../app/(tabs)/_layout.tsx');
const home = read('../app/(tabs)/index.tsx');
const products = read('../app/(tabs)/products.tsx');
const sales = read('../app/(tabs)/sales.tsx');

const READS_VERSION = /const salesVersion = useCheckoutUI\(\(s\) => s\.salesVersion\);/;

test('el carrito y el cobro viven en el layout de pestañas, así que una venta puede cerrarse con cualquier pestaña enfocada', () => {
  assert.match(layout, /<CartBar /);
  assert.match(layout, /<CheckoutSheet \/>/);
});

test('las pestañas que listan ventas o stock se recargan cuando se completa o se anula una venta', () => {
  for (const [name, screen] of [['Inicio', home], ['Productos', products], ['Ventas', sales]] as const) {
    assert.match(screen, READS_VERSION, name);
  }
  assert.match(home, /\}, \[[^\]]*salesVersion[^\]]*\]\)\);/);
  assert.match(products, /listProducts\(store\.id\)[\s\S]*?\}, \[[^\]]*salesVersion[^\]]*\]\)\);/);
  assert.match(sales, /refresh\(\);\n  \}, \[[^\]]*salesVersion[^\]]*\]\)\);/);
});

test('anular una venta recarga la lista por salesVersion y no con una segunda llamada directa', () => {
  const voidOne = sales.slice(sales.indexOf('const voidOne'), sales.indexOf('const voidOne') + 400);
  assert.match(voidOne, /bumpSales\(\);/);
  assert.doesNotMatch(voidOne, /\brefresh\(\)/);
});
