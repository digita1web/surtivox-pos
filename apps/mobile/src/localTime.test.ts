import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localDateStamp, localDateTimeText } from './localTime.ts';

const originalZone = process.env.TZ;
afterEach(() => {
  if (originalZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalZone;
});

const SALE_2330_BOGOTA = Date.UTC(2026, 10, 8, 4, 30, 0);

test('una venta a las 11:30 p. m. en Bogotá sale con la fecha de ese día', () => {
  process.env.TZ = 'America/Bogota';
  assert.equal(localDateStamp(SALE_2330_BOGOTA), '20261107');
  assert.equal(localDateTimeText(SALE_2330_BOGOTA), '2026-11-07 23:30:00');
});

test('la misma venta en otra zona horaria usa la hora local de esa zona', () => {
  process.env.TZ = 'Asia/Tokyo';
  assert.equal(localDateStamp(SALE_2330_BOGOTA), '20261108');
  assert.equal(localDateTimeText(SALE_2330_BOGOTA), '2026-11-08 13:30:00');
  process.env.TZ = 'UTC';
  assert.equal(localDateTimeText(SALE_2330_BOGOTA), '2026-11-08 04:30:00');
});

test('el cambio de día ocurre a la medianoche local y no a la de UTC', () => {
  process.env.TZ = 'America/Bogota';
  const justBeforeMidnight = Date.UTC(2026, 10, 8, 4, 59, 59);
  const midnight = Date.UTC(2026, 10, 8, 5, 0, 0);
  assert.equal(localDateStamp(justBeforeMidnight), '20261107');
  assert.equal(localDateStamp(midnight), '20261108');
  assert.equal(localDateTimeText(midnight), '2026-11-08 00:00:00');
});

test('los meses y días de un dígito llevan cero a la izquierda', () => {
  process.env.TZ = 'America/Bogota';
  assert.equal(localDateStamp(Date.UTC(2026, 0, 5, 12, 0, 0)), '20260105');
  assert.equal(localDateTimeText(Date.UTC(2026, 0, 5, 14, 3, 9)), '2026-01-05 09:03:09');
});

test('el respaldo y el CSV de ventas usan la fecha local y no la de UTC', () => {
  const source = readFileSync(new URL('./backup.ts', import.meta.url), 'utf8');
  assert.match(source, /const stamp = \(\) => localDateStamp\(Date\.now\(\)\)/);
  assert.match(source, /localDateTimeText\(r\.sold_at\)/);
  assert.doesNotMatch(source, /toISOString\(\)\.slice\(0, 10\)/);
  assert.doesNotMatch(source, /new Date\(r\.sold_at\)\.toISOString\(\)/);
});
