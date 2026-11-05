import { KIT_WORDS } from './recoveryWords.ts';

export type Sha256 = (data: Uint8Array) => Promise<Uint8Array>;

export const KIT_WORD_COUNT = 8;
export const KIT_ENTROPY_BYTES = 10;

const CHECKSUM_DOMAIN = 'surtivox-kit-v1';
const TOKEN_DOMAIN = 'surtivox-shop-v2';
const WORD_BITS = 11;

const WORD_INDEX: ReadonlyMap<string, number> = new Map(KIT_WORDS.map((word, index) => [word, index]));

export type KitParseResult =
  | { ok: true; entropy: Uint8Array }
  | { ok: false; reason: 'count' | 'unknown_word' | 'checksum'; position?: number; message: string };

function asciiBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0x7f;
  return out;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

async function checksumByte(entropy: Uint8Array, sha256: Sha256): Promise<number> {
  const digest = await sha256(concat(asciiBytes(CHECKSUM_DOMAIN), entropy));
  return digest[0]!;
}

export function generateKitEntropy(getRandomBytes: (length: number) => Uint8Array): Uint8Array {
  const bytes = getRandomBytes(KIT_ENTROPY_BYTES);
  if (bytes.length !== KIT_ENTROPY_BYTES) throw new Error('La fuente aleatoria devolvió una longitud inesperada.');
  return Uint8Array.from(bytes);
}

export async function entropyToWords(entropy: Uint8Array, sha256: Sha256): Promise<string[]> {
  if (entropy.length !== KIT_ENTROPY_BYTES) throw new Error('La entropía del kit debe tener 10 bytes.');
  const all = new Uint8Array(KIT_ENTROPY_BYTES + 1);
  all.set(entropy, 0);
  all[KIT_ENTROPY_BYTES] = await checksumByte(entropy, sha256);
  const words: string[] = [];
  for (let w = 0; w < KIT_WORD_COUNT; w++) {
    let index = 0;
    for (let b = 0; b < WORD_BITS; b++) {
      const bit = w * WORD_BITS + b;
      index = (index << 1) | ((all[bit >> 3]! >> (7 - (bit & 7))) & 1);
    }
    words.push(KIT_WORDS[index]!);
  }
  return words;
}

export function normalizeKitInput(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length > 0);
}

export async function wordsToEntropy(words: readonly string[], sha256: Sha256): Promise<KitParseResult> {
  if (words.length !== KIT_WORD_COUNT) {
    return { ok: false, reason: 'count', message: `El kit tiene ${KIT_WORD_COUNT} palabras y escribiste ${words.length}.` };
  }
  const all = new Uint8Array(KIT_ENTROPY_BYTES + 1);
  for (let w = 0; w < KIT_WORD_COUNT; w++) {
    const index = WORD_INDEX.get(words[w]!);
    if (index === undefined) {
      return { ok: false, reason: 'unknown_word', position: w + 1, message: `La palabra ${w + 1} no existe en la lista del kit.` };
    }
    for (let b = 0; b < WORD_BITS; b++) {
      const bit = w * WORD_BITS + b;
      const value = (index >> (WORD_BITS - 1 - b)) & 1;
      all[bit >> 3] = all[bit >> 3]! | (value << (7 - (bit & 7)));
    }
  }
  const entropy = all.slice(0, KIT_ENTROPY_BYTES);
  if ((await checksumByte(entropy, sha256)) !== all[KIT_ENTROPY_BYTES]) {
    return { ok: false, reason: 'checksum', message: 'El kit no es válido. Revisa las palabras y su orden.' };
  }
  return { ok: true, entropy };
}

export async function parseKitText(text: string, sha256: Sha256): Promise<KitParseResult> {
  return wordsToEntropy(normalizeKitInput(text), sha256);
}

export async function deriveShopToken(entropy: Uint8Array, sha256: Sha256): Promise<string> {
  return toHex(await sha256(concat(asciiBytes(TOKEN_DOMAIN), entropy)));
}

export async function hashShopToken(token: string, sha256: Sha256): Promise<string> {
  return toHex(await sha256(asciiBytes(token)));
}

export function pickConfirmationPositions(randomInt: (maxExclusive: number) => number): [number, number] {
  const first = randomInt(KIT_WORD_COUNT);
  let second = randomInt(KIT_WORD_COUNT - 1);
  if (second >= first) second += 1;
  return first < second ? [first, second] : [second, first];
}

export function confirmationMatches(
  words: readonly string[],
  positions: readonly number[],
  typed: readonly string[],
): boolean {
  if (positions.length !== typed.length) return false;
  return positions.every((position, i) => {
    const expected = words[position];
    const got = normalizeKitInput(typed[i] ?? '');
    return expected !== undefined && got.length === 1 && got[0] === expected;
  });
}

export function formatKitForSharing(words: readonly string[]): string {
  return words.map((word, i) => `${i + 1}. ${word}`).join('\n');
}
