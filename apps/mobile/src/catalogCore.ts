export const CATALOG_FOUND_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const CATALOG_NOT_FOUND_TTL_MS = 3 * 24 * 60 * 60 * 1000;
export const CATALOG_MAX_PER_DAY = 200;

export function catalogCacheTtl(status: 'found' | 'not_found'): number {
  return status === 'found' ? CATALOG_FOUND_TTL_MS : CATALOG_NOT_FOUND_TTL_MS;
}

export function isCatalogCacheFresh(
  checkedAt: number,
  status: 'found' | 'not_found',
  now = Date.now(),
): boolean {
  return checkedAt > 0 && now - checkedAt < catalogCacheTtl(status);
}

export function catalogBackoffMs(attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.min(5 * 60_000, 1_000 * 2 ** Math.min(attempts, 8));
}

export function canAttemptCatalog(createdAt: number, attempts: number, now = Date.now()): boolean {
  return now - createdAt >= catalogBackoffMs(attempts);
}

export function isCatalogEnabled(url: string): boolean {
  return url.trim().length > 0;
}

export function isCatalogEan(value: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(value)) return false;
  if (/^2\d{11,12}$/.test(value)) return false;
  const digits = value.split('').map(Number);
  const check = digits.pop()!;
  let sum = 0;
  let weight = 3;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    sum += digits[i]! * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10 === check;
}

export function isCatalogUuid(value: string | null): value is string {
  return value !== null && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isCatalogName(name: string): boolean {
  const value = name.trim().replace(/\s+/g, ' ');
  return value.length >= 3
    && value.length <= 60
    && /\p{L}/u.test(value)
    && !/[\u0000-\u001f\u007f]/u.test(value)
    && !/https?:\/\/|www\.|@/i.test(value);
}

export function isGenericCatalogName(name: string): boolean {
  return /^producto\s+[a-z0-9-]{1,16}$/i.test(name.trim());
}
