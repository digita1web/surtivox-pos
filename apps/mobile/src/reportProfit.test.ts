import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asMinor } from '@surtivox/pos-core';
import { checkoutSaleOn, type CheckoutProduct } from './checkoutOps.ts';
import { processReturnOn } from './returnOps.ts';
import { reportSummaryOn } from './reportOps.ts';
import { ACEITE, ARROZ, NOW, adapter, all, makeIds, memoryDb, one } from './moneyKit.test.ts';

const cash = (received: number) => ({ paymentMethod: 'cash' as const, received: asMinor(received) });

test('la utilidad de una venta sin descuento es precio menos costo', async () => {
  const db = memoryDb();
  const a = adapter(db);
  await checkoutSaleOn(a, makeIds(), 's1', [{ product: ARROZ, quantity: 2 }, { product: ACEITE, quantity: 1 }], cash(16000), NOW);
  const r = await reportSummaryOn(a, 's1', 0);
  assert.deepEqual({ ...r }, { totalSales: 16000, transactions: 1, itemsSold: 3, grossProfit: 5000, discountTotal: 0, refundTotal: 0 });
});

test('la utilidad de una venta con descuento general usa lo realmente cobrado', async () => {
  const db = memoryDb();
  const a = adapter(db);
  await checkoutSaleOn(a, makeIds(), 's1', [{ product: ARROZ, quantity: 2 }, { product: ACEITE, quantity: 1 }], { ...cash(20000), discountBps: 1000 }, NOW);
  const r = await reportSummaryOn(a, 's1', 0);
  assert.equal(r.totalSales, 14400);
  assert.equal(r.grossProfit, 3400);
  assert.equal(r.discountTotal, 1600);
});

test('la utilidad descuenta el impuesto efectivo cuando hay descuento general', async () => {
  const db = memoryDb();
  const a = adapter(db);
  const conIva: CheckoutProduct = { ...ACEITE, selling_price: 10000, cost_price: 6000, tax_bps: 1900 };
  await checkoutSaleOn(a, makeIds(), 's1', [{ product: conIva, quantity: 1 }], { ...cash(20000), discountBps: 1000 }, NOW);
  const r = await reportSummaryOn(a, 's1', 0);
  assert.equal(r.totalSales, 10710);
  assert.equal(r.grossProfit, 3000);
});

test('una devolución total de una venta con descuento deja utilidad, artículos y ventas netas en cero', async () => {
  const db = memoryDb();
  const a = adapter(db);
  const ids = makeIds();
  await checkoutSaleOn(a, ids, 's1', [{ product: ARROZ, quantity: 2 }, { product: ACEITE, quantity: 1 }], { ...cash(20000), discountBps: 1000 }, NOW);
  const saleId = one<{ id: string }>(db, 'SELECT id FROM sales').id;
  const picks = all<{ id: string; quantity: number }>(db, 'SELECT id, quantity FROM sale_items').map((i) => ({ saleItemId: i.id, quantity: i.quantity }));
  await processReturnOn(a, ids, 's1', saleId, picks, 'cash', undefined, NOW + 5);
  const r = await reportSummaryOn(a, 's1', 0);
  assert.equal(r.totalSales - r.refundTotal, 0);
  assert.equal(r.itemsSold, 0);
  assert.equal(r.grossProfit, 0);
});

test('el reporte respeta el rango, ignora ventas anuladas y otras tiendas', async () => {
  const db = memoryDb();
  const a = adapter(db);
  const ids = makeIds();
  await checkoutSaleOn(a, ids, 's1', [{ product: ARROZ, quantity: 1 }], cash(2000), NOW - 10_000);
  await checkoutSaleOn(a, ids, 's1', [{ product: ARROZ, quantity: 1 }], cash(2000), NOW);
  db.prepare("UPDATE sales SET status='void' WHERE invoice_no='INV-0001'").run();
  const all0 = await reportSummaryOn(a, 's1', 0);
  assert.equal(all0.transactions, 1);
  const none = await reportSummaryOn(a, 's1', NOW + 1);
  assert.equal(none.transactions, 0);
  assert.equal((await reportSummaryOn(a, 's2', 0)).transactions, 0);
});
