import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recoveryCodeFromBytes, normalizeRecoveryCode, isWellFormedRecoveryCode, formatRecoveryCode, recoveryShareMessage, RECOVERY_ALPHABET, RECOVERY_LENGTH } from './recoveryCode.ts';

test('a recovery code has 16 characters from an alphabet without look-alikes', () => {
  assert.equal(RECOVERY_LENGTH, 16);
  assert.equal(RECOVERY_ALPHABET.length, 32);
  for (const bad of ['0', 'O', 'I', 'L']) assert.ok(!RECOVERY_ALPHABET.includes(bad), bad);
  assert.equal(new Set(RECOVERY_ALPHABET).size, 32);
  const code = recoveryCodeFromBytes(Uint8Array.from({ length: 16 }, (_, i) => i * 17));
  assert.equal(code.length, 16);
  assert.ok(isWellFormedRecoveryCode(code));
});

test('the byte to character mapping has no bias: 256 values spread evenly over 32 symbols', () => {
  const counts = new Map<string, number>();
  for (let b = 0; b < 256; b++) {
    const bytes = new Uint8Array(16).fill(b);
    const char = recoveryCodeFromBytes(bytes)[0]!;
    counts.set(char, (counts.get(char) ?? 0) + 1);
  }
  assert.equal(counts.size, 32);
  for (const n of counts.values()) assert.equal(n, 8);
});

test('too few random bytes is an error instead of a short code', () => {
  assert.throws(() => recoveryCodeFromBytes(new Uint8Array(15)), /bytes/);
});

test('typed codes are normalized: separators, spaces and lowercase are ignored', () => {
  assert.equal(normalizeRecoveryCode(' abcd-efgh 2345_6789 '), 'ABCDEFGH23456789');
  assert.equal(normalizeRecoveryCode('ILil'), '1111');
  assert.equal(formatRecoveryCode('ABCDEFGH23456789'), 'ABCD-EFGH-2345-6789');
});

test('malformed codes are rejected: wrong length or forbidden characters', () => {
  assert.equal(isWellFormedRecoveryCode('ABCDEFGH23456789'), true);
  assert.equal(isWellFormedRecoveryCode('ABCDEFGH2345678'), false);
  assert.equal(isWellFormedRecoveryCode('ABCDEFGH234567890'), false);
  assert.equal(isWellFormedRecoveryCode('ABCDEFGH2345678O'), false);
  assert.equal(isWellFormedRecoveryCode('ABCDEFGH23456780'), false);
  assert.equal(isWellFormedRecoveryCode('ABCDEFGH2345678L'), false);
  assert.equal(isWellFormedRecoveryCode(''), false);
});

test('the share message carries the store, the code and the safety warning', () => {
  const message = recoveryShareMessage('Tienda Doña Rosa', 'ABCD-EFGH-2345-6789');
  assert.match(message, /Tienda Doña Rosa/);
  assert.match(message, /ABCD-EFGH-2345-6789/);
  assert.match(message, /lugar seguro/);
  assert.match(message, /cambiar el PIN del propietario/);
});
