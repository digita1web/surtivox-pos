export type Appearance = 'light' | 'dark' | 'system';
export type Scheme = 'light' | 'dark';
export type StatusBarTone = 'light' | 'dark' | 'auto';

export const APP_APPEARANCE: Appearance = 'light';

export function resolveScheme(appearance: Appearance, system: Scheme | null | undefined): Scheme {
  if (appearance === 'system') return system === 'dark' ? 'dark' : 'light';
  return appearance;
}

export function statusBarToneFor(appearance: Appearance): StatusBarTone {
  if (appearance === 'system') return 'auto';
  return appearance === 'light' ? 'dark' : 'light';
}

export function systemSchemeOverride(appearance: Appearance): Scheme | 'unspecified' {
  return appearance === 'system' ? 'unspecified' : appearance;
}
