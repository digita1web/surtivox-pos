import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canAcceptVote,
  consensusWinner,
  isValidEan,
  isValidInstallId,
  normalizeName,
  parseMinContributors,
  validateItem,
  type CatalogVote,
} from '../src/validation.ts';

function vote(name: string, contributorHash: string, presentation: string | null = null): CatalogVote {
  return {
    nameNorm: normalizeName(name),
    nameDisplay: name,
    presentation,
    contributorHash,
    createdAt: 1,
  };
}

test('validates EAN-8, UPC-A, EAN-13 and GTIN-14 checksums', () => {
  assert.equal(isValidEan('96385074'), true);
  assert.equal(isValidEan('036000291452'), true);
  assert.equal(isValidEan('7702511000045'), true);
  assert.equal(isValidEan('10012345678902'), true);
  assert.equal(isValidEan('7702511000044'), false);
  assert.equal(isValidEan('291104080027'), false);
  assert.equal(isValidEan('123'), false);
});

test('normalizes accents, case and whitespace', () => {
  assert.equal(normalizeName('  ARROZ  DÍA  '), 'arroz dia');
  assert.equal(normalizeName('Café   con Leche'), 'cafe con leche');
});

test('validates name, presentation and install id', () => {
  assert.equal(validateItem({ code: '7702511000045', name: 'Arroz Diana 500 g' })?.name, 'Arroz Diana 500 g');
  assert.equal(validateItem({ code: '7702511000045', name: 'a' }), null);
  assert.equal(validateItem({ code: '7702511000045', name: 'www.malicioso.test' }), null);
  assert.equal(validateItem({ code: '7702511000045', name: 'correo@ejemplo.test' }), null);
  assert.equal(validateItem({ code: '7702511000045', name: 'Arroz', presentation: 'x'.repeat(21) }), null);
  assert.equal(isValidInstallId('4f4c12f7-4d8d-4b5f-9e09-0b6a0f4d1d5e'), true);
  assert.equal(isValidInstallId('no-es-uuid'), false);
});

test('requires distinct contributors and picks the most voted display', () => {
  const votes = [
    vote('Arroz Diana', 'a'),
    vote('Arroz Diana', 'b'),
    vote('ARROZ DIANA', 'c'),
  ];
  assert.deepEqual(consensusWinner(votes, 3), { name: 'Arroz Diana', presentation: null, contributors: 3 });
  assert.equal(consensusWinner(votes, 4), null);
});

test('picks the group with the most contributors', () => {
  const votes = [
    vote('Arroz Diana', 'a'),
    vote('Arroz Diana', 'b'),
    vote('Arroz Diana', 'c'),
    vote('Arroz Diana', 'd'),
    vote('Arroz Uno', 'a'),
    vote('Arroz Uno', 'b'),
    vote('Arroz Uno', 'c'),
  ];
  assert.deepEqual(consensusWinner(votes, 3), { name: 'Arroz Diana', presentation: null, contributors: 4 });
});

test('enforces daily and one-name-per-code limits', () => {
  assert.equal(canAcceptVote({ dailyCount: 0, maxPerDay: 200, votedDifferentNameToday: false }), true);
  assert.equal(canAcceptVote({ dailyCount: 200, maxPerDay: 200, votedDifferentNameToday: false }), false);
  assert.equal(canAcceptVote({ dailyCount: 1, maxPerDay: 200, votedDifferentNameToday: true }), false);
  assert.equal(parseMinContributors('2'), 2);
  assert.equal(parseMinContributors(undefined), 3);
});
