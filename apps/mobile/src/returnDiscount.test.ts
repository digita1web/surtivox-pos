import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asMinor } from '@surtivox/pos-core';
import { checkoutSaleOn, type CheckoutProduct } from './checkoutOps.ts';
import { processReturnOn } from './returnOps.ts';
import { ACEITE, ARROZ, NOW, adapter, all, countOf, makeIds, memoryDb, one } from './moneyKit.test.ts';

const cash = (received: number) => ({ paymentMethod: 'cash' as const, received: asMinor(received) });

async function discountedSale() {
  const db = memoryDb();
  const a = adapter(db);
  const ids = makeIds();
  await checkoutSaleOn(a, ids, 's1', [{ product: ARROZ, quantity: 2 }, { product: ACEITE, quantity: 1 }], { ...cash(20000), discountBps: 1000 }, NOW);
  const saleId = one<{ id: string }>(db, 'SELECT id FROM sales').id;
  const items = all<{ id: string; quantity: number }>(db, 'SELECT id, quantity FROM sale_items ORDER BY product_name_snapshot');
  return { db, a, ids, saleId, items };
}

test('devolver todo de una venta con descuento general reembolsa exactamente lo cobrado', async () => {
  const { db, a, ids, saleId, items } = await discountedSale();
  const picks = items.map((i) => ({ saleItemId: i.id, quantity: i.quantity }));
  const receipt = await processReturnOn(a, ids, 's1', saleId, picks, 'cash', undefined, NOW);
  assert.equal(receipt.grandTotal, 14400);
  assert.deepEqual(receipt.lines.map((l) => l.lineTotal), [10800, 3600]);
  assert.equal(one<{ g: number }>(db, 'SELECT grand_total AS g FROM returns').g, 14400);
});

test('devolver por partes una venta con descuento suma exactamente lo cobrado', async () => {
  const { db, a, ids, saleId, items } = await discountedSale();
  const aceite = items[0]!;
  const arroz = items[1]!;
  const first = await processReturnOn(a, ids, 's1', saleId, [{ saleItemId: arroz.id, quantity: 1 }], 'cash', undefined, NOW);
  const second = await processReturnOn(a, ids, 's1', saleId, [{ saleItemId: arroz.id, quantity: 1 }, { saleItemId: aceite.id, quantity: 1 }], 'cash', undefined, NOW + 1);
  assert.equal(first.grandTotal, 1800);
  assert.equal(first.grandTotal + second.grandTotal, 14400);
  assert.equal(one<{ n: number }>(db, 'SELECT SUM(grand_total) AS n FROM returns').n, 14400);
});

test('devoluciones sucesivas de una unidad con redondeo no superan lo cobrado', async () => {
  const db = memoryDb();
  const a = adapter(db);
  const ids = makeIds();
  const barato: CheckoutProduct = { id: 'p1', name: 'Arroz', selling_price: 100, cost_price: 50, tax_bps: 0, track_inventory: 1 };
  await checkoutSaleOn(a, ids, 's1', [{ product: barato, quantity: 3 }], { ...cash(300), discountBps: 3333 }, NOW);
  assert.equal(one<{ g: number }>(db, 'SELECT grand_total AS g FROM sales').g, 200);
  const saleId = one<{ id: string }>(db, 'SELECT id FROM sales').id;
  const itemId = one<{ id: string }>(db, 'SELECT id FROM sale_items').id;
  const parts: number[] = [];
  for (let i = 0; i < 3; i++) {
    parts.push((await processReturnOn(a, ids, 's1', saleId, [{ saleItemId: itemId, quantity: 1 }], 'cash', undefined, NOW + i)).grandTotal);
  }
  assert.equal(parts.reduce((x, y) => x + y, 0), 200);
  assert.deepEqual(parts, [67, 66, 67]);
});

test('el impuesto devuelto no supera el reembolso y el subtotal es lo que queda', async () => {
  const db = memoryDb();
  const a = adapter(db);
  const ids = makeIds();
  const conIva: CheckoutProduct = { ...ACEITE, selling_price: 10000, cost_price: 6000, tax_bps: 1900 };
  await checkoutSaleOn(a, ids, 's1', [{ product: conIva, quantity: 1 }], { ...cash(20000), discountBps: 1000 }, NOW);
  const saleId = one<{ id: string }>(db, 'SELECT id FROM sales').id;
  const itemId = one<{ id: string }>(db, 'SELECT id FROM sale_items').id;
  const receipt = await processReturnOn(a, ids, 's1', saleId, [{ saleItemId: itemId, quantity: 1 }], 'cash', undefined, NOW);
  assert.equal(receipt.grandTotal, 10710);
  assert.equal(receipt.taxTotal, 1710);
  assert.equal(receipt.subtotal, 9000);
});

test('una venta guardada antes del arreglo se devuelve por el valor efectivo', async () => {
  const db = memoryDb();
  db.prepare("INSERT INTO sales (id,store_id,invoice_no,status,subtotal,discount_total,grand_total,sold_at,created_at,updated_at,device_id) VALUES ('old1','s1','INV-0001','completed',10000,1000,9000,?,?,?,'d1')").run(NOW, NOW, NOW);
  const item = db.prepare('INSERT INTO sale_items (id,sale_id,product_id,product_name_snapshot,unit_price,quantity,line_total,created_at,device_id) VALUES (?,?,?,?,?,?,?,?,?)');
  item.run('i1', 'old1', 'p1', 'Arroz', 2500, 2, 5000, NOW, 'd1');
  item.run('i2', 'old1', 'p3', 'Aceite', 5000, 1, 5000, NOW, 'd1');
  db.prepare("INSERT INTO payments (id,sale_id,type,amount,created_at,device_id) VALUES ('pay1','old1','cash',9000,?,'d1')").run(NOW);
  const receipt = await processReturnOn(adapter(db), makeIds(), 's1', 'old1', [{ saleItemId: 'i1', quantity: 2 }, { saleItemId: 'i2', quantity: 1 }], 'cash', undefined, NOW);
  assert.equal(receipt.grandTotal, 9000);
});

test('pedir dos veces el mismo renglón en una devolución se junta y respeta lo vendido', async () => {
  const { db, a, ids, saleId, items } = await discountedSale();
  const arroz = items[1]!;
  await assert.rejects(
    processReturnOn(a, ids, 's1', saleId, [{ saleItemId: arroz.id, quantity: 2 }, { saleItemId: arroz.id, quantity: 1 }], 'cash', undefined, NOW),
    /más de 2 de Arroz/,
  );
  assert.equal(countOf(db, 'returns'), 0);
});
