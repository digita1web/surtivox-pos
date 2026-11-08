import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asMinor } from '@surtivox/pos-core';
import { checkoutSaleOn, recordCustomerPaymentOn } from './checkoutOps.ts';
import { processReturnOn } from './returnOps.ts';
import { paymentsReceivedOn, reportSummaryOn } from './reportOps.ts';
import { ARROZ, NOW, adapter, makeIds, memoryDb, one } from './moneyKit.test.ts';

const HOUR = 3_600_000;

async function scenario() {
  const db = memoryDb();
  const a = adapter(db);
  const ids = makeIds();
  await checkoutSaleOn(a, ids, 's1', [{ product: ARROZ, quantity: 2 }], { paymentMethod: 'cash', received: asMinor(4000) }, NOW - 2 * HOUR);
  await checkoutSaleOn(a, ids, 's1', [{ product: ARROZ, quantity: 3 }], { paymentMethod: 'credit', received: asMinor(0), customerId: 'c1' }, NOW - HOUR);
  await recordCustomerPaymentOn(a, ids, 's1', 'c1', asMinor(2000), undefined, NOW);
  await recordCustomerPaymentOn(a, ids, 's1', 'c1', asMinor(1500), undefined, NOW + 1);
  return { db, a, ids };
}

test('los abonos del rango se suman aparte y se cuentan', async () => {
  const { a } = await scenario();
  assert.deepEqual({ ...(await paymentsReceivedOn(a, 's1', 0)) }, { total: 3500, count: 2 });
});

test('los abonos no cambian las ventas, las transacciones ni la utilidad del reporte', async () => {
  const { a } = await scenario();
  const r = await reportSummaryOn(a, 's1', 0);
  assert.equal(r.totalSales, 10000);
  assert.equal(r.transactions, 2);
  assert.equal(r.grossProfit, 5000);
  assert.equal(r.refundTotal, 0);
});

test('el rango deja fuera los abonos anteriores y los de otra tienda', async () => {
  const { a } = await scenario();
  assert.deepEqual({ ...(await paymentsReceivedOn(a, 's1', NOW + 1)) }, { total: 1500, count: 1 });
  assert.deepEqual({ ...(await paymentsReceivedOn(a, 's1', NOW + 2)) }, { total: 0, count: 0 });
  assert.deepEqual({ ...(await paymentsReceivedOn(a, 's2', 0)) }, { total: 0, count: 0 });
});

test('las ventas fiadas y las devoluciones a la cuenta no cuentan como abonos', async () => {
  const { db, a, ids } = await scenario();
  const saleId = one<{ id: string }>(db, "SELECT id FROM sales WHERE invoice_no='INV-0002'").id;
  const itemId = one<{ id: string }>(db, 'SELECT id FROM sale_items WHERE sale_id=?', saleId).id;
  await processReturnOn(a, ids, 's1', saleId, [{ saleItemId: itemId, quantity: 1 }], 'account', undefined, NOW + 5);
  assert.deepEqual({ ...(await paymentsReceivedOn(a, 's1', 0)) }, { total: 3500, count: 2 });
});

test('sin abonos el total es cero', async () => {
  const db = memoryDb();
  assert.deepEqual({ ...(await paymentsReceivedOn(adapter(db), 's1', 0)) }, { total: 0, count: 0 });
});
