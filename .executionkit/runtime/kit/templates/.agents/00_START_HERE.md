# Agent OS — Start Here

This directory is the project-specific execution fabric for AI ExecutionKit. It routes and constrains work; it does **not** own task state.

1. Read root `AGENTS.md`.
2. `TODO.md` is canonical; do not preload all of it. Use the CLI-selected exact task path/line (`runtime.task.sourcePath:startLine`) plus direct dependencies.
3. Run `executionkit start . --host antigravity` (or `executionkit next .`) at entry or task transition; reuse its compact envelope between edits.
4. Load only the routed roles, skills, rules, workflow, contracts and task references returned in the envelope.
5. Inspect live code/tests/schema/routes/history before mutation (`executionkit db`, `executionkit route`, `executionkit knowledge`).
6. Never create a task queue, status ledger or implementation backlog under `.agents`.
7. Candidate/partial/revalidation work is not terminal; route it to review/correction until accepted (`executionkit todo complete . --task <id> --verify "<cmd>" --apply`).
8. Blocked work remains visible to closure reporting and may not disappear from scheduling truth.
9. Controlled parallel execution requires explicit task ownership, worktree claims (`executionkit agents run|delegated|decline|result|collect|integrate|cleanup`), and orchestrator integration.

Machine routing authority: `.agents/manifest.json`.
