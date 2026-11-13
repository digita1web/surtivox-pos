import type { SQLiteDatabase } from 'expo-sqlite';
import { filterBackupRows, restoreDeleteSql } from './backupFilters.ts';
import { resetSyncCursorsOn } from './syncState.ts';

export type RestoreDb = Pick<SQLiteDatabase, 'execAsync' | 'runAsync' | 'withTransactionAsync'>;

export async function applyBackupOn(
  db: RestoreDb,
  tables: Record<string, Record<string, unknown>[]>,
): Promise<number> {
  const tableNames = Object.keys(tables);
  let rows = 0;
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      for (const table of tableNames) await db.runAsync(restoreDeleteSql(table));
      for (const table of tableNames) {
        for (const row of filterBackupRows(table, tables[table]!)) {
          const columns = Object.keys(row);
          if (columns.length === 0) continue;
          const columnList = columns.map((column) => `"${column}"`).join(',');
          const params = columns.map((column) => row[column] as string | number | null);
          await db.runAsync(`INSERT INTO "${table}" (${columnList}) VALUES (${columns.map(() => '?').join(',')})`, params);
          rows++;
        }
      }
      await resetSyncCursorsOn(db);
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
  return rows;
}
