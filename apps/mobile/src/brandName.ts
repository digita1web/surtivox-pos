export const DEFAULT_TAGLINE = 'Tu tienda, siempre contigo';
export const DEFAULT_STORE_NAME = 'Mi tienda';

export function splitBrandName(name: string | null | undefined): { lead: string; accent: string } {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lead: DEFAULT_STORE_NAME, accent: '' };
  if (words.length === 1) return { lead: words[0]!, accent: '' };
  return { lead: words[0]!, accent: words.slice(1).join(' ') };
}

export function brandTagline(tagline: string | null | undefined): string {
  const clean = (tagline ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > 0 ? clean : DEFAULT_TAGLINE;
}
