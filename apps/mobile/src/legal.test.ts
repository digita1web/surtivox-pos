import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '@surtivox/database';
import {
  gateSteps, loadGateSteps, needsAcceptance, recordAcceptance, recordCatalogChoice, LEGAL_KEYS, LEGAL_VERSION, type LegalDb,
} from './legal.ts';
import {
  CATALOG_NOTICE, CLOUD_NOTICE, LEGAL_CONTACT, PHOTO_TIP, PRIVACY_SECTIONS, TERMS_SECTIONS,
} from './legalText.ts';

type Param = string | number | null;

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const migration of MIGRATIONS) db.exec(migration.sql);
  return db;
}

function adapter(db: DatabaseSync): LegalDb {
  return {
    getFirstAsync: async (sql: string, params: readonly Param[] = []) => db.prepare(sql).get(...params) ?? null,
    runAsync: async (sql: string, params: readonly Param[] = []) => {
      db.prepare(sql).run(...params);
      return {};
    },
  } as unknown as LegalDb;
}

const setting = (db: DatabaseSync, key: string) =>
  (db.prepare('SELECT value FROM local_settings WHERE key=?').get(key) as { value: string } | undefined)?.value ?? null;

test('acceptance is required until the stored version equals the current one', () => {
  assert.equal(needsAcceptance(null), true);
  assert.equal(needsAcceptance('2020-01-01'), true);
  assert.equal(needsAcceptance(''), true);
  assert.equal(needsAcceptance(LEGAL_VERSION), false);
});

test('gate steps: terms always first, the catalog question only when it was never answered and is configured', () => {
  const base = { storedVersion: null, catalogChoice: null, catalogConfigured: true };
  assert.deepEqual(gateSteps(base), ['terms', 'catalog']);
  assert.deepEqual(gateSteps({ ...base, catalogChoice: '1' }), ['terms']);
  assert.deepEqual(gateSteps({ ...base, catalogChoice: '0' }), ['terms']);
  assert.deepEqual(gateSteps({ ...base, catalogConfigured: false }), ['terms']);
  assert.deepEqual(gateSteps({ ...base, storedVersion: LEGAL_VERSION }), []);
  assert.deepEqual(gateSteps({ ...base, storedVersion: LEGAL_VERSION, catalogChoice: null }), []);
  assert.deepEqual(gateSteps({ ...base, storedVersion: 'vieja' }), ['terms', 'catalog']);
});

test('nothing is stored and the catalog stays unanswered until the shopkeeper acts', async () => {
  const db = freshDb();
  assert.deepEqual(await loadGateSteps(adapter(db), true), ['terms', 'catalog']);
  assert.equal(setting(db, LEGAL_KEYS.catalog), null);
  assert.equal(setting(db, LEGAL_KEYS.version), null);
});

test('accepting stores the version and the time, and stops asking', async () => {
  const db = freshDb();
  const a = adapter(db);
  await recordAcceptance(a, 1760000000000);
  assert.equal(setting(db, LEGAL_KEYS.version), LEGAL_VERSION);
  assert.equal(setting(db, LEGAL_KEYS.at), '1760000000000');
  assert.deepEqual(await loadGateSteps(a, true), []);
});

test('an acceptance that was interrupted before the version was written still asks again', async () => {
  const db = freshDb();
  db.prepare('INSERT INTO local_settings (key,value) VALUES (?,?)').run(LEGAL_KEYS.at, '1');
  assert.deepEqual(await loadGateSteps(adapter(db), false), ['terms']);
});

test('the catalog answer is stored as 1 or 0 and is never defaulted to yes', async () => {
  const yes = freshDb();
  await recordCatalogChoice(adapter(yes), true);
  assert.equal(setting(yes, LEGAL_KEYS.catalog), '1');
  const no = freshDb();
  await recordCatalogChoice(adapter(no), false);
  assert.equal(setting(no, LEGAL_KEYS.catalog), '0');
  const skipped = freshDb();
  await recordAcceptance(adapter(skipped), 1);
  assert.equal(setting(skipped, LEGAL_KEYS.catalog), null);
});

test('a new legal version asks again but keeps an earlier catalog answer', async () => {
  const db = freshDb();
  const a = adapter(db);
  db.prepare('INSERT INTO local_settings (key,value) VALUES (?,?)').run(LEGAL_KEYS.version, '2020-01-01');
  await recordCatalogChoice(a, false);
  assert.deepEqual(await loadGateSteps(a, true), ['terms']);
});

const everySection = [...TERMS_SECTIONS, ...PRIVACY_SECTIONS];
const catalogText = [CATALOG_NOTICE.title, ...CATALOG_NOTICE.body, CATALOG_NOTICE.rights].join('\n');

test('no consent text calls the contribution anonymous', () => {
  const all = [catalogText, CLOUD_NOTICE.body, ...everySection.map((s) => s.body)].join('\n');
  assert.doesNotMatch(all, /(?<!no )\ban[oó]nim[oa]s?\b/i);
  assert.match('de forma anónima', /(?<!no )\ban[oó]nim[oa]s?\b/i);
  assert.doesNotMatch('seudónima, no anónima', /(?<!no )\ban[oó]nim[oa]s?\b/i);
  assert.match(catalogText, /No es anonimato total/);
  assert.match(PRIVACY_SECTIONS.map((s) => s.body).join('\n'), /seudónima, no anónima/);
});

test('the catalog notice says what is sent, what is not, that it cannot be undone, and where to turn it off', () => {
  assert.match(catalogText, /código de barras, el nombre y la presentación/);
  for (const word of ['precios', 'ventas', 'clientes']) assert.match(catalogText, new RegExp(word));
  assert.match(catalogText, /no se puede borrar/);
  assert.match(catalogText, /Más → Privacidad/);
  assert.match(catalogText, new RegExp(LEGAL_CONTACT.replace('.', '\\.')));
  assert.notEqual(CATALOG_NOTICE.yes, CATALOG_NOTICE.no);
});

test('the cloud notice names the provider, the customer data and the access risk', () => {
  for (const word of ['Cloudflare', 'clientes de fiado', 'teléfonos', 'fotos', 'no lo compartas', 'autorización de tus clientes']) {
    assert.match(CLOUD_NOTICE.body, new RegExp(word));
  }
});

test('the privacy notice identifies the controller, the rights and each external service', () => {
  const privacy = PRIVACY_SECTIONS.map((s) => s.body).join('\n');
  assert.match(privacy, /Mateo Castro/);
  assert.match(privacy, new RegExp(LEGAL_CONTACT.replace('.', '\\.')));
  assert.match(privacy, /Ley 1581 de 2012/);
  assert.match(privacy, /Superintendencia de Industria y Comercio/);
  for (const service of ['Expo', 'Open Food Facts', 'Cloudflare', 'supermercados']) assert.match(privacy, new RegExp(service));
  assert.match(privacy, /no borra lo que ya esté en la nube/);
});

test('the terms match the proprietary license and every section has a title and a body', () => {
  const terms = TERMS_SECTIONS.map((s) => s.body).join('\n');
  assert.match(terms, /propiedad exclusiva de Mateo Castro/);
  assert.match(terms, /todos los derechos reservados/);
  assert.doesNotMatch(terms, /\bMIT\b|código abierto|open source/i);
  for (const section of everySection) {
    assert.ok(section.title.trim().length > 3);
    assert.ok(section.body.trim().length > 20);
  }
});

test('the photo tip is one short line', () => {
  assert.ok(PHOTO_TIP.length < 90);
  assert.doesNotMatch(PHOTO_TIP, /\n/);
});
