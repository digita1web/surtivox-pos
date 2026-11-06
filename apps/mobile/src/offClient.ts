export interface OffIdentity {
  name: string;
  version: string | null;
  contact: string | null;
}

export function buildOffUserAgent(identity: OffIdentity): string {
  const name = identity.name.replace(/[^A-Za-z0-9._-]/g, '') || 'App';
  const version = identity.version && /^\d+(\.\d+){0,2}$/.test(identity.version.trim()) ? identity.version.trim() : '0.0.0';
  const contact = identity.contact?.trim();
  return contact ? `${name}/${version} (${contact})` : `${name}/${version}`;
}

export const OFF_UA_PATTERN = /^[A-Za-z0-9._-]+\/\d+(\.\d+){0,2} \([^()\s]+@[^()\s]+\)$/;

export interface OffCache<T> {
  get: (code: string) => T | undefined;
  set: (code: string, value: T) => void;
  size: () => number;
}

export function createOffCache<T>(ttlMs: number, now: () => number, maxEntries = 200): OffCache<T> {
  const entries = new Map<string, { value: T; at: number }>();
  return {
    get: (code) => {
      const hit = entries.get(code);
      if (!hit) return undefined;
      if (now() - hit.at > ttlMs) {
        entries.delete(code);
        return undefined;
      }
      return hit.value;
    },
    set: (code, value) => {
      if (entries.size >= maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
      entries.set(code, { value, at: now() });
    },
    size: () => entries.size,
  };
}

const normalizeForCompare = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function sameProductName(a: string, b: string): boolean {
  const left = normalizeForCompare(a);
  return left.length > 0 && left === normalizeForCompare(b);
}
