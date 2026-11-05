import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { KIT_WORDS } from '../src/recoveryWords.ts';
import {
  entropyToWords, wordsToEntropy, parseKitText, normalizeKitInput, deriveShopToken, hashShopToken,
  generateKitEntropy, pickConfirmationPositions, confirmationMatches, toHex, type Sha256,
} from '../src/recoveryKit.ts';

const sha256: Sha256 = async (data) => new Uint8Array(createHash('sha256').update(data).digest());

const phonetic = (word: string) => word
  .replace(/qu/g, 'k').replace(/ce/g, 'se').replace(/ci/g, 'si').replace(/c/g, 'k').replace(/z/g, 's')
  .replace(/v/g, 'b').replace(/ll/g, 'y').replace(/h/g, '').replace(/w/g, 'b')
  .replace(/g(?=[ei])/g, 'j').replace(/gu/g, 'g');

const FORBIDDEN = [
  'puta', 'puto', 'mierda', 'culo', 'pene', 'sexo', 'coño', 'cono', 'verga', 'pija', 'chimba', 'gonorrea', 'marica',
  'maricon', 'zorra', 'perra', 'idiota', 'estupido', 'imbecil', 'negro', 'racismo', 'nazi', 'droga', 'cocaina',
  'matar', 'muerte', 'suicidio', 'violar', 'violacion', 'sida', 'cancer',
];

test('la lista tiene 2048 palabras unicas, solo a-z, de 4 a 8 letras', () => {
  assert.equal(KIT_WORDS.length, 2048);
  assert.equal(new Set(KIT_WORDS).size, 2048);
  for (const word of KIT_WORDS) {
    assert.match(word, /^[a-z]{4,8}$/, word);
  }
});

test('las primeras 4 letras son unicas entre todas las palabras', () => {
  const prefixes = new Set(KIT_WORDS.map((word) => word.slice(0, 4)));
  assert.equal(prefixes.size, 2048);
});

test('no hay homofonos obvios entre las palabras', () => {
  const sounds = new Set(KIT_WORDS.map(phonetic));
  assert.equal(sounds.size, 2048);
});

test('la lista no contiene palabras de la lista de exclusion', () => {
  for (const word of FORBIDDEN) assert.ok(!KIT_WORDS.includes(word), word);
});

test('ida y vuelta con 1000 llaves aleatorias', async () => {
  for (let i = 0; i < 1000; i++) {
    const entropy = generateKitEntropy((n) => new Uint8Array(randomBytes(n)));
    const words = await entropyToWords(entropy, sha256);
    assert.equal(words.length, 8);
    const parsed = await wordsToEntropy(words, sha256);
    assert.ok(parsed.ok);
    if (parsed.ok) assert.deepEqual(Array.from(parsed.entropy), Array.from(entropy));
  }
});

test('vectores fijos: entropia, palabras, token y huella', async () => {
  const entropy = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const words = await entropyToWords(entropy, sha256);
  const token = await deriveShopToken(entropy, sha256);
  const hash = await hashShopToken(token, sha256);
  assert.deepEqual(words, ['abad', 'alma', 'impulso', 'alma', 'elogio', 'afilar', 'bracero', 'bruma']);
  assert.equal(token, '7e32ee3494a1afa74edeff99e28133fb9e6c678f3e7093cef2064fded379ef19');
  assert.equal(hash, '330475c1cf192581c70802b67352e0c2b08393de04ce64e10b243d685766a0f2');
});

