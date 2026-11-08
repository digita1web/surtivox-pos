import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asMinor } from '@surtivox/pos-core';
import { checkoutSaleOn, recordCustomerPaymentOn } from './checkoutOps.ts';
import { ACEITE, ARROZ, NOW, adapter, all, balanceOf, countOf, makeIds, memoryDb, stockOf } from './moneyKit.test.ts';

const cash = (received: number) => ({ paymentMethod: 'cash' as const, received: asMinor(received) });

test('el siguiente número de factura no repite uno existente, uno traído de otro teléfono ni uno renombrado', async () => {
  const db = memoryDb();
  const insert = db.prepare("INSERT INTO sales (id,store_id,invoice_no,status,subtotal,grand_total,sold_at,created_at,updated_at,device_id) VALUES (?,?,?,'completed',1,1,?,?,?,'d2')");
  insert.run('x1', 's1', 'INV-0001', NOW, NOW, NOW);
  insert.run('x3', 's1', 'INV-0003', NOW, NOW, NOW);
  insert.run('x5', 's1', 'INV-0005-AB12', NOW, NOW, NOW);
  const receipt = await checkoutSaleOn(adapter(db), makeIds(), 's1', [{ product: ARROZ, quantity: 1 }], cash(2000), NOW);
  assert.equal(receipt.invoiceNo, 'INV-0006');
});

test('la primera venta de una tienda es INV-0001 y no se mezcla con los números de otra tienda', async () => {
  const db = memoryDb();
  db.prepare('INSERT INTO stores (id,name,currency_code,currency_locale,currency_decimals,created_at,updated_at,device_id) VALUES (?,?,?,?,?,?,?,?)')
    .run('s2', 'Otra', 'COP', 'es-CO', 0, NOW, NOW, 'd1');
  db.prepare("INSERT INTO sales (id,store_id,invoice_no,status,subtotal,grand_total,sold_at,created_at,updated_at,device_id) VALUES ('o1','s2','INV-0042','completed',1,1,?,?,?,'d1')").run(NOW, NOW, NOW);
  const receipt = await checkoutSaleOn(adapter(db), makeIds(), 's1', [{ product: ARROZ, quantity: 1 }], cash(2000), NOW);
  assert.equal(receipt.invoiceNo, 'INV-0001');
});

test('dos cobros idénticos en el mismo instante: se registra uno y el otro se rechaza con un aviso claro', async () => {
  const db = memoryDb();
  const a = adapter(db);
  const ids = makeIds();
  const call = () => checkoutSaleOn(a, ids, 's1', [{ product: ARROZ, quantity: 1 }], cash(2000), NOW);
  const results = await Promise.allSettled([call(), call()]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const rejected = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')!;
  assert.match(String(rejected.reason.message), /ya se está registrando/);
  assert.equal(countOf(db, 'sales'), 1);
  assert.equal(stockOf(db, 'p1'), 99);
});

test('dos ventas distintas en el mismo instante se registran una tras otra con números distintos', async () => {
  const db = memoryDb();
  const a = adapter(db);
  const ids = makeIds();
  const results = await Promise.all([
    checkoutSaleOn(a, ids, 's1', [{ product: ARROZ, quantity: 1 }], cash(2000), NOW),
    checkoutSaleOn(a, ids, 's1', [{ product: ACEITE, quantity: 1 }], cash(12000), NOW),
  ]);
  assert.deepEqual(results.map((r) => r.invoiceNo).sort(), ['INV-0001', 'INV-0002']);
  assert.deepEqual(all<{ invoice_no: string }>(db, 'SELECT invoice_no FROM sales ORDER BY invoice_no').map((r) => r.invoice_no), ['INV-0001', 'INV-0002']);
  assert.equal(stockOf(db, 'p1'), 99);
  assert.equal(stockOf(db, 'p3'), 49);
});

test('una venta que falla no pierde a la que estaba en curso y deja pasar a la siguiente', async () => {
  const db = memoryDb();
  const a = adapter(db);
  const ids = makeIds();
  const results = await Promise.allSettled([
    checkoutSaleOn(a, ids, 's1', [{ product: ARROZ, quantity: 1 }], cash(100), NOW),
    checkoutSaleOn(a, ids, 's1', [{ product: ARROZ, quantity: 2 }], cash(4000), NOW),
  ]);
  assert.deepEqual(results.map((r) => r.status), ['rejected', 'fulfilled']);
  assert.equal(countOf(db, 'sales'), 1);
});

test('dos abonos idénticos en el mismo instante se registran una sola vez', async () => {
  const db = memoryDb();
  const a = adapter(db);
  const ids = makeIds();
  await checkoutSaleOn(a, ids, 's1', [{ product: ARROZ, quantity: 3 }], { paymentMethod: 'credit', received: asMinor(0), customerId: 'c1' }, NOW);
  const call = () => recordCustomerPaymentOn(a, ids, 's1', 'c1', asMinor(1000), undefined, NOW);
  const results = await Promise.allSettled([call(), call()]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(balanceOf(db), 5000);
});

test('después de terminar un abono se puede registrar otro igual', async () => {
  const db = memoryDb();
  const a = adapter(db);
  const ids = makeIds();
  await checkoutSaleOn(a, ids, 's1', [{ product: ARROZ, quantity: 3 }], { paymentMethod: 'credit', received: asMinor(0), customerId: 'c1' }, NOW);
  await recordCustomerPaymentOn(a, ids, 's1', 'c1', asMinor(1000), undefined, NOW);
  await recordCustomerPaymentOn(a, ids, 's1', 'c1', asMinor(1000), undefined, NOW);
  assert.equal(balanceOf(db), 4000);
});
