import type { Migration } from '../runner.ts';

const sql = `
CREATE TABLE catalog_outbox (
  id           TEXT PRIMARY KEY,
  barcode      TEXT NOT NULL,
  name         TEXT NOT NULL,
  presentation TEXT,
  attempts     INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_catalog_outbox_barcode_name ON catalog_outbox(barcode, name);

CREATE TABLE catalog_cache (
  barcode      TEXT PRIMARY KEY,
  name         TEXT,
  presentation TEXT,
  contributors INTEGER,
  status       TEXT NOT NULL,
  checked_at   INTEGER NOT NULL,
  CHECK (status IN ('found','not_found'))
);
`;

export const migration: Migration = { id: '0011_catalog_client', sql };
