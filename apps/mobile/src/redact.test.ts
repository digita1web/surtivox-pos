import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { entropyToWords, deriveShopToken } from '@surtivox/pos-core';
import { redactSecrets } from './redact.ts';
import { truncateErrorMessage, formatLastError } from './diagnostics.ts';

const sha256 = async (data: Uint8Array) => new Uint8Array(createHash('sha256').update(data).digest());

test('oculta la llave del servidor, el encabezado y el codigo heredado', async () => {
  const token = await deriveShopToken(new Uint8Array(randomBytes(10)), sha256);
  const out = redactSecrets(`fallo con Bearer ${token} y ${token} codigo ABCD-EFGH-JKLM-NPQR`);
  assert.ok(!out.includes(token));
  assert.ok(!out.includes('ABCD-EFGH'));
  assert.match(out, /Bearer \[redactado\]/);
});

test('oculta un kit de 8 palabras en cualquier formato', async () => {
  const words = await entropyToWords(new Uint8Array(randomBytes(10)), sha256);
  const formats = [words.join(' '), words.join(', '), words.map((w, i) => `${i + 1}. ${w}`).join('\n'), words.map((w) => w.toUpperCase()).join('-')];
  for (const text of formats) {
    const out = redactSecrets(`Error al validar: ${text}. Reintenta.`);
    assert.match(out, /^Error al validar: (1\. )?\[kit redactado\]\. Reintenta\.$/);
  }
});

test('no toca texto normal ni una o dos palabras sueltas de la lista', () => {
  assert.equal(redactSecrets('Error de sincronización (500)'), 'Error de sincronización (500)');
  assert.equal(redactSecrets('La luna es bonita'), 'La luna es bonita');
});

test('el truncado de errores y el ultimo error ya salen redactados', async () => {
  const words = await entropyToWords(new Uint8Array(randomBytes(10)), sha256);
  const token = await deriveShopToken(new Uint8Array(randomBytes(10)), sha256);
  const message = truncateErrorMessage(new Error(`token ${token} kit ${words.join(' ')}`));
  assert.ok(!message.includes(token));
  assert.ok(!words.some((w) => message.includes(` ${w} `)));
  const stored = JSON.stringify({ at: 1, message: `viejo ${token}` });
  assert.ok(!formatLastError(stored).includes(token));
});
