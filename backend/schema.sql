-- Operational metrics only. No IP addresses, form answers or generated plans.
CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  server_ms INTEGER,
  dify_seconds REAL,
  total_tokens INTEGER,
  gear_enabled INTEGER NOT NULL DEFAULT 0,
  client_wait_ms INTEGER,
  client_outcome TEXT,
  client_version TEXT NOT NULL,
  workflow_version TEXT NOT NULL,
  proxy_version TEXT NOT NULL,
  workflow_run_id TEXT,
  error_code TEXT,
  receipt_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS runs_started_at ON runs(started_at);
