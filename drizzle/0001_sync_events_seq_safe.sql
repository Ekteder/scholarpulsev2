-- Safe, non-blocking sequence migration for ScholarPulse outbox engine.
-- Does NOT lock the table, preventing 504 gateway timeouts on live connections.

CREATE TABLE IF NOT EXISTS sync_counters (
  user_id text PRIMARY KEY,
  seq     bigint NOT NULL DEFAULT 0
);

ALTER TABLE sync_events ADD COLUMN IF NOT EXISTS seq bigint;

CREATE UNIQUE INDEX IF NOT EXISTS sync_events_user_seq_idx ON sync_events (user_id, seq);
