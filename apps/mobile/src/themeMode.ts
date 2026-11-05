export type Appearance = 'light' | 'dark' | 'system' | 'auto';
export type Scheme = 'light' | 'dark';
export type StatusBarTone = 'light' | 'dark';

export interface NightSchedule {
  from: number;
  until: number;
}

export const DEFAULT_APPEARANCE: Appearance = 'light';
export const DEFAULT_SCHEDULE: NightSchedule = { from: 19, until: 6 };
export const FROM_OPTIONS = [17, 18, 19, 20, 21, 22] as const;
export const UNTIL_OPTIONS = [4, 5, 6, 7, 8] as const;

export const APPEARANCE_OPTIONS: readonly { key: Appearance; label: string; hint: string }[] = [
  { key: 'light', label: 'Claro', hint: 'Siempre claro' },
  { key: 'dark', label: 'Oscuro', hint: 'Siempre oscuro' },
  { key: 'auto', label: 'Automático por hora', hint: 'Oscuro de noche y claro de día' },
  { key: 'system', label: 'Igual que el teléfono', hint: 'Sigue el modo oscuro del sistema' },
];

export function isNight(now: Date, schedule: NightSchedule): boolean {
  const hour = now.getHours() + now.getMinutes() / 60;
  if (schedule.from === schedule.until) return false;
  if (schedule.from < schedule.until) return hour >= schedule.from && hour < schedule.until;
  return hour >= schedule.from || hour < schedule.until;
}

export function resolveScheme(
  appearance: Appearance,
  system: Scheme | null | undefined,
  now: Date,
  schedule: NightSchedule,
): Scheme {
  if (appearance === 'system') return system === 'dark' ? 'dark' : 'light';
  if (appearance === 'auto') return isNight(now, schedule) ? 'dark' : 'light';
  return appearance;
}

export function statusBarToneFor(scheme: Scheme): StatusBarTone {
  return scheme === 'light' ? 'dark' : 'light';
}

export function parseAppearance(raw: string | null | undefined): Appearance {
  return raw === 'light' || raw === 'dark' || raw === 'system' || raw === 'auto' ? raw : DEFAULT_APPEARANCE;
}

export function parseHour(raw: string | null | undefined, allowed: readonly number[], fallback: number): number {
  if (raw === null || raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && allowed.includes(value) ? value : fallback;
}

export function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'a. m.' : 'p. m.';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:00 ${suffix}`;
}

export function scheduleSummary(schedule: NightSchedule): string {
  return `Oscuro de ${formatHour(schedule.from)} a ${formatHour(schedule.until)}`;
}

export function oppositeMode(current: Scheme): Appearance {
  return current === 'dark' ? 'light' : 'dark';
}
