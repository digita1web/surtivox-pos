import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultDraftName, tracksInventory } from './stockPolicy.ts';

test('products without an explicit flag keep tracking inventory', () => {
  assert.equal(tracksInventory({}), true);
  assert.equal(tracksInventory({ track_inventory: null }), true);
  assert.equal(tracksInventory({ track_inventory: 1 }), true);
});

test('draft products do not track inventory', () => {
  assert.equal(tracksInventory({ track_inventory: 0 }), false);
});

test('default draft names use the last four barcode digits', () => {
  assert.equal(defaultDraftName('291104080027'), 'Producto 0027');
  assert.equal(defaultDraftName(' 7702511000045 '), 'Producto 0045');
});
