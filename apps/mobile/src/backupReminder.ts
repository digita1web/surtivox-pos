const DAY_MS = 24 * 60 * 60 * 1000;

export interface BackupReminderInput {
  now: number;
  lastBackupAt: number | null;
  salesSinceBackup: number;
  totalSales: number;
  snoozedUntil: number | null;
}

export function shouldRemindBackup(input: BackupReminderInput): boolean {
  const { now, lastBackupAt, salesSinceBackup, totalSales, snoozedUntil } = input;
  if (totalSales <= 0) return false;
  if (snoozedUntil !== null && now <= snoozedUntil) return false;
  if (lastBackupAt !== null && now < lastBackupAt) return false;
  if (lastBackupAt === null) return totalSales >= 10;
  if (salesSinceBackup >= 50) return true;
  return now - lastBackupAt >= 7 * DAY_MS && salesSinceBackup >= 1;
}

export function backupReminderText(lastBackupAt: number | null, now: number): string {
  if (lastBackupAt === null) return 'Aún no has generado una copia de tus datos.';
  const days = Math.max(0, Math.floor((now - lastBackupAt) / DAY_MS));
  return days === 1
    ? 'Hace 1 día no generas una copia de tus datos.'
    : `Hace ${days} días no generas una copia de tus datos.`;
}

export function backupSnoozeUntil(now: number): number {
  return now + 2 * DAY_MS;
}
