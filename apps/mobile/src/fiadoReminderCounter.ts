export function parseReminderCount(raw: string | null): number {
  if (!raw) return 0;
  try {
    const value = (JSON.parse(raw) as { remindersSent?: unknown }).remindersSent;
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

export function serializeReminderCount(count: number): string {
  return JSON.stringify({ remindersSent: Math.max(0, Math.floor(count)) });
}
