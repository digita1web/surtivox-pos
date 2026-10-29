import type { Migration } from '../runner.ts';

const sql = /* sql */ `
CREATE TABLE market_prices (
  id                TEXT PRIMARY KEY,
  ean               TEXT NOT NULL,
  provider_id       TEXT NOT NULL,
  supermarket_name  TEXT NOT NULL,
  location          TEXT,
  context_key       TEXT NOT NULL DEFAULT 'online',
  price_minor       INTEGER NOT NULL,
  currency_code     TEXT NOT NULL DEFAULT 'COP',
  product_name      TEXT NOT NULL,
  presentation      TEXT,
  product_url       TEXT,
  source            TEXT NOT NULL,
  source_updated_at INTEGER,
  fetched_at        INTEGER NOT NULL,
  match_quality     TEXT NOT NULL,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  CHECK (length(ean) BETWEEN 8 AND 14),
  CHECK (ean NOT GLOB '*[^0-9]*'),
  CHECK (price_minor > 0),
  CHECK (match_quality IN ('exact_ean'))
);
CREATE UNIQUE INDEX idx_market_prices_unique ON market_prices(ean, provider_id, context_key);
CREATE INDEX idx_market_prices_ean_fetched ON market_prices(ean, fetched_at);
`;

export const migration: Migration = { id: '0008_market_prices', sql };
