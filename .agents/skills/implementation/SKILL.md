---
name: implementation
description: Implement, verify, and atomically close dependency-ready canonical tasks.
---

# Skill — Canonical Task Implementation

## Invariants
- `TODO_FIRST_ENTRY_INVARIANT`: `TODO.md` and declared active shards are the sole task authority across all eleven executable systems.
- `HOST_CHECKLIST_DERIVED_MIRROR`: host checklists (`brain/task.md`) are derived mirrors synchronized after task changes; Antigravity `/goal` never creates a second backlog.
- `PHASE_BOUNDARY_FULL_CI`: run targeted verification during task edits and reserve full suites for wave/phase/release boundaries.

## Execution Loop
1. Enter via `executionkit start . --host antigravity` and inspect the selected task's objective, `Ownership`, `Depends`, and `Verification`.
2. Before database or route edits, query compiled truth (`executionkit db table|column|model .`, `executionkit route status|guard .`) — never guess schema or route names.
3. For UI-bearing tasks, follow the mandatory skill chain `design-system → component-system → premium-experience`, use production-shaped data (never mocks/placeholders), and render the affected product surface across required states and form factors.
4. Verify with targeted tests (`executionkit test task . --target <file> [--filter <pattern>]`), changed-file guards (`executionkit guard all .`), Decision alignment (`executionkit decision align . --task <id>`), and task reconciliation (`executionkit reconcile task . --task <id>`).
5. Close atomically via `executionkit todo complete . --task <id> --verify "<cmd>" --apply` (or route to a reviewer distinct from the implementer when independent review is required), commit, push, and continue to the next ready task.
