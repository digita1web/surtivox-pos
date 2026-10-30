import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asMinor } from '@surtivox/pos-core';
import { formatCopAmount } from './receiptMoney.ts';

test('receipt COP keeps 3000 unchanged and formats it as $ 3.000', () => {
  const total = asMinor(3000);
  const received = asMinor(50000);
  const change = asMinor(47000);

  assert.equal(total, 3000);
  assert.equal(formatCopAmount(total), '$ 3.000');
  assert.equal(formatCopAmount(received), '$ 50.000');
  assert.equal(formatCopAmount(change), '$ 47.000');
  assert.equal(formatCopAmount(asMinor(20500)), '$ 20.500');
  assert.notEqual(formatCopAmount(asMinor(20500)), '$20,500.00');
  assert.notEqual(formatCopAmount(total), '$ 300.000');
  assert.notEqual(formatCopAmount(change), '$ 4.700.000');
});
