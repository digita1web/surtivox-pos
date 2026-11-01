export interface CatalogItemInput {
  code?: unknown;
  name?: unknown;
  presentation?: unknown;
}

export interface ValidCatalogItem {
  code: string;
  name: string;
  nameNorm: string;
  presentation: string | null;
}

export interface CatalogVote {
  nameNorm: string;
  nameDisplay: string;
  presentation: string | null;
  contributorHash: string;
  createdAt: number;
}

export interface CatalogWinner {
  name: string;
  presentation: string | null;
  contributors: number;
}

export function isScaleCode(value: string): boolean {
  return /^2\d{11,12}$/.test(value);
}

export function isValidEan(value: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(value)) return false;
  if (isScaleCode(value)) return false;
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

export function normalizeName(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function isValidInstallId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function parseMinContributors(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100) return 3;
  return parsed;
}

export function validateItem(input: CatalogItemInput): ValidCatalogItem | null {
  if (typeof input.code !== 'string' || !isValidEan(input.code.trim())) return null;
  if (typeof input.name !== 'string') return null;
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 60) return null;
  if (!/\p{L}/u.test(name)) return null;
  if (/[\u0000-\u001f\u007f]/.test(name)) return null;
  if (/https?:\/\/|www\.|@/i.test(name)) return null;
  let presentation: string | null = null;
  if (input.presentation !== undefined && input.presentation !== null) {
    if (typeof input.presentation !== 'string') return null;
    presentation = input.presentation.trim().replace(/\s+/g, ' ');
    if (presentation.length > 20) return null;
    if (!presentation) presentation = null;
  }
  return { code: input.code.trim(), name, nameNorm: normalizeName(name), presentation };
}

export function consensusWinner(votes: readonly CatalogVote[], minContributors: number): CatalogWinner | null {
  const groups = new Map<string, CatalogVote[]>();
  for (const vote of votes) {
    const group = groups.get(vote.nameNorm) ?? [];
    group.push(vote);
    groups.set(vote.nameNorm, group);
  }
  let best: CatalogWinner | null = null;
  for (const [nameNorm, group] of groups) {
    const contributors = new Set(group.map((vote) => vote.contributorHash));
    if (contributors.size < minContributors) continue;
    const displays = new Map<string, number>();
    for (const vote of group) displays.set(vote.nameDisplay, (displays.get(vote.nameDisplay) ?? 0) + 1);
    const name = [...displays.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
    const presentations = new Map<string, number>();
    for (const vote of group) {
      if (vote.presentation) presentations.set(vote.presentation, (presentations.get(vote.presentation) ?? 0) + 1);
    }
    const presentation = [...presentations.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
    const candidate = { name, presentation, contributors: contributors.size };
    if (
      !best
      || candidate.contributors > best.contributors
      || (candidate.contributors === best.contributors && candidate.name.localeCompare(best.name) < 0)
    ) {
      best = candidate;
    }
    void nameNorm;
  }
  return best;
}

export function canAcceptVote(input: {
  dailyCount: number;
  maxPerDay: number;
  votedDifferentNameToday: boolean;
}): boolean {
  return input.dailyCount < input.maxPerDay && !input.votedDifferentNameToday;
}
