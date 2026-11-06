import type { SQLiteDatabase } from 'expo-sqlite';
import {
  DRAFT_KEY_PREFIX, draftKey, isDraftStale, parseDraft, serializeDraft, type WizardDraft,
} from './productWizard.ts';

export type DraftDb = Pick<SQLiteDatabase, 'getFirstAsync' | 'getAllAsync' | 'runAsync'>;

export interface DraftDeps {
  now: () => number;
  fileExists: (uri: string) => Promise<boolean>;
}

export async function saveDraftOn(db: DraftDb, draft: WizardDraft): Promise<void> {
  await db.runAsync(
    'INSERT INTO local_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    [draftKey(draft.barcode), serializeDraft(draft)],
  );
}

export async function discardDraftOn(db: DraftDb, barcode: string): Promise<void> {
  await db.runAsync('DELETE FROM local_settings WHERE key=?', [draftKey(barcode)]);
}

export async function loadDraftOn(db: DraftDb, deps: DraftDeps, barcode: string): Promise<WizardDraft | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM local_settings WHERE key=?', [draftKey(barcode)]);
  if (!row) return null;
  const draft = parseDraft(row.value);
  if (!draft || draft.barcode !== barcode.trim() || isDraftStale(draft, deps.now())) {
    await discardDraftOn(db, barcode);
    return null;
  }
  if (draft.photoUri && !(await deps.fileExists(draft.photoUri).catch(() => false))) {
    const repaired = { ...draft, photoUri: null };
    await saveDraftOn(db, repaired);
    return repaired;
  }
  return draft;
}

export async function purgeStaleDraftsOn(db: DraftDb, now: number): Promise<number> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM local_settings WHERE key LIKE ?',
    [`${DRAFT_KEY_PREFIX}%`],
  );
  let removed = 0;
  for (const row of rows) {
    const draft = parseDraft(row.value);
    if (!draft || isDraftStale(draft, now)) {
      await db.runAsync('DELETE FROM local_settings WHERE key=?', [row.key]);
      removed++;
    }
  }
  return removed;
}
