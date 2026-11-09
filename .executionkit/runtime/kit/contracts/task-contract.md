# Task Contract

A task contract defines scope, acceptance and verification for an immutable task ID whose mutable status lives solely in canonical `TODO.md` or declared active shards.

## Identity & Metadata

- **Identity:** Immutable task ID, outcome-oriented title/objective, phase/workstream, priority, dependencies and contract reference.
- **Lifecycle:** `IMPLEMENTED` is candidate state, not completion. Independent review or atomic verification (`executionkit todo complete . --task <id> --verify "<cmd>" --apply`) produces `ACCEPTED` evidence.
- **Blockers & Cancellation:** `BLOCKED` requires a concrete blocker and observable unblock condition (plus bounded AI-actionable metadata when eligible for automatic inspection). `CANCELLED` requires rationale.
- **Parallel Execution:** Tasks with `Parallel Safe: YES` and disjoint `Ownership` metadata may run in isolated Agent OS worktrees (`executionkit agents run .`).
- **Tags & Quality:** Declare relevant `Tags` (`laravel`, `livewire`, `flutter`, `web-components`, `premium`, `seo`, `performance`, `content`) and `Risk` so Agent OS routes the matching skills and quality contracts.

## Definition of Ready & Done

- **Ready:** Scope is clear, hard dependencies are terminal (`ACCEPTED`/`RELEASED`), and no known blocker prevents execution. `PLANNED` is not executable until promoted to `READY`.
- **Done / Accepted:** Implementation + targeted verification + changed-file guards (`executionkit guard all .`) + Decision alignment (`executionkit decision align . --task <id>`) + durable proof (`executionkit proof seal . --task <id> --apply`) + independent review when required. Failed review routes `CORRECTION_REQUIRED` with exact findings.

## Durable closure & Journey binding

- Terminal closure (`ACCEPTED`/`RELEASED`) is fail-closed and cannot rely on volatile `.executionkit/**` paths or missing files. `executionkit proof seal . --task <id> --apply` snapshots evidence under `docs/execution/evidence/tasks/<task-id>/`.
- Task-level `ACCEPTED` proves only the task's contract on the bound candidate; release-critical product flows must converge at wave/phase/release journey gates (`executionkit.journeys.json` / `contracts/agentic-e2e-contract.md`).
