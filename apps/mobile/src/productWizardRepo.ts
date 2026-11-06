import type { SQLiteDatabase } from 'expo-sqlite';

export type ExamplesDb = Pick<SQLiteDatabase, 'getAllAsync'>;

export const EXAMPLES_PER_CATEGORY = 2;

export async function categoryExamplesOn(db: ExamplesDb, storeId: string): Promise<Record<string, string[]>> {
  const rows = await db.getAllAsync<{ category_id: string; name: string }>(
    `SELECT category_id, name FROM products
     WHERE store_id = ? AND category_id IS NOT NULL AND active = 1 AND deleted_at IS NULL
     ORDER BY updated_at DESC LIMIT 300`,
    [storeId],
  );
  const out: Record<string, string[]> = {};
  for (const row of rows) {
    const list = out[row.category_id] ?? (out[row.category_id] = []);
    if (list.length < EXAMPLES_PER_CATEGORY && !list.includes(row.name)) list.push(row.name);
  }
  return out;
}
