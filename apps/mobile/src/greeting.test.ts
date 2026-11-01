import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greetingForDate } from './greeting.ts';

function at(hour: number): Date {
  return new Date(2026, 0, 15, hour, 0, 0);
}

test('greeting follows the local time ranges', () => {
  assert.equal(greetingForDate(at(0)), 'Buenos días');
  assert.equal(greetingForDate(at(11)), 'Buenos días');
  assert.equal(greetingForDate(at(12)), 'Buenas tardes');
  assert.equal(greetingForDate(at(18)), 'Buenas tardes');
  assert.equal(greetingForDate(at(19)), 'Buenas noches');
  assert.equal(greetingForDate(at(23)), 'Buenas noches');
});
