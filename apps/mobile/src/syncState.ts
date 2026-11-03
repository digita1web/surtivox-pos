import type { SQLiteDatabase } from 'expo-sqlite';

export function reusableToken(saved: string | null, generate: () => string): string {
  return saved && saved.trim() ? saved : generate();
}

export async function disconnectOn(db: Pick<SQLiteDatabase, 'runAsync'>): Promise<void> {
  await db.runAsync(
    'UPDATE sync_state SET server_url = NULL, last_pushed_at = 0, last_pulled_at = 0, last_synced_at = NULL WHERE id = 1',
  );
}
