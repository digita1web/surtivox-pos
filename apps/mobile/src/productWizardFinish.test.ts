import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '@surtivox/database';
import { finishWizardOn, type FinishDb, type FinishDeps } from './productWizardFinish.ts';
import { draftKey, newDraft, serializeDraft, type CatalogContribution, type WizardDraft } from './productWizard.ts';

type Param = string | number | null;

const EAN = '7701234567897';
const NOW = 1_800_000_000_000;

function setup(optIn: string | null = '1', over: Partial<FinishDeps> = {}) {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON;');
  for (const migration of MIGRATIONS) raw.exec(migration.sql);
  raw.prepare('INSERT INTO stores (id,name,currency_code,currency_locale,currency_decimals,created_at,updated_at,device_id) VALUES (?,?,?,?,?,?,?,?)')
    .run('s1', 'Tienda', 'COP', 'es-CO', 0, NOW, NOW, 'd');
  raw.prepare('INSERT INTO categories (id,store_id,name,sort_order,created_at,updated_at,device_id,version) VALUES (?,?,?,?,?,?,?,1)')
    .run('c1', 's1', 'Bebidas', 0, NOW, NOW, 'd');
  const db = {
    getFirstAsync: async (sql: string, params: readonly Param[] = []) => raw.prepare(sql).get(...params) ?? null,
    runAsync: async (sql: string, params: readonly Param[] = []) => {
      const result = raw.prepare(sql).run(...params);
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    withTransactionAsync: async (task: () => Promise<void>) => {
      raw.exec('BEGIN');
      try { await task(); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; }
    },
  } as unknown as FinishDb;
  const queued: CatalogContribution[] = [];
  let flushes = 0;
  let counter = 0;
  const deps: FinishDeps = {
    now: () => NOW,
    newId: () => `p${++counter}`,
    deviceId: 'dev',
    catalogEnabled: true,
    getCatalogOptIn: async () => optIn,
    enqueueContribution: async (contribution) => { queued.push(contribution); return true; },
    flushQueue: () => { flushes++; },
    ...over,
  };
  return { raw, db, deps, queued, flushes: () => flushes };
}

const draft = (over: Partial<WizardDraft> = {}): WizardDraft => ({
  ...newDraft(EAN, NOW), step: 'price', name: 'gaseosa', brand: 'postobón', size: '400 ml', priceText: '2.500',
  categoryId: 'c1', photoUri: 'file:///products/a.webp', ...over,
});

const products = (raw: DatabaseSync) => raw.prepare('SELECT * FROM products').all() as Record<string, unknown>[];
const draftRows = (raw: DatabaseSync) => (raw.prepare('SELECT COUNT(*) AS n FROM local_settings WHERE key=?').get(draftKey(EAN)) as { n: number }).n;

test('creacion completa: guarda nombre compuesto, precio, categoria y foto local y limpia el borrador', async () => {
  const { raw, db, deps } = setup();
  raw.prepare('INSERT INTO local_settings (key,value) VALUES (?,?)').run(draftKey(EAN), serializeDraft(draft()));
  const result = await finishWizardOn(db, deps, 's1', draft());
  assert.equal(result.status, 'created');
  const rows = products(raw);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.name, 'Postobón Gaseosa 400 ml');
  assert.equal(rows[0]!.selling_price, 2500);
  assert.equal(rows[0]!.category_id, 'c1');
  assert.equal(rows[0]!.image_uri, 'file:///products/a.webp');
  assert.equal(rows[0]!.barcode, EAN);
  assert.equal(rows[0]!.track_inventory, 0);
  assert.equal(draftRows(raw), 0);
  if (result.status !== 'invalid') {
    assert.equal(result.product.category_name, 'Bebidas');
    assert.equal(result.product.stock, 0);
  }
  assert.equal((raw.prepare('SELECT COUNT(*) AS n FROM stock_movements').get() as { n: number }).n, 0);
});

test('creacion minima: solo nombre y precio', async () => {
  const { raw, db, deps } = setup();
  const result = await finishWizardOn(db, deps, 's1', draft({ brand: '', size: '', categoryId: null, photoUri: null }));
  assert.equal(result.status, 'created');
  const row = products(raw)[0]!;
  assert.equal(row.name, 'Gaseosa');
  assert.equal(row.category_id, null);
  assert.equal(row.image_uri, null);
});

test('con consentimiento activo encola solo codigo, nombre y presentacion y empuja la cola', async () => {
  const { db, deps, queued, flushes } = setup('1');
  const result = await finishWizardOn(db, deps, 's1', draft());
  assert.equal(result.status === 'created' && result.queued, true);
  assert.deepEqual(queued, [{ code: EAN, name: 'Postobón Gaseosa', presentation: '400 ml' }]);
  assert.equal(flushes(), 1);
});

