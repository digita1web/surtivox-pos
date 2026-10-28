import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asMinor } from '@openpocket/pos-core';
import { safeAccent, onAccent, contactLines, shopInitials, normalizeUrl, DEFAULT_ACCENT, defaultCurrencyFor, localeForCurrency, currencyConfigFor, CURRENCIES, currencyDecimalsFor, parseCurrencyInput, currencyForStore, APP_CURRENCY, DEFAULT_FOOTER, DEFAULT_RECEIPT_TERMS, localizedReceiptFooter, localizedReceiptTerms } from './branding.ts';

test('safeAccent only accepts #rrggbb and falls back otherwise', () => {
  assert.equal(safeAccent('#2563EB'), '#2563eb');
  assert.equal(safeAccent('  #ea580c '), '#ea580c');
  assert.equal(safeAccent('red'), DEFAULT_ACCENT);
  assert.equal(safeAccent('#fff'), DEFAULT_ACCENT);
  assert.equal(safeAccent(null), DEFAULT_ACCENT);
  // must never let CSS through
  assert.equal(safeAccent('#000000;background:url(x)'), DEFAULT_ACCENT);
});

test('onAccent picks readable text', () => {
  assert.equal(onAccent('#111827'), '#ffffff');
  assert.equal(onAccent('#fde047'), '#111827');
});

test('contactLines drops blanks and keeps order', () => {
  assert.deepEqual(contactLines({ address: ' 12 Main St ', phone: '', email: 'a@b.co', website: null }), ['12 Main St', 'a@b.co']);
  assert.deepEqual(contactLines({}), []);
});

test('shopInitials and normalizeUrl', () => {
  assert.equal(shopInitials('Bin Hashim Mart'), 'BH');
  assert.equal(shopInitials('  '), '?');
  assert.equal(normalizeUrl('https://shop.example.com/'), 'shop.example.com');
});

test('defaultCurrencyFor maps device regions to a currency, defaulting to USD', () => {
  assert.equal(defaultCurrencyFor('en-US'), 'USD');
  assert.equal(defaultCurrencyFor('en-GB'), 'GBP');
  assert.equal(defaultCurrencyFor('fr_FR'), 'EUR');
  assert.equal(defaultCurrencyFor('en-CA'), 'CAD');
  assert.equal(defaultCurrencyFor('ur-PK'), 'PKR');
  assert.equal(defaultCurrencyFor('es-CO'), 'COP');
  assert.equal(defaultCurrencyFor('ja-JP'), 'USD'); // unmapped region
  assert.equal(defaultCurrencyFor('en'), 'USD');    // no region
  assert.equal(defaultCurrencyFor(null), 'USD');
});

test('every offered currency has a Latin-digit locale', () => {
  for (const c of CURRENCIES) assert.match(c.locale, /^(en|es)-/, c.code);
  assert.equal(localeForCurrency('GBP'), 'en-GB');
  assert.equal(localeForCurrency('COP'), 'es-CO');
  assert.equal(localeForCurrency('XXX'), 'en-US');
  assert.deepEqual(currencyConfigFor('COP'), { code: 'COP', locale: 'es-CO', decimals: 0 });
  assert.equal(CURRENCIES.find((c) => c.code === 'COP')?.symbol, '$');
});

test('COP price input keeps exact units', () => {
  assert.equal(currencyDecimalsFor('COP'), 0);
  assert.equal(asMinor(20000), 20000);
  assert.equal(parseCurrencyInput('20000', 'COP'), 20000);
  assert.notEqual(parseCurrencyInput('20000', 'COP'), 2000000);
  assert.equal(parseCurrencyInput('1500', 'COP'), 1500);
});

test('app displays the selected store currency with whole units', () => {
  assert.deepEqual(APP_CURRENCY, { code: 'COP', locale: 'es-CO', decimals: 0 });
  assert.deepEqual(currencyForStore({ currency_code: 'COP' }), { code: 'COP', locale: 'es-CO', decimals: 0 });
  assert.deepEqual(currencyForStore({ currency_code: 'USD' }), { code: 'USD', locale: 'en-US', decimals: 0 });
  assert.deepEqual(currencyForStore({ currency_code: 'EUR' }), { code: 'EUR', locale: 'en-IE', decimals: 0 });
});

test('receipt footer and terms translate English defaults', () => {
  assert.match(DEFAULT_FOOTER, /Gracias por su compra/);
  assert.match(DEFAULT_FOOTER, /Vuelva pronto/);
  assert.match(DEFAULT_RECEIPT_TERMS, /productos perecederos/);
  assert.equal(localizedReceiptFooter('Thank you for shopping with us!\nSee you again soon.'), '¡Gracias por su compra!\n¡Vuelva pronto!');
  assert.equal(localizedReceiptFooter('Thank you for your business!'), '¡Gracias por su compra!');
  assert.equal(
    localizedReceiptTerms('Items can be returned within 14 days with this receipt. Perishable goods are non-returnable.'),
    DEFAULT_RECEIPT_TERMS,
  );
});
