CREATE TABLE IF NOT EXISTS agent_revocations (
  project TEXT NOT NULL REFERENCES projects(id),
  worker_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  runner_key_sha256 TEXT NOT NULL,
  revoked_at TEXT NOT NULL,
  PRIMARY KEY(project,worker_id,principal_id,runner_key_sha256)
);
CREATE INDEX IF NOT EXISTS agent_revocations_lookup ON agent_revocations(project,worker_id);
INSERT OR IGNORE INTO schema_versions VALUES(6,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
