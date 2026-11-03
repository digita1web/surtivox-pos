import type { SQLiteDatabase } from 'expo-sqlite';

export type CollisionDatabase = Pick<SQLiteDatabase, 'getFirstAsync' | 'runAsync'>;

export interface NumberedRow {
  id: string;
  created_at: number;
}

export const NUMBERED_TABLES = [
  { table: 'sales', column: 'invoice_no' },
  { table: 'purchases', column: 'reference_no' },
] as const;

export function incomingLoses(incoming: NumberedRow, existing: NumberedRow): boolean {
  if (incoming.created_at !== existing.created_at) return incoming.created_at > existing.created_at;
  return incoming.id > existing.id;
}

export function disambiguate(number: string, id: string, length = 4): string {
  return `${number}-${id.replace(/[^A-Za-z0-9]/g, '').slice(0, length).toUpperCase()}`;
}

async function freeNumber(
  db: CollisionDatabase,
  table: string,
  column: string,
  storeId: string,
  number: string,
  id: string,
): Promise<string> {
  for (const length of [4, 8, 32]) {
    const candidate = disambiguate(number, id, length);
    const taken = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM "${table}" WHERE store_id=? AND "${column}"=? AND id<>?`,
      [storeId, candidate, id],
    );
    if (!taken) return candidate;
  }
  throw new Error(`No se pudo resolver el número duplicado ${number}`);
}

export async function resolveNumberCollision(
  db: CollisionDatabase,
  table: string,
  column: string,
  row: Record<string, unknown>,
): Promise<void> {
  const id = row.id;
  const storeId = row.store_id;
  const number = row[column];
  if (typeof id !== 'string' || typeof storeId !== 'string' || typeof number !== 'string') return;
  const existing = await db.getFirstAsync<NumberedRow>(
    `SELECT id, created_at FROM "${table}" WHERE store_id=? AND "${column}"=? AND id<>?`,
    [storeId, number, id],
  );
  if (!existing) return;
  const incoming: NumberedRow = { id, created_at: Number(row.created_at) };
  if (incomingLoses(incoming, existing)) {
    row[column] = await freeNumber(db, table, column, storeId, number, id);
    return;
  }
  const renamed = await freeNumber(db, table, column, storeId, number, existing.id);
  await db.runAsync(`UPDATE "${table}" SET "${column}"=? WHERE id=?`, [renamed, existing.id]);
}
