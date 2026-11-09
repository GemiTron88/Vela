---
name: parallel-orchestration
description: Coordinate dependency-safe parallel Agent OS worktrees and sequential fallback.
---

# Skill — Parallel & Runtime Orchestration

1. Inspect parallel eligibility with `executionkit agents plan .` or prepare isolated Git worktrees with `executionkit agents run . [--boost]`.
2. Require explicit `Parallel Safe: YES` and disjoint `Ownership` metadata before fan-out; fall back deterministically to sequential execution when tasks overlap.
3. When host subagents are available, spawn one worker per `hostDelegations[]` entry and record its receipt via `executionkit agents delegated . --claim <id> --spawn-tool <tool> --worker-id <id>`.
4. If host subagent spawning is unavailable, run `executionkit agents decline . --reason HOST_SPAWN_UNAVAILABLE` and execute sequentially.
5. Workers never mutate canonical `TODO.md` or final acceptance; they record results with `executionkit agents result <worktree> --status COMPLETED|BLOCKED`.
6. Only the orchestrator collects, integrates, and cleans up claims (`executionkit agents collect .`, `executionkit agents integrate . --claim <id> --apply`, `executionkit agents cleanup . --claim <id>`).
