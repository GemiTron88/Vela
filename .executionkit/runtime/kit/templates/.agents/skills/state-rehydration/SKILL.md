---
name: state-rehydration
description: Reconstruct live execution truth after context loss, compaction, or handoff.
---

# Skill — State Rehydration

1. Run `executionkit state rehydrate .` to reconcile derived State OS snapshots against live Git, `TODO.md` shards, and gate receipts.
2. Verify zero-context recovery with the Amnesia Test (`executionkit state amnesia .`).
3. Record milestone continuity with `executionkit state checkpoint .` (or let `executionkit todo complete` / `executionkit boundary` checkpoint automatically).
4. Treat State OS and external memory (`executionkit state memory .`) as `ADVISORY_ONLY`; live repository truth and canonical `TODO.md` always win.