test('sin consentimiento no se encola ni se envia nada', async () => {
  for (const optIn of [null, '0']) {
    const { db, deps, queued, flushes } = setup(optIn);
    const result = await finishWizardOn(db, deps, 's1', draft());
    assert.equal(result.status === 'created' && result.queued, false);
    assert.equal(queued.length, 0);
    assert.equal(flushes(), 0);
  }
});

test('si el catalogo no esta configurado en la compilacion no se consulta el consentimiento ni se envia', async () => {
  let asked = false;
  const { db, deps, queued } = setup('1', { catalogEnabled: false, getCatalogOptIn: async () => { asked = true; return '1'; } });
  await finishWizardOn(db, deps, 's1', draft());
  assert.equal(queued.length, 0);
  assert.equal(asked, false);
});

test('una contribucion no valida (codigo que no es EAN) no se encola pero el producto se crea', async () => {
  const { raw, db, deps, queued } = setup('1');
  const result = await finishWizardOn(db, deps, 's1', draft({ barcode: 'INT-001' }));
  assert.equal(result.status, 'created');
  assert.equal(queued.length, 0);
  assert.equal(products(raw).length, 1);
});

test('sin red: la contribucion queda encolada y el fallo del envio no deshace el producto', async () => {
  const { raw, db, deps, queued } = setup('1', { flushQueue: () => { throw new Error('sin red'); } });
  const result = await finishWizardOn(db, deps, 's1', draft());
  assert.equal(result.status, 'created');
  assert.equal(queued.length, 1);
  assert.equal(products(raw).length, 1);
});

test('si encolar falla el producto igual queda creado', async () => {
  const { raw, db, deps } = setup('1', { enqueueContribution: async () => { throw new Error('disco lleno'); } });
  const result = await finishWizardOn(db, deps, 's1', draft());
  assert.equal(result.status === 'created' && result.queued, false);
  assert.equal(products(raw).length, 1);
});

test('el mismo codigo dos veces no crea dos productos ni vuelve a encolar', async () => {
  const { raw, db, deps, queued } = setup('1');
  const first = await finishWizardOn(db, deps, 's1', draft());
  const second = await finishWizardOn(db, deps, 's1', draft({ name: 'otra cosa' }));
  assert.equal(first.status, 'created');
  assert.equal(second.status, 'existing');
  assert.equal(products(raw).length, 1);
  assert.equal(queued.length, 1);
  if (first.status !== 'invalid' && second.status !== 'invalid') assert.equal(second.product.id, first.product.id);
});

test('un borrador invalido no crea nada', async () => {
  const { raw, db, deps } = setup();
  for (const bad of [draft({ name: '' }), draft({ priceText: '0' }), draft({ priceText: '' }), draft({ barcode: '' })]) {
    const result = await finishWizardOn(db, deps, 's1', bad);
    assert.equal(result.status, 'invalid');
  }
  assert.equal(products(raw).length, 0);
});

test('reintento tras un fallo a mitad: no queda producto a medias ni se pierde el borrador', async () => {
  const { raw, db, deps } = setup();
  raw.prepare("INSERT INTO products (id,store_id,name,barcode,cost_price,selling_price,unit,track_inventory,tax_bps,active,created_at,updated_at,device_id,version) VALUES ('dup','s1','Otro','123456789012',0,100,'unit',0,0,1,1,1,'d',1)").run();
  raw.prepare('INSERT INTO local_settings (key,value) VALUES (?,?)').run(draftKey(EAN), serializeDraft(draft()));
  const broken = { ...deps, newId: () => 'dup' };
  await assert.rejects(finishWizardOn(db, broken, 's1', draft()));
  assert.equal(products(raw).length, 1);
  assert.equal(draftRows(raw), 1);
  const retry = await finishWizardOn(db, deps, 's1', draft());
  assert.equal(retry.status, 'created');
  assert.equal(products(raw).length, 2);
  assert.equal(draftRows(raw), 0);
});

test('una categoria que ya no existe se guarda como sin categoria', async () => {
  const { raw, db, deps } = setup();
  const result = await finishWizardOn(db, deps, 's1', draft({ categoryId: 'borrada' }));
  assert.equal(result.status, 'created');
  assert.equal(products(raw)[0]!.category_id, null);
});

test('el borrador de otro codigo no se toca', async () => {
  const { raw, db, deps } = setup();
  const other = '7709990000003';
  raw.prepare('INSERT INTO local_settings (key,value) VALUES (?,?)').run(draftKey(other), serializeDraft(newDraft(other, NOW)));
  await finishWizardOn(db, deps, 's1', draft());
  assert.equal((raw.prepare('SELECT COUNT(*) AS n FROM local_settings WHERE key=?').get(draftKey(other)) as { n: number }).n, 1);
});
