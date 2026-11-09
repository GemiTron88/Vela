---
name: archive-terminal
description: Archive completed terminal tasks while preserving IDs, dependency graphs, and proof.
---

# Skill — Canonical Task Archival

1. Inspect shard bloat and archival candidates with `executionkit todo status .` and `executionkit proof status .`.
2. Ensure all terminal tasks to be archived have sealed durable proofs (`executionkit proof seal . --apply`).
3. Run `executionkit todo archive .` (or `executionkit todo maintain . --apply`) to move terminal tasks into `todo/archive/` while preserving dependency resolution and canonical task IDs.
