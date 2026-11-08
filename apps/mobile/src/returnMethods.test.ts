import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asMinor } from '@surtivox/pos-core';
import { checkoutSaleOn, recordCustomerPaymentOn, type PaymentMethod } from './checkoutOps.ts';
import { allowedRefundMethods } from './effectiveLines.ts';
import { processReturnOn, type RefundMethod } from './returnOps.ts';
import { ARROZ, NOW, adapter, balanceOf, countOf, makeIds, memoryDb, one } from './moneyKit.test.ts';

async function saleWith(method: PaymentMethod, customerId: string | null = null) {
  const db = memoryDb();
  const a = adapter(db);
  const ids = makeIds();
  await checkoutSaleOn(a, ids, 's1', [{ product: ARROZ, quantity: 3 }], { paymentMethod: method, received: asMinor(6000), customerId }, NOW);
  const saleId = one<{ id: string }>(db, 'SELECT id FROM sales').id;
  const itemId = one<{ id: string }>(db, 'SELECT id FROM sale_items').id;
  const refund = (m: RefundMethod, quantity = 1) => processReturnOn(a, ids, 's1', saleId, [{ saleItemId: itemId, quantity }], m, undefined, NOW);
  return { db, a, ids, refund };
}

test('una venta fiada solo se devuelve a la cuenta del cliente y la caja no se toca', async () => {
  const { db, refund } = await saleWith('credit', 'c1');
  for (const method of ['cash', 'card', 'bank'] as const) {
    await assert.rejects(refund(method), /fiada/);
  }
  assert.equal(countOf(db, 'returns'), 0);
  assert.equal(balanceOf(db), 6000);
  const receipt = await refund('account');
  assert.equal(receipt.grandTotal, 2000);
  assert.equal(balanceOf(db), 4000);
});

test('una venta pagada en efectivo se devuelve en efectivo', async () => {
  const { db, refund } = await saleWith('cash');
  await assert.rejects(refund('card'), /pagó con efectivo/);
  await assert.rejects(refund('bank'), /pagó con efectivo/);
  assert.equal(countOf(db, 'returns'), 0);
  assert.equal((await refund('cash')).grandTotal, 2000);
});

test('una venta pagada con tarjeta se devuelve a la tarjeta', async () => {
  const { refund } = await saleWith('card');
  await assert.rejects(refund('cash'), /pagó con tarjeta/);
  assert.equal((await refund('card')).refundMethod, 'card');
});

test('una venta pagada con Nequi o Daviplata se devuelve como transferencia', async () => {
  const { refund } = await saleWith('wallet');
  await assert.rejects(refund('cash'), /Nequi o Daviplata/);
  assert.equal((await refund('bank')).refundMethod, 'bank');
});

test('una venta pagada con cliente también puede devolverse a la cuenta del cliente', async () => {
  const { db, refund } = await saleWith('cash', 'c1');
  await refund('account');
  assert.equal(balanceOf(db), -2000);
});

test('devolver a la cuenta una venta fiada que el cliente ya pagó deja saldo a favor', async () => {
  const { db, a, ids, refund } = await saleWith('credit', 'c1');
  await recordCustomerPaymentOn(a, ids, 's1', 'c1', asMinor(6000), undefined, NOW);
  assert.equal(balanceOf(db), 0);
  await refund('account');
  assert.equal(balanceOf(db), -2000);
});

test('los métodos permitidos dependen de cómo se pagó la venta y de si hay cliente', () => {
  assert.deepEqual(allowedRefundMethods('credit', true), ['account']);
  assert.deepEqual(allowedRefundMethods('credit', false), []);
  assert.deepEqual(allowedRefundMethods('cash', false), ['cash']);
  assert.deepEqual(allowedRefundMethods('cash', true), ['cash', 'account']);
  assert.deepEqual(allowedRefundMethods('card', false), ['card']);
  assert.deepEqual(allowedRefundMethods('wallet', false), ['bank']);
  assert.deepEqual(allowedRefundMethods('bank', true), ['bank', 'account']);
});
