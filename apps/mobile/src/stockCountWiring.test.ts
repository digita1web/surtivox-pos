import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const screen = read('../app/stock-count.tsx');
const more = read('../app/(tabs)/more.tsx');

test('la pantalla de conteo escanea con ScanModal y nunca abre la cámara directamente', () => {
  assert.match(screen, /<ScanModal /);
  assert.doesNotMatch(screen, /CameraView/);
});

test('el conteo queda a nombre de quien tiene la sesión y se guarda solo por recordStockCount', () => {
  assert.match(screen, /openStockCount\(store\.id, staff\?\.id \?\? null\)/);
  assert.match(screen, /recordStockCount\(countId, selected\.id, counted\)/);
  assert.doesNotMatch(screen, /stock_movements|runAsync|getDb/);
});

test('el menú Más muestra el conteo solo a quien puede contar', () => {
  assert.match(more, /route: '\/stock-count', show: can\(role, 'stock_count'\)/);
});

test('los textos del conteo son neutrales', () => {
  for (const word of [/rob[oóa]/i, /culpa/i, /p[eé]rdida por/i, /sospech/i, /descuadre del empleado/i]) {
    assert.doesNotMatch(screen, word);
  }
});
