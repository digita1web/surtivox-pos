import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReminderCount, serializeReminderCount } from './fiadoReminderCounter.ts';

test('lee un contador válido', () => {
  assert.equal(parseReminderCount('{"remindersSent":5}'), 5);
});

test('devuelve cero para un archivo vacío o inválido', () => {
  assert.equal(parseReminderCount(null), 0);
  assert.equal(parseReminderCount(''), 0);
  assert.equal(parseReminderCount('no-json'), 0);
  assert.equal(parseReminderCount('{"remindersSent":-2}'), 0);
});

test('serializa un contador entero no negativo', () => {
  assert.equal(serializeReminderCount(3), '{"remindersSent":3}');
  assert.equal(serializeReminderCount(-1), '{"remindersSent":0}');
  assert.equal(serializeReminderCount(2.9), '{"remindersSent":2}');
});
