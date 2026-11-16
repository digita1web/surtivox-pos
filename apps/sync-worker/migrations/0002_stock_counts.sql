CREATE TABLE IF NOT EXISTS stock_counts (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL,
  staff_id    TEXT,
  status      TEXT NOT NULL,
  note        TEXT,
  started_at  INTEGER NOT NULL,
  closed_at   INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  device_id   TEXT NOT NULL,
  version     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_counts_sync ON stock_counts(store_id, updated_at);

CREATE TABLE IF NOT EXISTS stock_count_lines (
  id                    TEXT PRIMARY KEY,
  count_id              TEXT NOT NULL,
  product_id            TEXT NOT NULL,
  product_name_snapshot TEXT NOT NULL,
  expected_qty          INTEGER NOT NULL,
  counted_qty           INTEGER NOT NULL,
  unit_cost             INTEGER NOT NULL,
  movement_id           TEXT,
  created_at            INTEGER NOT NULL,
  device_id             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_count_lines_count ON stock_count_lines(count_id, created_at);
