import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currencyForStore, parseCurrencyInput } from './branding.ts';
import { settleCash } from './checkoutMath.ts';

test('COP: 3000 paid with 50000 leaves 47000 change', () => {
  const legacyStore = { currency_code: 'COP', currency_locale: 'en-US', currency_decimals: 2 };
  const currency = currencyForStore(legacyStore);
  const total = parseCurrencyInput('3000', currency.code);

  assert.equal(currency.decimals, 0);
  assert.equal(total, 3000);
  assert.notEqual(total, 300000);

  const settlement = settleCash(total, '50000', currency);
  assert.equal(settlement.received, 50000);
  assert.equal(settlement.change, 47000);
  assert.notEqual(settlement.change, 4700000);
});
