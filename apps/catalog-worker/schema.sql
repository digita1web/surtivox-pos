CREATE TABLE IF NOT EXISTS catalog_votes (
  barcode          TEXT NOT NULL,
  name_norm        TEXT NOT NULL,
  name_display     TEXT NOT NULL,
  presentation     TEXT,
  contributor_hash TEXT NOT NULL,
  created_at       INTEGER NOT NULL,
  PRIMARY KEY (barcode, name_norm, contributor_hash)
);
CREATE INDEX IF NOT EXISTS idx_catalog_votes_barcode ON catalog_votes(barcode);

CREATE TABLE IF NOT EXISTS catalog_products (
  barcode      TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  presentation TEXT,
  contributors INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS contribution_limits (
  contributor_hash TEXT NOT NULL,
  day              TEXT NOT NULL,
  count            INTEGER NOT NULL,
  PRIMARY KEY (contributor_hash, day)
);
