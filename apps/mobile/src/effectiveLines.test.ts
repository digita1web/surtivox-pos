import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocateLargestRemainder, computeReturnRefunds, effectiveItems, mulDivRound } from './effectiveLines.ts';

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

test('mulDivRound redondea mitades hacia arriba y no usa decimales', () => {
  assert.equal(mulDivRound(1, 1, 2), 1);
  assert.equal(mulDivRound(1, 1, 3), 0);
  assert.equal(mulDivRound(2, 1, 3), 1);
  assert.equal(mulDivRound(5, 3, 10), 2);
  assert.equal(mulDivRound(0, 5, 7), 0);
  assert.equal(mulDivRound(9_000_000_000, 9_000_000_000, 9_000_000_000), 9_000_000_000);
});

test('el reparto por mayor resto suma exactamente el total', () => {
  assert.deepEqual(allocateLargestRemainder(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(allocateLargestRemainder(10, [3, 3, 4]), [3, 3, 4]);
  assert.deepEqual(allocateLargestRemainder(14400, [4000, 12000]), [3600, 10800]);
  assert.deepEqual(allocateLargestRemainder(5, [0, 0]), [3, 2]);
  assert.deepEqual(allocateLargestRemainder(0, [10, 20]), [0, 0]);
  assert.deepEqual(allocateLargestRemainder(7, []), []);
});

test('si el total ya es la suma de los pesos, cada renglón conserva su valor', () => {
  assert.deepEqual(allocateLargestRemainder(16000, [4000, 12000]), [4000, 12000]);
});

test('el reparto es exacto con muchos renglones y montos grandes', () => {
  const weights = [1999, 3001, 777, 12345, 1, 99999, 250000];
  for (const total of [0, 1, 7, 999, 123456, 366122, 9_007_199_000_000]) {
    const out = allocateLargestRemainder(total, weights);
    assert.equal(sum(out), total);
    assert.ok(out.every((n) => Number.isInteger(n) && n >= 0));
  }
});

test('un total negativo o con decimales se rechaza', () => {
  assert.throws(() => allocateLargestRemainder(-1, [1]), RangeError);
  assert.throws(() => allocateLargestRemainder(1.5, [1]), RangeError);
});

test('los valores efectivos suman el total cobrado y los impuestos no superan el renglón', () => {
  const items = [
    { id: 'a', quantity: 2, line_total: 4000, tax: 0 },
    { id: 'b', quantity: 1, line_total: 11900, tax: 1900 },
  ];
  const effective = effectiveItems(14310, items);
  assert.equal(sum(effective.map((e) => e.effectiveTotal)), 14310);
  assert.ok(effective.every((e, i) => e.effectiveTax <= e.effectiveTotal && e.effectiveTax <= items[i]!.tax));
});

test('las devoluciones sucesivas de una unidad suman exactamente el valor del renglón', () => {
  const item = { id: 'a', quantity: 3, line_total: 300, tax: 0 };
  let returned = 0;
  let refunded = 0;
  for (let i = 0; i < 3; i++) {
    const [share] = computeReturnRefunds(200, [{ ...item, returned, refunded, refunded_tax: 0 }], [{ saleItemId: 'a', quantity: 1 }]);
    refunded += share!.line;
    returned += 1;
  }
  assert.equal(refunded, 200);
});

test('devolver en cualquier orden y combinación nunca supera lo cobrado y al final suma todo', () => {
  const base = [
    { id: 'a', quantity: 3, line_total: 3333, tax: 0 },
    { id: 'b', quantity: 2, line_total: 9999, tax: 0 },
    { id: 'c', quantity: 5, line_total: 1001, tax: 0 },
  ];
  const total = 12345;
  const orders = [['a', 'b', 'c'], ['c', 'b', 'a'], ['b', 'a', 'c']];
  for (const order of orders) {
    const state = base.map((i) => ({ ...i, returned: 0, refunded: 0, refunded_tax: 0 }));
    let paidBack = 0;
    for (const id of order) {
      const item = state.find((s) => s.id === id)!;
      while (item.returned < item.quantity) {
        const [share] = computeReturnRefunds(total, state, [{ saleItemId: id, quantity: 1 }]);
        item.refunded += share!.line;
        item.returned += 1;
        paidBack += share!.line;
        assert.ok(paidBack <= total);
      }
    }
    assert.equal(paidBack, total);
  }
});

test('un reembolso de varias unidades de una vez coincide con el de una en una', () => {
  const state = [{ id: 'a', quantity: 7, line_total: 1000, tax: 190, returned: 0, refunded: 0, refunded_tax: 0 }];
  const [once] = computeReturnRefunds(900, state, [{ saleItemId: 'a', quantity: 7 }]);
  assert.equal(once!.line, 900);
  assert.ok(once!.tax <= once!.line);
});
