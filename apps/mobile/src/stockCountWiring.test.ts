import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const screen = read('../app/stock-count.tsx');
const more = read('../app/(tabs)/more.tsx');
const report = read('../app/stock-count-report.tsx');
const share = read('./countShare.ts');

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

test('los textos del conteo y del informe son neutrales', () => {
  for (const source of [screen, report]) {
    for (const word of [/rob[oóa]/i, /culpa/i, /p[eé]rdida por/i, /sospech/i, /descuadre del empleado/i]) {
      assert.doesNotMatch(source, word);
    }
  }
});

test('terminar un conteo lleva al informe, que comparte por WhatsApp y PDF sin dependencias nuevas', () => {
  assert.match(screen, /closeStockCount\(countId\);\n\s*router\.replace\('\/stock-count-report'\)/);
  assert.match(report, /shareCountReportWhatsApp\(report, opts\)/);
  assert.match(report, /shareCountReportPdf\(report, \{ \.\.\.opts, dateOf \}\)/);
  assert.match(share, /from 'expo-print'/);
  assert.match(share, /from 'expo-sharing'/);
  assert.match(share, /https:\/\/wa\.me\/\?text=\$\{encodeURIComponent\(text\)\}/);
});

test('el informe filtra por periodo y por quien contó', () => {
  assert.match(report, /periodRange\(period, Date\.now\(\)\)/);
  assert.match(report, /staffId: who\.id/);
});
