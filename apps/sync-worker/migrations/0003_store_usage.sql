CREATE TABLE IF NOT EXISTS store_usage (
  store_id TEXT NOT NULL,
  day      TEXT NOT NULL,
  rows     INTEGER NOT NULL,
  PRIMARY KEY (store_id, day)
);
