import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkPushRows, PUSH_BATCH, PUSH_LIMITS, SYNC_TABLES } from '../src/index.ts';

const row = (id: string, pad = 0) => ({ id, pad: 'x'.repeat(pad) });
const flatten = (batches: ReturnType<typeof chunkPushRows>) =>
  batches.flatMap((b) => Object.entries(b).flatMap(([name, rows]) => rows.map((r) => `${name}:${r.id}`)));

test('client batches always fit inside the server limits', () => {
  assert.ok(PUSH_BATCH.maxRows <= PUSH_LIMITS.maxRows);
  assert.ok(PUSH_BATCH.maxBytes * 3 <= PUSH_LIMITS.maxBytes);
});

test('no rows produce no batches and small payloads stay in one batch', () => {
  assert.deepEqual(chunkPushRows([]), []);
  assert.equal(chunkPushRows([{ name: 'a', rows: [row('1'), row('2')] }, { name: 'b', rows: [row('3')] }]).length, 1);
});

test('every row is sent exactly once, in order, and no batch exceeds the row limit', () => {
  const tables = [
    { name: 'sales', rows: Array.from({ length: 450 }, (_, i) => row(`s${i}`)) },
    { name: 'sale_items', rows: Array.from({ length: 450 }, (_, i) => row(`i${i}`)) },
  ];
  const batches = chunkPushRows(tables, { maxRows: 200, maxBytes: 1_000_000 });
  assert.equal(batches.length, 5);
  for (const b of batches) assert.ok(Object.values(b).reduce((n, rows) => n + rows.length, 0) <= 200);
  const expected = tables.flatMap((t) => t.rows.map((r) => `${t.name}:${r.id}`));
  assert.deepEqual(flatten(batches), expected);
});

test('the byte limit splits batches and an oversized row travels alone', () => {
  const tables = [{ name: 'a', rows: [row('1', 400), row('2', 400), row('3', 5000), row('4', 10)] }];
  const batches = chunkPushRows(tables, { maxRows: 100, maxBytes: 1000 });
  assert.deepEqual(batches.map((b) => b.a!.map((r) => r.id)), [['1', '2'], ['3'], ['4']]);
});

test('parents stay ahead of children across batches for the real table order', () => {
  const names = SYNC_TABLES.map((t) => t.name);
  const tables = names.map((name) => ({ name, rows: Array.from({ length: 120 }, (_, i) => row(`${name}${i}`)) }));
  const order = flatten(chunkPushRows(tables, { maxRows: 200, maxBytes: 1_000_000 })).map((k) => k.split(':')[0]!);
  const firstIndex = (n: string) => order.indexOf(n);
  assert.ok(firstIndex('sales') < firstIndex('sale_items'));
  assert.ok(firstIndex('returns') < firstIndex('return_items'));
  assert.ok(firstIndex('purchases') < firstIndex('purchase_items'));
});
