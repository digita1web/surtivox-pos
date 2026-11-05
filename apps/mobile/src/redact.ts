import { KIT_WORDS, normalizeKitInput } from '@surtivox/pos-core';

const WORDS: ReadonlySet<string> = new Set(KIT_WORDS);
const HEX_RUN = /\b[0-9a-fA-F]{32,}\b/g;
const BEARER = /Bearer\s+\S+/gi;
const LEGACY_CODE = /\b(?:[A-Z2-9]{4}-){3}[A-Z2-9]{4}\b/g;
const LETTERS = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g;
const MIN_RUN = 3;
const MAX_GAP = 8;

function redactKitRuns(text: string): string {
  const spans: { start: number; end: number; hit: boolean }[] = [];
  for (const match of text.matchAll(LETTERS)) {
    const token = normalizeKitInput(match[0])[0] ?? '';
    spans.push({ start: match.index!, end: match.index! + match[0].length, hit: WORDS.has(token) && normalizeKitInput(match[0]).length === 1 });
  }
  let out = '';
  let cursor = 0;
  let i = 0;
  while (i < spans.length) {
    if (!spans[i]!.hit) { i++; continue; }
    let j = i;
    while (j + 1 < spans.length && spans[j + 1]!.hit && spans[j + 1]!.start - spans[j]!.end <= MAX_GAP) j++;
    if (j - i + 1 >= MIN_RUN) {
      out += text.slice(cursor, spans[i]!.start) + '[kit redactado]';
      cursor = spans[j]!.end;
    }
    i = j + 1;
  }
  return out + text.slice(cursor);
}

export function redactSecrets(text: string): string {
  return redactKitRuns(
    text
      .replace(BEARER, 'Bearer [redactado]')
      .replace(HEX_RUN, '[llave redactada]')
      .replace(LEGACY_CODE, '[código redactado]'),
  );
}
