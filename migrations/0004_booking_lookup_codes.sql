CREATE TABLE IF NOT EXISTS booking_lookup_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  requested_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS booking_lookup_codes_expiry_idx
  ON booking_lookup_codes(expires_at);
