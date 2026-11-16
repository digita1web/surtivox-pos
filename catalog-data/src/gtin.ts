const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

export function gtinCheckDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const digit = body.charCodeAt(body.length - 1 - i) - 48;
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code) || !GTIN_LENGTHS.has(code.length)) return false;
  if (/^0+$/.test(code)) return false;
  return gtinCheckDigit(code.slice(0, -1)) === code.charCodeAt(code.length - 1) - 48;
}
