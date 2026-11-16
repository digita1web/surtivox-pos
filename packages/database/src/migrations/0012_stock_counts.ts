import type { Migration } from '../runner.ts';

const sql = `
CREATE TABLE stock_counts (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id),
  staff_id    TEXT REFERENCES staff(id),
  status      TEXT NOT NULL DEFAULT 'open',
  note        TEXT,
  started_at  INTEGER NOT NULL,
  closed_at   INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  device_id   TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  CHECK (status IN ('open','closed'))
);
CREATE INDEX idx_stock_counts_store ON stock_counts(store_id, started_at);

CREATE TABLE stock_count_lines (
  id                    TEXT PRIMARY KEY,
  count_id              TEXT NOT NULL REFERENCES stock_counts(id),
  product_id            TEXT NOT NULL REFERENCES products(id),
  product_name_snapshot TEXT NOT NULL,
  expected_qty          INTEGER NOT NULL,
  counted_qty           INTEGER NOT NULL,
  unit_cost             INTEGER NOT NULL DEFAULT 0,
  movement_id           TEXT,
  created_at            INTEGER NOT NULL,
  device_id             TEXT NOT NULL,
  CHECK (counted_qty >= 0)
);
CREATE INDEX idx_stock_count_lines_count ON stock_count_lines(count_id);
CREATE INDEX idx_stock_count_lines_product ON stock_count_lines(product_id);
`;

export const migration: Migration = { id: '0012_stock_counts', sql };
