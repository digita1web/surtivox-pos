import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');

test('las cifras de Ventas de hoy bajan de línea en vez de salirse de la tarjeta', () => {
  assert.match(home, /todayStats: \{[^}]*flexWrap: 'wrap'/);
  assert.match(home, /todayStat: \{[^}]*flexShrink: 1/);
  assert.match(home, /todayStatTxt: \{[^}]*flexShrink: 1/);
});

test('pedidos y artículos vendidos concuerdan en número', () => {
  assert.match(home, /stats\.orders === 1 \? 'pedido' : 'pedidos'/);
  assert.match(home, /stats\.itemsSold === 1 \? 'artículo vendido' : 'artículos vendidos'/);
});
