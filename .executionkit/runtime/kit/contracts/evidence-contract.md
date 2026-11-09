# Evidence Contract

**Status:** CANONICAL contract.

## Purpose & Minimum Record

Evidence is durable proof supporting implementation verification, independent `ACCEPTED` decisions and `RELEASED`/launch gates. `TODO.md` (and declared shards) remains the sole mutable task-state owner.

Every task or gate evidence record must bind:
- Task/finding/gate ID and exact candidate identity (Git SHA + worktree fingerprint).
- Executed verification command/procedure, exit code (0 without signal/error for PASS), ordered timestamps and environment/platform/device class.
- Relevant artifact paths and SHA-256 hashes.
- Producer and independent reviewer identities when required (`producerId !== reviewerId`).
- Honest reporting of `FAIL`, `NOT_RUN`, skipped/unavailable checks and unresolved risks.

## Evidence Classes & Quality Rules

- **Classes:** Automated test (`executionkit test task|wave|phase|release .`), CI, static/build, runtime, visual/accessibility (`executionkit visual inspect|certify .`), data/migration, performance and release (`executionkit launch verify|release .`).
- **Forbidden:** Prose-only claims (`"done"`, `"tested manually"`), stale results from prior commits, hand-edited PASS JSON, or self-declared `evidence_origin: REAL_PRODUCTION` without a verified collector receipt.
- **Invalidation:** Evidence invalidates whenever relevant implementation, dependencies, configuration, candidate identity or runtime freshness window changes.
- **Findings:** `FIXED` requires evidence reproducing and passing the original failure condition. Unresolved accepted risk uses finding disposition `ACCEPTED_RISK` with authority and rationale, never task `ACCEPTED`.

## Journey & Durable Task Proof

- **Journey Binding:** Release-required journeys declare concrete `requiredScenarios` in `journeyCoverage` bound to an executable integration/browser/device/E2E producer (`contracts/agentic-e2e-contract.md`). Generic unit tests cannot satisfy journey coverage.
- **Durable Task Proof:** `.executionkit/**` is derived runtime state and is invalid as sole terminal proof for `ACCEPTED` or `RELEASED` tasks. Before terminal acceptance, seal runtime/test/audit artifacts into tracked repository proof (`docs/execution/evidence/tasks/<task-id>/`) via `executionkit proof seal . --task <id> --apply` (or atomically via `executionkit todo complete . --task <id> --verify "<cmd>" --apply`). Missing durable receipts or stale local code references fail structural acceptance checks.
