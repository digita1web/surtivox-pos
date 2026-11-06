import { KIT_KEYS, isKitSettingKey } from './kitOps.ts';
import { DRAFT_KEY_PREFIX } from './productWizard.ts';

export function filterBackupRows(table: string, rows: Record<string, unknown>[]): Record<string, unknown>[] {
  if (table !== 'local_settings') return rows;
  return rows.filter((row) => typeof row.key !== 'string' || (!isKitSettingKey(row.key) && !row.key.startsWith(DRAFT_KEY_PREFIX)));
}

export function restoreDeleteSql(table: string): string {
  if (table !== 'local_settings') return `DELETE FROM "${table}"`;
  const keys = Object.values(KIT_KEYS).map((key) => `'${key}'`).join(',');
  return `DELETE FROM "local_settings" WHERE key NOT IN (${keys}) AND key NOT LIKE '${DRAFT_KEY_PREFIX}%'`;
}
