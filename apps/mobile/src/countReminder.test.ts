import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countReminderText, countSnoozeUntil, parseSettingNumber, shouldRemindCount } from './countReminder.ts';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 16, 12, 0, 0);
const base = { enabled: true, now, lastCountAt: now - 8 * DAY, trackedProducts: 5, snoozedUntil: null };

test('the weekly count reminder is opt in and needs products with inventory', () => {
  assert.equal(shouldRemindCount(base), true);
  assert.equal(shouldRemindCount({ ...base, enabled: false }), false);
  assert.equal(shouldRemindCount({ ...base, trackedProducts: 0 }), false);
});

test('it fires from seven days after the last count, or when there was never one', () => {
  assert.equal(shouldRemindCount({ ...base, lastCountAt: now - 6 * DAY }), false);
  assert.equal(shouldRemindCount({ ...base, lastCountAt: now - 7 * DAY }), true);
  assert.equal(shouldRemindCount({ ...base, lastCountAt: null }), true);
  assert.equal(shouldRemindCount({ ...base, lastCountAt: now + DAY }), false);
});

test('"Ahora no" hides it for one day', () => {
  const until = countSnoozeUntil(now);
  assert.equal(until, now + DAY);
  assert.equal(shouldRemindCount({ ...base, snoozedUntil: until }), false);
  assert.equal(shouldRemindCount({ ...base, now: until + 1, snoozedUntil: until }), true);
});

test('the reminder text is short and neutral', () => {
  assert.equal(countReminderText(null, now), 'Aún no has hecho un conteo de inventario.');
  assert.equal(countReminderText(now - 9 * DAY, now), 'Hace 9 días no cuentas el inventario.');
  assert.equal(parseSettingNumber('12'), 12);
  assert.equal(parseSettingNumber('x'), null);
  assert.equal(parseSettingNumber(null), null);
});
