const DAY_MS = 24 * 60 * 60 * 1000;

export const COUNT_REMINDER_KEY = 'stock_count_reminder';
export const COUNT_SNOOZE_KEY = 'stock_count_snooze_until';
export const COUNT_EVERY_DAYS = 7;

export interface CountReminderInput {
  enabled: boolean;
  now: number;
  lastCountAt: number | null;
  trackedProducts: number;
  snoozedUntil: number | null;
}

export function shouldRemindCount(input: CountReminderInput): boolean {
  const { enabled, now, lastCountAt, trackedProducts, snoozedUntil } = input;
  if (!enabled || trackedProducts <= 0) return false;
  if (snoozedUntil !== null && now <= snoozedUntil) return false;
  if (lastCountAt === null) return true;
  if (now < lastCountAt) return false;
  return now - lastCountAt >= COUNT_EVERY_DAYS * DAY_MS;
}

export function countReminderText(lastCountAt: number | null, now: number): string {
  if (lastCountAt === null) return 'Aún no has hecho un conteo de inventario.';
  const days = Math.max(0, Math.floor((now - lastCountAt) / DAY_MS));
  return `Hace ${days} días no cuentas el inventario.`;
}

export function countSnoozeUntil(now: number): number {
  return now + DAY_MS;
}

export function parseSettingNumber(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
