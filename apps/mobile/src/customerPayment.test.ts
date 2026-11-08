import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asMinor } from '@surtivox/pos-core';
import { checkoutSaleOn, recordCustomerPaymentOn } from './checkoutOps.ts';
import { ARROZ, NOW, adapter, balanceOf, countOf, makeIds, memoryDb, one } from './moneyKit.test.ts';

async function creditSaleOf6000() {
  const db = memoryDb();
  const a = adapter(db);
  const ids = makeIds();
  await checkoutSaleOn(a, ids, 's1', [{ product: ARROZ, quantity: 3 }], { paymentMethod: 'credit', received: asMinor(0), customerId: 'c1' }, NOW);
  return { db, a, ids };
}

test('un abono normal baja el saldo y queda como entrada negativa del libro', async () => {
  const { db, a, ids } = await creditSaleOf6000();
  await recordCustomerPaymentOn(a, ids, 's1', 'c1', asMinor(2500), ' abono lunes ', NOW);
  assert.equal(balanceOf(db), 3500);
  const entry = one<{ type: string; amount: number; note: string; reference_type: string }>(db, "SELECT type, amount, note, reference_type FROM customer_ledger WHERE type='payment'");
  assert.deepEqual({ ...entry }, { type: 'payment', amount: -2500, note: 'abono lunes', reference_type: 'manual' });
});

test('un abono igual a la deuda deja el saldo en cero', async () => {
  const { db, a, ids } = await creditSaleOf6000();
  await recordCustomerPaymentOn(a, ids, 's1', 'c1', asMinor(6000), undefined, NOW);
  assert.equal(balanceOf(db), 0);
});

test('un abono de cero o negativo se rechaza y no escribe nada', async () => {
  const { db, a, ids } = await creditSaleOf6000();
  await assert.rejects(recordCustomerPaymentOn(a, ids, 's1', 'c1', asMinor(0), undefined, NOW), /mayor que cero/);
  await assert.rejects(recordCustomerPaymentOn(a, ids, 's1', 'c1', asMinor(-100), undefined, NOW), /mayor que cero/);
  assert.equal(countOf(db, 'customer_ledger'), 1);
});

test('un abono mayor que la deuda se rechaza y no cambia el saldo', async () => {
  const { db, a, ids } = await creditSaleOf6000();
  await assert.rejects(recordCustomerPaymentOn(a, ids, 's1', 'c1', asMinor(6001), undefined, NOW), /no puede ser mayor/);
  assert.equal(balanceOf(db), 6000);
  assert.equal(countOf(db, 'customer_ledger'), 1);
});

test('un cliente sin deuda o con saldo a favor no puede registrar un abono', async () => {
  const { db, a, ids } = await creditSaleOf6000();
  await recordCustomerPaymentOn(a, ids, 's1', 'c1', asMinor(6000), undefined, NOW);
  await assert.rejects(recordCustomerPaymentOn(a, ids, 's1', 'c1', asMinor(1), undefined, NOW), /no tiene deuda/);
  assert.equal(balanceOf(db), 0);
  const limpio = memoryDb();
  await assert.rejects(recordCustomerPaymentOn(adapter(limpio), makeIds(), 's1', 'c1', asMinor(500), undefined, NOW), /no tiene deuda/);
  assert.equal(countOf(limpio, 'customer_ledger'), 0);
});

test('un abono con decimales se rechaza', async () => {
  const { db, a, ids } = await creditSaleOf6000();
  await assert.rejects(recordCustomerPaymentOn(a, ids, 's1', 'c1', 100.5 as never, undefined, NOW), /número entero/);
  assert.equal(balanceOf(db), 6000);
});

test('abonos sucesivos hasta saldar la deuda dejan el saldo en cero y el siguiente se rechaza', async () => {
  const { db, a, ids } = await creditSaleOf6000();
  for (const amount of [2000, 2500, 1500]) await recordCustomerPaymentOn(a, ids, 's1', 'c1', asMinor(amount), undefined, NOW);
  assert.equal(balanceOf(db), 0);
  await assert.rejects(recordCustomerPaymentOn(a, ids, 's1', 'c1', asMinor(1), undefined, NOW), /no tiene deuda/);
});
