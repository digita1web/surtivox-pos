import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateStaffName, validatePin, isWeakPin, lockoutMs, registerFailure, remainingLockMs, attemptsLeft, parseGuard,
  CLEAN_GUARD, formatWait, parseAutoLock, shouldAutoLock, FREE_ATTEMPTS, MAX_LOCKOUT_MS, normalizeName, DEFAULT_AUTO_LOCK_MINUTES,
} from './staffRules.ts';

test('names are required, bounded and unique ignoring case, accents and extra spaces', () => {
  assert.equal(validateStaffName('  ', []), 'El nombre es obligatorio');
  assert.match(validateStaffName('x'.repeat(41), []) ?? '', /40/);
  assert.equal(validateStaffName('Camila Rodríguez', ['Ana', 'Luis']), null);
  assert.equal(validateStaffName('camila  rodriguez', ['Camila Rodríguez']), 'Ya hay una persona con ese nombre');
  assert.equal(normalizeName('  ÁNGEL   Pérez '), 'angel perez');
});

test('weak PINs are rejected: repeated, straight runs and ABAB', () => {
  for (const pin of ['0000', '1111', '9999', '1234', '2345', '6789', '4321', '9876', '1212', '6969']) assert.equal(isWeakPin(pin), true, pin);
  for (const pin of ['1357', '2580', '4821', '0739', '1990']) assert.equal(isWeakPin(pin), false, pin);
});

test('PIN validation checks format, confirmation and strength in that order', () => {
  assert.match(validatePin('12', '12') ?? '', /4 dígitos/);
  assert.match(validatePin('1357', '1358') ?? '', /no coinciden/);
  assert.match(validatePin('1234', '1234') ?? '', /fácil de adivinar/);
  assert.equal(validatePin('1357', '1357'), null);
});

test('lockout is free for 5 attempts, then doubles from 30 seconds up to 15 minutes', () => {
  assert.equal(FREE_ATTEMPTS, 5);
  assert.deepEqual([1, 4, 5, 6, 7, 8, 9, 10, 20].map(lockoutMs), [0, 0, 30_000, 60_000, 120_000, 240_000, 480_000, 900_000, 900_000]);
  assert.equal(lockoutMs(99), MAX_LOCKOUT_MS);
});

test('failures accumulate, lock on the fifth, and the lock expires but the count persists', () => {
  let guard = CLEAN_GUARD;
  const t0 = 1_000_000;
  for (let i = 1; i <= 4; i++) { guard = registerFailure(guard, t0 + i); assert.equal(remainingLockMs(guard, t0 + i), 0); }
  assert.equal(attemptsLeft(guard, t0 + 4), 1);
  guard = registerFailure(guard, t0 + 5);
  assert.equal(remainingLockMs(guard, t0 + 5), 30_000);
  assert.equal(remainingLockMs(guard, t0 + 5 + 30_000), 0);
  guard = registerFailure(guard, t0 + 40_000);
  assert.equal(remainingLockMs(guard, t0 + 40_000), 60_000);
});

test('the failure counter is forgotten after 12 hours without attempts', () => {
  const old = { failures: 9, lockedUntil: 0, lastAt: 1000 };
  const later = 1000 + 12 * 3_600_000 + 1;
  assert.equal(attemptsLeft(old, later), FREE_ATTEMPTS);
  assert.equal(registerFailure(old, later).failures, 1);
});

test('a damaged stored guard never locks anyone out forever', () => {
  for (const raw of [null, '', 'no json', '{"failures":"x"}', '{"failures":-1,"lockedUntil":0,"lastAt":0}', '[]', '{"failures":1}']) {
    assert.deepEqual(parseGuard(raw), CLEAN_GUARD, String(raw));
  }
  assert.deepEqual(parseGuard('{"failures":3,"lockedUntil":10,"lastAt":5}'), { failures: 3, lockedUntil: 10, lastAt: 5 });
});

test('the wait is shown as minutes and seconds', () => {
  assert.equal(formatWait(30_000), '0:30');
  assert.equal(formatWait(61_000), '1:01');
  assert.equal(formatWait(900_000), '15:00');
  assert.equal(formatWait(-5), '0:00');
});

test('auto lock defaults to 5 minutes, ignores unknown values and never locks when off', () => {
  assert.equal(parseAutoLock(null), DEFAULT_AUTO_LOCK_MINUTES);
  assert.equal(parseAutoLock('15'), 15);
  assert.equal(parseAutoLock('0'), 0);
  assert.equal(parseAutoLock('7'), DEFAULT_AUTO_LOCK_MINUTES);
  assert.equal(parseAutoLock('abc'), DEFAULT_AUTO_LOCK_MINUTES);
  assert.equal(shouldAutoLock({ backgroundedAt: 0, now: 10 * 60_000, minutes: 0 }), false);
  assert.equal(shouldAutoLock({ backgroundedAt: null, now: 10 * 60_000, minutes: 5 }), false);
  assert.equal(shouldAutoLock({ backgroundedAt: 0, now: 4 * 60_000 + 59_000, minutes: 5 }), false);
  assert.equal(shouldAutoLock({ backgroundedAt: 0, now: 5 * 60_000, minutes: 5 }), true);
});
