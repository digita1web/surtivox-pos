import type { Capability } from './roles.ts';

const RULES: readonly (readonly [RegExp, Capability])[] = [
  [/^\/(staff|add-staff)(\/|$)/, 'staff'],
  [/^\/(reports|reorder)(\/|$)/, 'reports'],
  [/^\/(purchases|new-purchase)(\/|$)/, 'purchases'],
  [/^\/(suppliers|add-supplier)(\/|$)/, 'suppliers'],
  [/^\/(customers|customer)(\/|$)/, 'customers'],
  [/^\/data(\/|$)/, 'backup'],
  [/^\/(store-settings|business-settings|new-shop)(\/|$)/, 'shop'],
  [/^\/(cloud-sync|paywall)(\/|$)/, 'sync'],
  [/^\/add-product(\/|$)/, 'products'],
];

export function capabilityForPath(pathname: string): Capability | null {
  const path = pathname.split('?')[0]!.replace(/\/+$/, '') || '/';
  for (const [pattern, capability] of RULES) if (pattern.test(path)) return capability;
  return null;
}
