import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRODUCT_FIELDS, REQUIRED_FIELDS } from '../src/validate.ts';

const schema = JSON.parse(readFileSync(new URL('../schema/product.schema.json', import.meta.url), 'utf8')) as {
  required: string[];
  properties: Record<string, unknown>;
  additionalProperties: boolean;
};

test('el JSON Schema y el validador declaran los mismos campos', () => {
  assert.deepEqual(Object.keys(schema.properties).sort(), [...PRODUCT_FIELDS].sort());
  assert.deepEqual([...schema.required].sort(), [...REQUIRED_FIELDS].sort());
  assert.equal(schema.additionalProperties, false);
});
