import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recoveryFailureMessage, NO_RECOVERY_MESSAGE } from './recoveryMessages.ts';

test('every failure has a clear message in Spanish and success has none', () => {
  const now = 1_000_000;
  assert.equal(recoveryFailureMessage({ status: 'ok', newCode: 'X' }, now), null);
  assert.match(recoveryFailureMessage({ status: 'wrong', attemptsLeft: 3 }, now)!, /quedan 3 intentos/);
  assert.match(recoveryFailureMessage({ status: 'wrong', attemptsLeft: 1 }, now)!, /queda 1 intento/);
  assert.match(recoveryFailureMessage({ status: 'locked', retryAt: now + 30_000 }, now)!, /0:30/);
  assert.match(recoveryFailureMessage({ status: 'bad-format' }, now)!, /16 letras y números/);
  assert.equal(recoveryFailureMessage({ status: 'bad-pin', message: 'PIN fácil' }, now), 'PIN fácil');
  assert.match(recoveryFailureMessage({ status: 'no-owner' }, now)!, /ya no es propietaria/);
  assert.equal(recoveryFailureMessage({ status: 'missing' }, now), NO_RECOVERY_MESSAGE);
});

test('the no-code message points to the two real ways out and never promises the impossible', () => {
  assert.match(NO_RECOVERY_MESSAGE, /otro propietario/);
  assert.match(NO_RECOVERY_MESSAGE, /borrar los datos/);
  assert.doesNotMatch(NO_RECOVERY_MESSAGE, /restaur/i);
});
