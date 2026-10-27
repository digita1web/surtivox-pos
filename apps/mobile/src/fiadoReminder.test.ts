import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWhatsAppPhone } from './fiadoReminder.ts';

test('normaliza un celular colombiano de diez dígitos', () => {
  assert.equal(normalizeWhatsAppPhone('3001234567'), '573001234567');
});

test('normaliza un número con prefijo +57 y separadores', () => {
  assert.equal(normalizeWhatsAppPhone('+57 300 123 4567'), '573001234567');
});

test('acepta un número que ya empieza con 57', () => {
  assert.equal(normalizeWhatsAppPhone('573001234567'), '573001234567');
});

test('quita el cero inicial de un celular colombiano', () => {
  assert.equal(normalizeWhatsAppPhone('03001234567'), '573001234567');
});

test('rechaza diez dígitos que no empiezan en 3', () => {
  assert.equal(normalizeWhatsAppPhone('1234567890'), null);
});

test('rechaza un número de nueve dígitos', () => {
  assert.equal(normalizeWhatsAppPhone('300123456'), null);
});

test('rechaza una cadena vacía', () => {
  assert.equal(normalizeWhatsAppPhone(''), null);
});

test('rechaza null', () => {
  assert.equal(normalizeWhatsAppPhone(null), null);
});

test('limpia guiones y espacios', () => {
  assert.equal(normalizeWhatsAppPhone('300-123-45-67'), '573001234567');
});
