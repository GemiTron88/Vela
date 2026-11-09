-- Additive only: agent presence, durable job outcomes and cancellation requests.
-- Existing tables/rows are never altered, so legacy installations upgrade in place.
CREATE TABLE IF NOT EXISTS agent_presence(
  project TEXT NOT NULL REFERENCES projects(id),
  worker_id TEXT NOT NULL,
  last_seen_at INTEGER NOT NULL,
  activity TEXT NOT NULL CHECK(activity IN ('IDLE','BUSY','DRAINING')),
  data TEXT NOT NULL,
  PRIMARY KEY(project,worker_id)
);
CREATE TABLE IF NOT EXISTS job_outcomes(
  job_id TEXT PRIMARY KEY REFERENCES jobs(id),
  state TEXT NOT NULL,
  reason TEXT NOT NULL,
  actor TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- Operator directives for outbound-only agents (picked up at the agent's next contact; never a command).
CREATE TABLE IF NOT EXISTS agent_directives(
  project TEXT NOT NULL REFERENCES projects(id),
  worker_id TEXT NOT NULL,
  desired TEXT NOT NULL CHECK(desired IN ('ACTIVE','PAUSED','STOP')),
  actor TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(project,worker_id)
);
INSERT OR IGNORE INTO schema_versions VALUES(3,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
