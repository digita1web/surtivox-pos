CREATE TABLE IF NOT EXISTS shop_keys (
  store_id   TEXT PRIMARY KEY,
  key_hash   TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  rotated_at INTEGER
);

CREATE TABLE IF NOT EXISTS kit_attempts (
  bucket        TEXT PRIMARY KEY,
  failures      INTEGER NOT NULL,
  window_start  INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0
);
