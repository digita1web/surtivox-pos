export const CLOUD_SYNC_AMOUNT_CENTS = 2_000_000;
export const CLOUD_SYNC_CURRENCY = 'COP';
export const CLOUD_SYNC_DAYS = 30;

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function integritySignature(
  reference: string,
  amountCents: number,
  currency: string,
  secret: string,
): Promise<string> {
  return sha256Hex(`${reference}${amountCents}${currency}${secret}`);
}

export function createReference(now: number, random: string): string {
  return `SVX-${now}-${random.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}`;
}

export function checkoutUrl(
  publicKey: string,
  reference: string,
  amountCents: number,
  currency: string,
  signature: string,
): string {
  const url = new URL('https://checkout.wompi.co/p/');
  url.searchParams.set('public-key', publicKey);
  url.searchParams.set('currency', currency);
  url.searchParams.set('amount-in-cents', String(amountCents));
  url.searchParams.set('reference', reference);
  url.searchParams.set('signature:integrity', signature);
  return url.toString();
}
