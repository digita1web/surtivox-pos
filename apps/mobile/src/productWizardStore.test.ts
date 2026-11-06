import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '@surtivox/database';
import {
  discardDraftOn, loadDraftOn, purgeStaleDraftsOn, saveDraftOn, type DraftDb, type DraftDeps,
} from './productWizardStore.ts';
import { DRAFT_MAX_AGE_MS, draftKey, newDraft, serializeDraft, type WizardDraft } from './productWizard.ts';

type Param = string | number | null;

const NOW = 1_800_000_000_000;
const A = '7701234567897';
const B = '7709990000003';

function setup(files: Set<string> = new Set()) {
  const raw = new DatabaseSync(':memory:');
  for (const migration of MIGRATIONS) raw.exec(migration.sql);
  const db = {
    getFirstAsync: async (sql: string, params: readonly Param[] = []) => raw.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql: string, params: readonly Param[] = []) => raw.prepare(sql).all(...params),
    runAsync: async (sql: string, params: readonly Param[] = []) => {
      const result = raw.prepare(sql).run(...params);
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
  } as unknown as DraftDb;
  let clock = NOW;
  const deps: DraftDeps = { now: () => clock, fileExists: async (uri) => files.has(uri) };
  return { raw, db, deps, tick: (ms: number) => { clock += ms; } };
}

const draft = (barcode: string, over: Partial<WizardDraft> = {}): WizardDraft => ({
  ...newDraft(barcode, NOW), step: 'details', name: 'Arroz', ...over,
});

const count = (raw: DatabaseSync) => (raw.prepare("SELECT COUNT(*) AS n FROM local_settings WHERE key LIKE 'product_wizard_draft:%'").get() as { n: number }).n;

test('guarda y recupera el borrador tal cual', async () => {
  const { db, deps } = setup(new Set(['file:///a.webp']));
  const saved = draft(A, { photoUri: 'file:///a.webp', categoryId: 'c1', priceText: '2.500' });
  await saveDraftOn(db, saved);
  assert.deepEqual(await loadDraftOn(db, deps, A), saved);
});

test('hay un unico borrador por codigo y guardar de nuevo lo reemplaza', async () => {
  const { db, deps, raw } = setup();
  await saveDraftOn(db, draft(A, { name: 'Arroz' }));
  await saveDraftOn(db, draft(A, { name: 'Arroz Diana' }));
  assert.equal(count(raw), 1);
  assert.equal((await loadDraftOn(db, deps, A))?.name, 'Arroz Diana');
});

test('dos codigos distintos conviven sin mezclarse', async () => {
  const { db, deps, raw } = setup();
  await saveDraftOn(db, draft(A, { name: 'Arroz' }));
  await saveDraftOn(db, draft(B, { name: 'Leche' }));
  assert.equal(count(raw), 2);
  assert.equal((await loadDraftOn(db, deps, A))?.name, 'Arroz');
  assert.equal((await loadDraftOn(db, deps, B))?.name, 'Leche');
  await discardDraftOn(db, A);
  assert.equal(await loadDraftOn(db, deps, A), null);
  assert.equal((await loadDraftOn(db, deps, B))?.name, 'Leche');
});

test('sin borrador devuelve null', async () => {
  const { db, deps } = setup();
  assert.equal(await loadDraftOn(db, deps, A), null);
});

test('un borrador con version desconocida se descarta sin error', async () => {
  const { db, deps, raw } = setup();
  raw.prepare('INSERT INTO local_settings (key,value) VALUES (?,?)').run(draftKey(A), JSON.stringify({ ...draft(A), v: 99 }));
  assert.equal(await loadDraftOn(db, deps, A), null);
  assert.equal(count(raw), 0);
});

test('un borrador roto o de otro codigo se descarta', async () => {
  const { db, deps, raw } = setup();
  raw.prepare('INSERT INTO local_settings (key,value) VALUES (?,?)').run(draftKey(A), '{no es json');
  assert.equal(await loadDraftOn(db, deps, A), null);
  raw.prepare('INSERT INTO local_settings (key,value) VALUES (?,?)').run(draftKey(B), serializeDraft(draft(A)));
  assert.equal(await loadDraftOn(db, deps, B), null);
  assert.equal(count(raw), 0);
});

test('un borrador de mas de 7 dias se borra al abrirlo', async () => {
  const { db, deps, raw, tick } = setup();
  await saveDraftOn(db, draft(A));
  tick(DRAFT_MAX_AGE_MS);
  assert.ok(await loadDraftOn(db, deps, A));
  tick(1);
  assert.equal(await loadDraftOn(db, deps, A), null);
  assert.equal(count(raw), 0);
});

test('si la foto del borrador ya no existe se ignora sin error y se conserva lo demas', async () => {
  const { db, deps, raw } = setup(new Set());
  await saveDraftOn(db, draft(A, { photoUri: 'file:///perdida.webp', name: 'Arroz', priceText: '2.500' }));
  const loaded = await loadDraftOn(db, deps, A);
  assert.equal(loaded?.photoUri, null);
  assert.equal(loaded?.name, 'Arroz');
  assert.equal(loaded?.priceText, '2.500');
  const stored = JSON.parse((raw.prepare('SELECT value FROM local_settings WHERE key=?').get(draftKey(A)) as { value: string }).value);
  assert.equal(stored.photoUri, null);
});

test('si comprobar la foto falla tambien se ignora', async () => {
  const { db, deps } = setup();
  const failing: DraftDeps = { ...deps, fileExists: async () => { throw new Error('sin permiso'); } };
  await saveDraftOn(db, draft(A, { photoUri: 'file:///a.webp' }));
  assert.equal((await loadDraftOn(db, failing, A))?.photoUri, null);
});

test('limpia los borradores viejos y rotos pero deja los vigentes y otras claves', async () => {
  const { db, raw } = setup();
  await saveDraftOn(db, { ...draft(A), updatedAt: NOW - DRAFT_MAX_AGE_MS - 1 });
  await saveDraftOn(db, { ...draft(B), updatedAt: NOW });
  raw.prepare('INSERT INTO local_settings (key,value) VALUES (?,?)').run(draftKey('123456789012'), '{roto');
  raw.prepare('INSERT INTO local_settings (key,value) VALUES (?,?)').run('appearance', 'dark');
  assert.equal(await purgeStaleDraftsOn(db, NOW), 2);
  assert.equal(count(raw), 1);
  assert.equal((raw.prepare("SELECT value FROM local_settings WHERE key='appearance'").get() as { value: string }).value, 'dark');
});