test('tasa de deteccion al cambiar exactamente una palabra', async () => {
  let detected = 0;
  const total = 10_000;
  for (let i = 0; i < total; i++) {
    const entropy = new Uint8Array(randomBytes(10));
    const words = await entropyToWords(entropy, sha256);
    const position = Math.floor(Math.random() * 8);
    let replacement = KIT_WORDS[Math.floor(Math.random() * 2048)]!;
    while (replacement === words[position]) replacement = KIT_WORDS[Math.floor(Math.random() * 2048)]!;
    const mutated = words.slice();
    mutated[position] = replacement;
    const parsed = await wordsToEntropy(mutated, sha256);
    if (!parsed.ok) detected++;
  }
  const rate = detected / total;
  console.log(`deteccion de una palabra cambiada: ${detected}/${total} = ${(rate * 100).toFixed(2)} %`);
  assert.ok(rate > 0.99, `tasa ${rate}`);
});

test('normaliza tildes, mayusculas, espacios dobles, comas y saltos de linea', () => {
  assert.deepEqual(normalizeKitInput('  Árbol,  CÁMARA\n\nluna\tsol; mar'), ['arbol', 'camara', 'luna', 'sol', 'mar']);
  assert.deepEqual(normalizeKitInput('1. abad 2. abeja'), ['abad', 'abeja']);
});

test('rechaza palabras fuera de la lista con su posicion', async () => {
  const entropy = new Uint8Array(randomBytes(10));
  const words = await entropyToWords(entropy, sha256);
  words[2] = 'zzzzzz';
  const parsed = await wordsToEntropy(words, sha256);
  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.reason, 'unknown_word');
    assert.equal(parsed.position, 3);
    assert.match(parsed.message, /palabra 3/);
  }
});

test('rechaza menos o mas de 8 palabras', async () => {
  const words = await entropyToWords(new Uint8Array(randomBytes(10)), sha256);
  const few = await wordsToEntropy(words.slice(0, 7), sha256);
  const many = await wordsToEntropy([...words, 'abad'], sha256);
  assert.ok(!few.ok && few.reason === 'count');
  assert.ok(!many.ok && many.reason === 'count');
});

test('parseKitText acepta el kit pegado de una vez', async () => {
  const entropy = new Uint8Array(randomBytes(10));
  const words = await entropyToWords(entropy, sha256);
  const pasted = words.map((word, i) => `${i + 1}. ${word.toUpperCase()}`).join('\n');
  const parsed = await parseKitText(pasted, sha256);
  assert.ok(parsed.ok);
});

test('el orden importa: dos palabras intercambiadas fallan casi siempre', async () => {
  let accepted = 0;
  for (let i = 0; i < 2000; i++) {
    const words = await entropyToWords(new Uint8Array(randomBytes(10)), sha256);
    [words[0], words[1]] = [words[1]!, words[0]!];
    if ((await wordsToEntropy(words, sha256)).ok) accepted++;
  }
  assert.ok(accepted < 40, `${accepted} aceptados de 2000`);
});

test('el token y la huella son hexadecimal de 64 caracteres y distintos', async () => {
  const entropy = new Uint8Array(randomBytes(10));
  const token = await deriveShopToken(entropy, sha256);
  const hash = await hashShopToken(token, sha256);
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.notEqual(token, hash);
  assert.equal(toHex(Uint8Array.from([0, 255, 16])), '00ff10');
});

test('las posiciones de confirmacion son dos distintas y ordenadas', () => {
  for (let i = 0; i < 500; i++) {
    const [a, b] = pickConfirmationPositions((max) => Math.floor(Math.random() * max));
    assert.ok(a >= 0 && b <= 7 && a < b);
  }
});

test('la confirmacion tolera tildes y mayusculas pero no palabras equivocadas', () => {
  const words = ['abad', 'abeja', 'abeto', 'abismo', 'abrigo', 'abuelo', 'acacia', 'aceite'];
  assert.ok(confirmationMatches(words, [1, 4], [' ABEJA ', 'Abrígo']));
  assert.ok(!confirmationMatches(words, [1, 4], ['abeja', 'abuelo']));
  assert.ok(!confirmationMatches(words, [1, 4], ['abeja', '']));
  assert.ok(!confirmationMatches(words, [1, 4], ['abeja abrigo', 'abrigo']));
});
