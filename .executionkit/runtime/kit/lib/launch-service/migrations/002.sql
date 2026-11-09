CREATE TABLE IF NOT EXISTS agent_enrollments(
  project TEXT NOT NULL REFERENCES projects(id),
  worker_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  capabilities TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ACTIVE','REVOKED')),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(project,worker_id)
);
CREATE INDEX IF NOT EXISTS agent_enrollments_principal_idx ON agent_enrollments(project,principal_id,status);
CREATE TABLE IF NOT EXISTS job_fences(
  job_id TEXT PRIMARY KEY REFERENCES jobs(id),
  generation INTEGER NOT NULL CHECK(generation > 0)
);
INSERT OR IGNORE INTO schema_versions VALUES(2,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
