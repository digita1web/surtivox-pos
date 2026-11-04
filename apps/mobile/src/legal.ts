import type { SQLiteDatabase } from 'expo-sqlite';

export const LEGAL_VERSION = '2026-11-05';

export type GateStep = 'terms' | 'catalog';
export type LegalDb = Pick<SQLiteDatabase, 'getFirstAsync' | 'runAsync'>;

export const LEGAL_KEYS = {
  version: 'legal_accepted_version',
  at: 'legal_accepted_at',
  catalog: 'catalog_opt_in',
} as const;

export function needsAcceptance(storedVersion: string | null): boolean {
  return storedVersion !== LEGAL_VERSION;
}

export function gateSteps(input: { storedVersion: string | null; catalogChoice: string | null; catalogConfigured: boolean }): GateStep[] {
  if (!needsAcceptance(input.storedVersion)) return [];
  const steps: GateStep[] = ['terms'];
  if (input.catalogChoice === null && input.catalogConfigured) steps.push('catalog');
  return steps;
}

async function readSetting(db: LegalDb, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM local_settings WHERE key=?', [key]);
  return row?.value ?? null;
}

async function writeSetting(db: LegalDb, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO local_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    [key, value],
  );
}

export async function loadGateSteps(db: LegalDb, catalogConfigured: boolean): Promise<GateStep[]> {
  const [storedVersion, catalogChoice] = await Promise.all([
    readSetting(db, LEGAL_KEYS.version),
    readSetting(db, LEGAL_KEYS.catalog),
  ]);
  return gateSteps({ storedVersion, catalogChoice, catalogConfigured });
}

export async function recordAcceptance(db: LegalDb, now: number): Promise<void> {
  await writeSetting(db, LEGAL_KEYS.at, String(now));
  await writeSetting(db, LEGAL_KEYS.version, LEGAL_VERSION);
}

export async function recordCatalogChoice(db: LegalDb, optIn: boolean): Promise<void> {
  await writeSetting(db, LEGAL_KEYS.catalog, optIn ? '1' : '0');
}
