import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkoutUrl,
  createReference,
  integritySignature,
} from '../src/wompi.ts';

test('generates the documented Wompi integrity signature', async () => {
  const signature = await integritySignature(
    'sk8-438k4-xmxm392-sn2m',
    2490000,
    'COP',
    'prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6',
  );
  assert.equal(signature, '37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5');
});

test('creates a unique readable reference', () => {
  assert.equal(createReference(1760000000000, 'abcd-1234-efgh-5678'), 'SVX-1760000000000-ABCD1234');
});

test('builds the checkout URL with the required parameters', () => {
  const url = new URL(checkoutUrl('pub_test_123', 'SVX-1-ABCD', 2000000, 'COP', 'firma'));
  assert.equal(url.origin + url.pathname, 'https://checkout.wompi.co/p/');
  assert.equal(url.searchParams.get('public-key'), 'pub_test_123');
  assert.equal(url.searchParams.get('currency'), 'COP');
  assert.equal(url.searchParams.get('amount-in-cents'), '2000000');
  assert.equal(url.searchParams.get('reference'), 'SVX-1-ABCD');
  assert.equal(url.searchParams.get('signature:integrity'), 'firma');
});
