import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { currencyCodeForNewShop } from './branding.ts';

const screen = readFileSync(new URL('../app/new-shop.tsx', import.meta.url), 'utf8');

test('una tienda nueva hereda la moneda de la tienda activa', () => {
  assert.equal(currencyCodeForNewShop({ currency_code: 'COP' }), 'COP');
  assert.equal(currencyCodeForNewShop({ currency_code: 'USD' }), 'USD');
  assert.equal(currencyCodeForNewShop({ currency_code: 'EUR' }), 'EUR');
});

test('sin tienda activa o con una moneda desconocida se usa COP, la moneda de la app', () => {
  assert.equal(currencyCodeForNewShop(null), 'COP');
  assert.equal(currencyCodeForNewShop(undefined), 'COP');
  assert.equal(currencyCodeForNewShop({ currency_code: 'XXX' }), 'COP');
});

test('agregar una tienda no depende de la configuración regional ni cambia la moneda de las demás', () => {
  assert.doesNotMatch(screen, /defaultCurrencyFor/);
  assert.doesNotMatch(screen, /Intl\.DateTimeFormat/);
  assert.doesNotMatch(screen, /updateAllStoreCurrencies/);
  assert.doesNotMatch(screen, /setAppCurrency/);
  assert.doesNotMatch(screen, /CURRENCIES/);
  assert.match(screen, /currencyCodeForNewShop\(activeStore\)/);
  assert.match(screen, /Es la misma de tus otras tiendas/);
});
