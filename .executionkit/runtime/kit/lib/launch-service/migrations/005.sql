CREATE TABLE IF NOT EXISTS artifact_inspections (
 id TEXT PRIMARY KEY,
 project TEXT NOT NULL REFERENCES projects(id),
 artifact_sha256 TEXT NOT NULL,
 job_id TEXT NOT NULL,
 lease_generation INTEGER NOT NULL,
 worker_id TEXT NOT NULL,
 accepted_at TEXT NOT NULL,
 signed TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS artifact_inspection_identity ON artifact_inspections(project,artifact_sha256);
CREATE TRIGGER IF NOT EXISTS artifact_inspections_no_update BEFORE UPDATE ON artifact_inspections BEGIN SELECT RAISE(ABORT,'artifact_inspection_append_only'); END;
CREATE TRIGGER IF NOT EXISTS artifact_inspections_no_delete BEFORE DELETE ON artifact_inspections BEGIN SELECT RAISE(ABORT,'artifact_inspection_append_only'); END;
INSERT OR IGNORE INTO schema_versions VALUES(5,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
