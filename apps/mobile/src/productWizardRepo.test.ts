import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from '@surtivox/database';
import { categoryExamplesOn, type ExamplesDb } from './productWizardRepo.ts';
import { closingMessage, useWizardHandoff } from './productWizardHandoff.ts';

function setup() {
  const raw = new DatabaseSync(':memory:');
  for (const migration of MIGRATIONS) raw.exec(migration.sql);
  raw.prepare('INSERT INTO stores (id,name,currency_code,currency_locale,currency_decimals,created_at,updated_at,device_id) VALUES (?,?,?,?,?,?,?,?)').run('s1', 'T', 'COP', 'es-CO', 0, 1, 1, 'd');
  raw.prepare('INSERT INTO stores (id,name,currency_code,currency_locale,currency_decimals,created_at,updated_at,device_id) VALUES (?,?,?,?,?,?,?,?)').run('s2', 'U', 'COP', 'es-CO', 0, 1, 1, 'd');
  for (const [id, store] of [['c1', 's1'], ['c2', 's1'], ['c3', 's2']] as const) {
    raw.prepare('INSERT INTO categories (id,store_id,name,sort_order,created_at,updated_at,device_id,version) VALUES (?,?,?,?,?,?,?,1)').run(id, store, id, 0, 1, 1, 'd');
  }
  const add = (id: string, store: string, cat: string | null, name: string, at: number, extra = '') => {
    raw.prepare(`INSERT INTO products (id,store_id,category_id,name,cost_price,selling_price,unit,track_inventory,tax_bps,active,created_at,updated_at,device_id,version${extra ? ',deleted_at' : ''}) VALUES (?,?,?,?,0,100,'unit',0,0,1,?,?,'d',1${extra ? ',5' : ''})`).run(id, store, cat, name, at, at);
  };
  add('p1', 's1', 'c1', 'Arroz', 10);
  add('p2', 's1', 'c1', 'Frijol', 20);
  add('p3', 's1', 'c1', 'Lentejas', 30);
  add('p4', 's1', 'c2', 'Leche', 5);
  add('p5', 's1', null, 'Suelto', 50);
  add('p6', 's1', 'c2', 'Borrado', 60, 'x');
  add('p7', 's2', 'c3', 'Ajeno', 70);
  const db = { getAllAsync: async (sql: string, params: readonly (string | number | null)[] = []) => raw.prepare(sql).all(...params) } as unknown as ExamplesDb;
  return db;
}

test('da hasta dos ejemplos por categoria, los mas recientes, de la tienda correcta y sin borrados', async () => {
  const examples = await categoryExamplesOn(setup(), 's1');
  assert.deepEqual(examples.c1, ['Lentejas', 'Frijol']);
  assert.deepEqual(examples.c2, ['Leche']);
  assert.equal(examples.c3, undefined);
  assert.equal(Object.keys(examples).length, 2);
});

test('el traspaso de venta rapida y del mensaje se consume una sola vez', () => {
  const handoff = useWizardHandoff.getState();
  assert.equal(handoff.takeQuickSale(), null);
  handoff.requestQuickSale('7701234567897');
  assert.equal(useWizardHandoff.getState().takeQuickSale(), '7701234567897');
  assert.equal(useWizardHandoff.getState().takeQuickSale(), null);
  handoff.announce('Producto creado');
  assert.equal(useWizardHandoff.getState().takeMessage(), 'Producto creado');
  assert.equal(useWizardHandoff.getState().takeMessage(), null);
});

test('mensajes de cierre: gracias solo si se encolo una contribucion', () => {
  assert.equal(closingMessage({ status: 'created', queued: true }), 'Producto creado. Gracias por ayudar al catálogo');
  assert.equal(closingMessage({ status: 'created', queued: false }), 'Producto creado');
  assert.match(closingMessage({ status: 'existing', queued: false }), /ya estaba registrado/);
});
