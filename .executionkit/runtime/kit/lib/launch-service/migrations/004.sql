CREATE TABLE IF NOT EXISTS launch_gates (
 id TEXT PRIMARY KEY,
 project TEXT NOT NULL REFERENCES projects(id),
 source_commit TEXT NOT NULL,
 artifact_sha256 TEXT NOT NULL,
 issued_at INTEGER NOT NULL,
 signed TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS launch_gate_identity ON launch_gates(project,source_commit,artifact_sha256);
INSERT OR IGNORE INTO schema_versions VALUES(4,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
CREATE TRIGGER IF NOT EXISTS launch_gates_no_update BEFORE UPDATE ON launch_gates BEGIN SELECT RAISE(ABORT,'launch_gate_append_only'); END;
CREATE TRIGGER IF NOT EXISTS launch_gates_no_delete BEFORE DELETE ON launch_gates BEGIN SELECT RAISE(ABORT,'launch_gate_append_only'); END;
