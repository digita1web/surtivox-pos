CREATE TABLE IF NOT EXISTS payment_intents (
  reference TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  days INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  wompi_tx_id TEXT UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS entitlements (
  store_id TEXT PRIMARY KEY,
  active_until INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS wompi_events (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  received_at INTEGER NOT NULL
);
