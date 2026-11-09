---
name: audit-boundary
description: Run evidence-first task, wave, phase, and release boundary audits across all 11 systems.
---

# Skill — Boundary Audit & Convergence

1. Run the appropriate boundary command:
   - Task: `executionkit audit task .` and `executionkit reconcile task .`
   - Wave: `executionkit boundary wave .` (or `executionkit audit wave .`)
   - Phase: `executionkit boundary phase .` (or `executionkit audit phase .`)
   - Release: `executionkit audit release .` and `executionkit reconcile release .`
2. Inspect specialized audit domains when triggered: `executionkit audit security|data-safety|health|quality|storage .`.
3. Every HIGH/CRITICAL finding or uncovered scope item must be reconciled into canonical `TODO.md` gap tasks via `executionkit product reconcile .` before boundary convergence can pass.
