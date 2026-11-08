import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asMinor } from '@surtivox/pos-core';
import { checkoutSaleOn, type CheckoutProduct } from './checkoutOps.ts';
import { ACEITE, ARROZ, BORRADOR, NOW, adapter, all, balanceOf, countOf, makeIds, memoryDb, one, stockOf } from './moneyKit.test.ts';

const cash = (received: number) => ({ paymentMethod: 'cash' as const, received: asMinor(received) });

test('una venta de contado guarda venta, renglón y pago, y descuenta el stock', async () => {
  const db = memoryDb();
  const receipt = await checkoutSaleOn(adapter(db), makeIds(), 's1', [{ product: ARROZ, quantity: 3 }], cash(10000), NOW);
  assert.equal(receipt.invoiceNo, 'INV-0001');
  assert.equal(receipt.grandTotal, 6000);
  assert.equal(receipt.change, 4000);
  const sale = one<{ grand_total: number; status: string; customer_id: string | null }>(db, 'SELECT grand_total, status, customer_id FROM sales');
  assert.deepEqual({ ...sale }, { grand_total: 6000, status: 'completed', customer_id: null });
  const item = one<{ quantity: number; line_total: number; unit_cost: number }>(db, 'SELECT quantity, line_total, unit_cost FROM sale_items');
  assert.deepEqual({ ...item }, { quantity: 3, line_total: 6000, unit_cost: 1000 });
  const payment = one<{ type: string; amount: number }>(db, 'SELECT type, amount FROM payments');
  assert.deepEqual({ ...payment }, { type: 'cash', amount: 6000 });
  assert.equal(stockOf(db, 'p1'), 97);
  assert.equal(countOf(db, 'customer_ledger'), 0);
});

test('el efectivo insuficiente se rechaza sin escribir nada', async () => {
  const db = memoryDb();
  await assert.rejects(checkoutSaleOn(adapter(db), makeIds(), 's1', [{ product: ARROZ, quantity: 3 }], cash(5000), NOW));
  assert.equal(countOf(db, 'sales'), 0);
  assert.equal(countOf(db, 'payments'), 0);
  assert.equal(stockOf(db, 'p1'), 100);
});

test('la venta no admite descuento por renglón: el descuento del renglón queda en 0', async () => {
  const db = memoryDb();
  await checkoutSaleOn(adapter(db), makeIds(), 's1', [{ product: ARROZ, quantity: 2 }], cash(4000), NOW);
  assert.equal(one<{ discount: number }>(db, 'SELECT discount FROM sale_items').discount, 0);
});

test('el descuento general baja el total cobrado y se guarda en la venta', async () => {
  const db = memoryDb();
  const receipt = await checkoutSaleOn(
    adapter(db), makeIds(), 's1',
    [{ product: ARROZ, quantity: 2 }, { product: ACEITE, quantity: 1 }],
    { ...cash(20000), discountBps: 1000 }, NOW,
  );
  assert.equal(receipt.subtotal, 16000);
  assert.equal(receipt.discountTotal, 1600);
  assert.equal(receipt.grandTotal, 14400);
  assert.equal(one<{ amount: number }>(db, 'SELECT amount FROM payments').amount, 14400);
  assert.equal(one<{ grand_total: number; discount_total: number }>(db, 'SELECT grand_total, discount_total FROM sales').grand_total, 14400);
});

test('una venta fiada completa exige cliente y carga todo el total al saldo sin crear pago', async () => {
  const db = memoryDb();
  const base = { paymentMethod: 'credit' as const, received: asMinor(0) };
  await assert.rejects(checkoutSaleOn(adapter(db), makeIds(), 's1', [{ product: ARROZ, quantity: 3 }], base, NOW), /cliente/);
  assert.equal(countOf(db, 'sales'), 0);
  await checkoutSaleOn(adapter(db), makeIds(), 's1', [{ product: ARROZ, quantity: 3 }], { ...base, customerId: 'c1' }, NOW);
  assert.equal(balanceOf(db), 6000);
  assert.equal(countOf(db, 'payments'), 0);
  const ledger = one<{ type: string; reference_type: string }>(db, 'SELECT type, reference_type FROM customer_ledger');
  assert.deepEqual({ ...ledger }, { type: 'sale', reference_type: 'sale' });
});

test('no existe la fiada parcial: en una venta fiada el monto recibido se ignora', async () => {
  const db = memoryDb();
  await checkoutSaleOn(
    adapter(db), makeIds(), 's1', [{ product: ARROZ, quantity: 3 }],
    { paymentMethod: 'credit', received: asMinor(2000), customerId: 'c1' }, NOW,
  );
  assert.equal(balanceOf(db), 6000);
  assert.equal(countOf(db, 'payments'), 0);
});

test('solo los productos con inventario descuentan stock; la venta rápida no crea movimiento', async () => {
  const db = memoryDb();
  const quick: CheckoutProduct = { id: 'quick-1', name: 'Varios', selling_price: 700, cost_price: 0, tax_bps: 0, isQuick: true };
  await checkoutSaleOn(adapter(db), makeIds(), 's1', [
    { product: ARROZ, quantity: 1 }, { product: BORRADOR, quantity: 2 }, { product: quick, quantity: 1 },
  ], cash(10000), NOW);
  assert.equal(stockOf(db, 'p1'), 99);
  assert.equal(stockOf(db, 'p2'), 0);
  const items = all<{ product_id: string | null }>(db, 'SELECT product_id FROM sale_items ORDER BY product_name_snapshot');
  assert.deepEqual(items.map((i) => i.product_id), ['p1', 'p2', null]);
  assert.equal(countOf(db, 'stock_movements'), 3);
});

test('los números de factura de ventas seguidas son consecutivos', async () => {
  const db = memoryDb();
  const a = adapter(db);
  const ids = makeIds();
  const first = await checkoutSaleOn(a, ids, 's1', [{ product: ARROZ, quantity: 1 }], cash(2000), NOW);
  const second = await checkoutSaleOn(a, ids, 's1', [{ product: ARROZ, quantity: 1 }], cash(2000), NOW + 1);
  assert.deepEqual([first.invoiceNo, second.invoiceNo], ['INV-0001', 'INV-0002']);
});

test('dos cobros idénticos uno después del otro son dos ventas', async () => {
  const db = memoryDb();
  const a = adapter(db);
  const ids = makeIds();
  await checkoutSaleOn(a, ids, 's1', [{ product: ARROZ, quantity: 1 }], cash(2000), NOW);
  await checkoutSaleOn(a, ids, 's1', [{ product: ARROZ, quantity: 1 }], cash(2000), NOW);
  assert.equal(countOf(db, 'sales'), 2);
  assert.equal(stockOf(db, 'p1'), 98);
});
