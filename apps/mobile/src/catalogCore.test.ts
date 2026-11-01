import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canAttemptCatalog,
  catalogBackoffMs,
  catalogCacheTtl,
  isCatalogCacheFresh,
  isCatalogEan,
  isCatalogEnabled,
  isCatalogName,
  isCatalogUuid,
  isGenericCatalogName,
} from './catalogCore.ts';

test('catalog cache TTL distinguishes found and not found', () => {
  assert.equal(catalogCacheTtl('found'), 30 * 24 * 60 * 60 * 1000);
  assert.equal(catalogCacheTtl('not_found'), 3 * 24 * 60 * 60 * 1000);
});

test('catalog cache rejects expired data', () => {
  const now = 1_800_000_000_000;
  assert.equal(isCatalogCacheFresh(now - 1000, 'found', now), true);
  assert.equal(isCatalogCacheFresh(now - 31 * 24 * 60 * 60 * 1000, 'found', now), false);
  assert.equal(isCatalogCacheFresh(now - 4 * 24 * 60 * 60 * 1000, 'not_found', now), false);
});

test('catalog backoff grows and can be skipped', () => {
  assert.equal(catalogBackoffMs(0), 0);
  assert.equal(catalogBackoffMs(1), 2000);
  assert.equal(catalogBackoffMs(2), 4000);
  assert.ok(catalogBackoffMs(20) <= 300000);
  assert.equal(canAttemptCatalog(0, 0, 1000), true);
  assert.equal(canAttemptCatalog(0, 2, 1000), false);
});

test('catalog module is disabled with an empty URL', () => {
  assert.equal(isCatalogEnabled(''), false);
  assert.equal(isCatalogEnabled('   '), false);
  assert.equal(isCatalogEnabled('https://catalog.example'), true);
});

test('catalog validates EAN and names', () => {
  assert.equal(isCatalogEan('7702511000045'), true);
  assert.equal(isCatalogEan('7702511000044'), false);
  assert.equal(isCatalogEan('291104080027'), false);
  assert.equal(isCatalogName('Arroz Diana 500 g'), true);
  assert.equal(isCatalogName('a'), false);
  assert.equal(isCatalogName('www.malicioso.test'), false);
  assert.equal(isCatalogName('correo@ejemplo.test'), false);
  assert.equal(isGenericCatalogName('Producto 0045'), true);
  assert.equal(isGenericCatalogName('Arroz Diana'), false);
});

test('catalog validates install UUIDs', () => {
  assert.equal(isCatalogUuid('4f4c12f7-4d8d-4b5f-9e09-0b6a0f4d1d5e'), true);
  assert.equal(isCatalogUuid('no-es-uuid'), false);
  assert.equal(isCatalogUuid(null), false);
});
