import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gtinCheckDigit, isValidGtin } from '../src/gtin.ts';

test('acepta GTIN-8, UPC-A, EAN-13 y GTIN-14 con dígito de control correcto', () => {
  for (const code of ['96385074', '036000291452', '7702511000045', '17702511000042']) assert.equal(isValidGtin(code), true, code);
});

test('rechaza dígito de control errado, largos no GTIN, letras y ceros', () => {
  for (const code of ['7702511000046', '96385075', '1234567', '123456789', '77025110000451', '7702511OOOO45', '', '00000000', ' 7702511000045']) {
    assert.equal(isValidGtin(code), false, JSON.stringify(code));
  }
});

test('el dígito de control sigue el algoritmo GS1 (pesos 3 y 1 desde la derecha)', () => {
  assert.equal(gtinCheckDigit('770251100004'), 5);
  assert.equal(gtinCheckDigit('03600029145'), 2);
  assert.equal(gtinCheckDigit('9638507'), 4);
});
