---
name: release-health
description: Bind release candidates to exact commit identity, runtime health, and rollback readiness.
---

# Skill — Candidate Validation, Observability & Release Health

1. Verify exact candidate commit identity and control-plane parity via `executionkit control-plane status .`, `executionkit control-plane verify-head . --expected <sha>`, and `executionkit audit health .`.
2. Ensure all eleven systems report current candidate-bound evidence (`executionkit systems status .`, `executionkit decision status .`) with zero unresolved blockers or stale hashes.
3. Validate runtime health endpoints, queue/worker supervision, log/error telemetry, and backup/rollback readiness before and after deployment.
