---
name: review-acceptance
description: Independently review candidate tasks and bind verifiable command evidence.
---

# Skill — Review, Acceptance & Evidence Collection

1. Rehydrate live state (`executionkit state rehydrate .`) and inspect the candidate task diff, ownership boundaries, and required verification commands.
2. Execute real verification commands bound to the current worktree/HEAD (`executionkit test task . --target <file>`, `executionkit guard all .`, `executionkit reconcile task . --task <id>`).
3. For UI-bearing work, the reviewer must be distinct from the implementer and verify rendered evidence (`executionkit visual inspect|certify .`).
4. Seal durable task proof with `executionkit proof seal . --task <id> --apply` or complete via `executionkit todo complete . --task <id> --verify "<cmd>" --apply`.
5. Reject self-declared PASS claims, stale receipts from prior commits, or unverified acceptance criteria; set `CORRECTION_REQUIRED` with concrete findings when gaps remain.
