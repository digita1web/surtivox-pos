import type { Migration } from '../runner.ts';

const sql = `
CREATE TABLE barcode_lookups (
  barcode    TEXT PRIMARY KEY,
  status     TEXT NOT NULL,
  name       TEXT,
  image_url  TEXT,
  source     TEXT,
  checked_at INTEGER NOT NULL,
  CHECK (status IN ('found','not_found')),
  CHECK (source IS NULL OR source IN ('market','off'))
);

CREATE TABLE product_review (
  product_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
`;

export const migration: Migration = { id: '0009_barcode_lookups', sql };
