import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asMinor } from '@surtivox/pos-core';
import { checkoutSaleOn } from './checkoutOps.ts';
import { processReturnOn } from './returnOps.ts';
import { voidSaleOn } from './saleOps.ts';
import { ARROZ, NOW, adapter, balanceOf, countOf, makeIds, memoryDb, one, stockOf } from './moneyKit.test.ts';

async function cashSaleOfThree() {
  const db = memoryDb();
  const a = adapter(db);
  const ids = makeIds();
  await checkoutSaleOn(a, ids, 's1', [{ product: ARROZ, quantity: 3 }], { paymentMethod: 'cash', received: asMinor(6000) }, NOW);
  const saleId = one<{ id: string }>(db, 'SELECT id FROM sales').id;
  const itemId = one<{ id: string }>(db, 'SELECT id FROM sale_items').id;
  return { db, a, ids, saleId, itemId };
}

test('una devolución parcial reembolsa lo proporcional, repone el stock y guarda el detalle', async () => {
  const { db, a, ids, saleId, itemId } = await cashSaleOfThree();
  const receipt = await processReturnOn(a, ids, 's1', saleId, [{ saleItemId: itemId, quantity: 1 }], 'cash', undefined, NOW);
  assert.equal(receipt.grandTotal, 2000);
  assert.equal(stockOf(db, 'p1'), 98);
  const ret = one<{ refund_method: string; grand_total: number }>(db, 'SELECT refund_method, grand_total FROM returns');
  assert.deepEqual({ ...ret }, { refund_method: 'cash', grand_total: 2000 });
  const line = one<{ quantity: number; line_total: number }>(db, 'SELECT quantity, line_total FROM return_items');
  assert.deepEqual({ ...line }, { quantity: 1, line_total: 2000 });
  assert.equal(countOf(db, 'customer_ledger'), 0);
});

test('una devolución total de una venta sin descuento reembolsa exactamente lo cobrado', async () => {
  const { db, a, ids, saleId, itemId } = await cashSaleOfThree();
  const receipt = await processReturnOn(a, ids, 's1', saleId, [{ saleItemId: itemId, quantity: 3 }], 'cash', undefined, NOW);
  assert.equal(receipt.grandTotal, 6000);
  assert.equal(stockOf(db, 'p1'), 100);
});

test('no se puede devolver más de lo vendido, ni en una ni en varias devoluciones', async () => {
  const { db, a, ids, saleId, itemId } = await cashSaleOfThree();
  await processReturnOn(a, ids, 's1', saleId, [{ saleItemId: itemId, quantity: 2 }], 'cash', undefined, NOW);
  await assert.rejects(processReturnOn(a, ids, 's1', saleId, [{ saleItemId: itemId, quantity: 2 }], 'cash', undefined, NOW), /más de 1 de Arroz/);
  assert.equal(countOf(db, 'returns'), 1);
  assert.equal(stockOf(db, 'p1'), 99);
});

test('devolver a la cuenta una venta fiada baja la deuda del cliente', async () => {
  const db = memoryDb();
  const a = adapter(db);
  const ids = makeIds();
  await checkoutSaleOn(a, ids, 's1', [{ product: ARROZ, quantity: 3 }], { paymentMethod: 'credit', received: asMinor(0), customerId: 'c1' }, NOW);
  const saleId = one<{ id: string }>(db, 'SELECT id FROM sales').id;
  const itemId = one<{ id: string }>(db, 'SELECT id FROM sale_items').id;
  await processReturnOn(a, ids, 's1', saleId, [{ saleItemId: itemId, quantity: 1 }], 'account', undefined, NOW);
  assert.equal(balanceOf(db), 4000);
  const entry = one<{ type: string; amount: number }>(db, "SELECT type, amount FROM customer_ledger WHERE type='refund'");
  assert.deepEqual({ ...entry }, { type: 'refund', amount: -2000 });
});

test('una venta sin cliente no se puede devolver a la cuenta', async () => {
  const { a, ids, saleId, itemId } = await cashSaleOfThree();
  await assert.rejects(processReturnOn(a, ids, 's1', saleId, [{ saleItemId: itemId, quantity: 1 }], 'account', undefined, NOW), /no tiene cliente/);
});

test('una venta anulada no se puede devolver', async () => {
  const { a, ids, saleId, itemId } = await cashSaleOfThree();
  await voidSaleOn(a, ids, 's1', saleId);
  await assert.rejects(processReturnOn(a, ids, 's1', saleId, [{ saleItemId: itemId, quantity: 1 }], 'cash', undefined, NOW), /anulada/);
});

test('sin artículos seleccionados la devolución se rechaza', async () => {
  const { a, ids, saleId, itemId } = await cashSaleOfThree();
  await assert.rejects(processReturnOn(a, ids, 's1', saleId, [{ saleItemId: itemId, quantity: 0 }], 'cash', undefined, NOW), /al menos un artículo/);
});
