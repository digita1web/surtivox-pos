import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_CURRENCY, CURRENCIES } from './branding.ts';

const onboarding = readFileSync(new URL('./pos/Onboarding.tsx', import.meta.url), 'utf8');
const branding = readFileSync(new URL('./branding.ts', import.meta.url), 'utf8');

test('la moneda por defecto de la app es el peso colombiano y es una de las opciones', () => {
  assert.equal(APP_CURRENCY.code, 'COP');
  assert.ok(CURRENCIES.some((currency) => currency.code === APP_CURRENCY.code));
});

test('la primera tienda empieza en COP y no depende de la configuración regional del teléfono', () => {
  assert.match(onboarding, /useState<string>\(APP_CURRENCY\.code\)/);
  assert.doesNotMatch(onboarding, /defaultCurrencyFor/);
  assert.doesNotMatch(onboarding, /Intl\.DateTimeFormat/);
  assert.doesNotMatch(branding, /defaultCurrencyFor/);
});
