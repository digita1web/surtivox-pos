import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldRemindBackup } from './backupReminder.ts';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 2, 12, 0, 0);

function input(overrides: Partial<Parameters<typeof shouldRemindBackup>[0]> = {}) {
  return {
    now,
    lastBackupAt: null,
    salesSinceBackup: 0,
    totalSales: 0,
    snoozedUntil: null,
    ...overrides,
  };
}

test('does not remind without sales', () => {
  assert.equal(shouldRemindBackup(input({ totalSales: 0, salesSinceBackup: 0 })), false);
});

test('does not remind at 9 sales when there is no previous backup', () => {
  assert.equal(shouldRemindBackup(input({ totalSales: 9, salesSinceBackup: 9 })), false);
});

test('reminds at 10 sales when there is no previous backup', () => {
  assert.equal(shouldRemindBackup(input({ totalSales: 10, salesSinceBackup: 10 })), true);
});

test('does not remind after 6 days with new sales', () => {
  assert.equal(shouldRemindBackup(input({
    lastBackupAt: now - 6 * DAY,
    totalSales: 10,
    salesSinceBackup: 1,
  })), false);
});

test('reminds after 7 days with new sales', () => {
  assert.equal(shouldRemindBackup(input({
    lastBackupAt: now - 7 * DAY,
    totalSales: 10,
    salesSinceBackup: 1,
  })), true);
});

test('reminds with 50 new sales even if the last backup is recent', () => {
  assert.equal(shouldRemindBackup(input({
    lastBackupAt: now - DAY,
    totalSales: 60,
    salesSinceBackup: 50,
  })), true);
});

test('does not remind while snoozed', () => {
  assert.equal(shouldRemindBackup(input({
    totalSales: 20,
    salesSinceBackup: 20,
    snoozedUntil: now + DAY,
  })), false);
});

test('reminds after the snooze expires', () => {
  assert.equal(shouldRemindBackup(input({
    totalSales: 20,
    salesSinceBackup: 20,
    snoozedUntil: now - 1,
  })), true);
});

test('does not remind when the clock is behind the last backup', () => {
  assert.equal(shouldRemindBackup(input({
    lastBackupAt: now + DAY,
    totalSales: 10,
    salesSinceBackup: 1,
  })), false);
});

test('does not remind when the clock is behind a future snooze', () => {
  assert.equal(shouldRemindBackup(input({
    totalSales: 60,
    salesSinceBackup: 50,
    snoozedUntil: now + DAY,
  })), false);
});
