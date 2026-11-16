import type { PackHit } from './catalogPack.ts';

export type PackCategory = { kind: 'existing'; id: string } | { kind: 'new'; name: string } | { kind: 'none' };

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]+/g, '').toLowerCase().trim();

export function resolvePackCategory(name: string | null, categories: readonly { id: string; name: string }[]): PackCategory {
  if (!name) return { kind: 'none' };
  const match = categories.find((c) => fold(c.name) === fold(name));
  return match ? { kind: 'existing', id: match.id } : { kind: 'new', name };
}

export function packHitSubtitle(hit: Pick<PackHit, 'brand' | 'categoryName' | 'name'>): string {
  const parts: string[] = [];
  if (hit.brand && !fold(hit.name).includes(fold(hit.brand))) parts.push(hit.brand);
  if (hit.categoryName) parts.push(hit.categoryName);
  return parts.join(' · ');
}
