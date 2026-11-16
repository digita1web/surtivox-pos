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

test('el aviso semanal es opcional, vive en Inicio y solo lo ve quien puede contar', () => {
  const home = read('../app/(tabs)/index.tsx');
  assert.match(home, /if \(canCount\) \{\s*stockCountReminder\(store\.id\)\.then\(setCountNudge\)/);
  assert.match(home, /const canCount = can\(role, 'stock_count'\);/);
  assert.match(home, /router\.push\('\/stock-count'\)/);
  assert.match(report, /<Switch value=\{reminder\} onValueChange=\{toggleReminder\}/);
  const pkg = JSON.parse(read('../package.json')) as { dependencies: Record<string, string> };
  assert.equal(pkg.dependencies['expo-notifications'], undefined);
});

test('Inicio ofrece el conteo bajo las acciones principales solo a quien puede contar y si hay productos con inventario', () => {
  const home = read('../app/(tabs)/index.tsx');
  assert.match(home, /\{canCount && trackedTotal > 0 \? \(\s*<Pressable\s*onPress=\{\(\) => router\.push\('\/stock-count'\)\}/);
  assert.match(home, /trackedProductCount\(store\.id\)\.then\(setTrackedTotal\)/);
  const actionsEnd = home.indexOf('title="Escanear y vender"');
  const card = home.indexOf('Conteo de inventario. Compara');
  const frequent = home.indexOf('title="Productos frecuentes"');
  assert.ok(actionsEnd > 0 && actionsEnd < card && card < frequent);
  assert.match(home, /title="Agregar producto"/);
  assert.match(home, /Agrega tu primer producto/);
});

test('el informe no suma su propio relleno al de Screen, así los chips llegan al borde', () => {
  assert.match(report, /<Screen title="Diferencias de inventario"[^>]*>\n\s*<View>/);
  assert.doesNotMatch(report, /<Screen title="Diferencias de inventario"[^>]*>\n\s*<View style=\{\{ padding/);
});
