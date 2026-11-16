const UNIT_FIXES: readonly (readonly [RegExp, string])[] = [
  [/(\d)\s*(?:gr|grs|gramos?)\b\.?/giu, '$1 g'],
  [/(\d)\s*(?:kgs?|kilos?|kilogramos?)\b\.?/giu, '$1 kg'],
  [/(\d)\s*(?:mg|miligramos?)\b\.?/giu, '$1 mg'],
  [/(\d)\s*(?:ml|mls|mililitros?|cc)\b\.?/giu, '$1 ml'],
  [/(\d)\s*(?:lts?|litros?|l)\b\.?/giu, '$1 L'],
  [/(\d)\s*(?:lbs?|libras?)\b\.?/giu, '$1 lb'],
  [/(\d)\s*(?:cms?|centímetros?|centimetros?)\b\.?/giu, '$1 cm'],
  [/(\d)\s*g\b/gu, '$1 g'],
];

export function collapseSpaces(text: string): string {
  return text.normalize('NFC').replace(/[\s ]+/gu, ' ').trim();
}

export function normalizeName(text: string): string {
  let out = collapseSpaces(text);
  for (const [pattern, replacement] of UNIT_FIXES) out = out.replace(pattern, replacement);
  return collapseSpaces(out);
}

export function foldKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function isShouting(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, '');
  if (letters.length < 4) return false;
  return letters === letters.toUpperCase() && letters !== letters.toLowerCase();
}

export function hasControlChars(text: string): boolean {
  return /[\u0000-\u001f\u007f]/u.test(text);
}
