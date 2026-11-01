const DAY_MS = 24 * 60 * 60 * 1000;

export function limitCutoffDay(now: number, days = 7): string {
  return new Date(now - days * DAY_MS).toISOString().slice(0, 10);
}

export function isExpiredLimitDay(day: string, cutoffDay: string): boolean {
  return day < cutoffDay;
}
