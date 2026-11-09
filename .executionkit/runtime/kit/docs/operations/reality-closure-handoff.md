# Reality Closure Hardening — Exact-Candidate Handoff

**Branch:** `fix/reality-integration-gates`  
**Target branch:** `main`  
**Authority:** `TODO.md` remains the sole mutable lifecycle/backlog authority.  
**Status:** source hardening implemented; executable phase/release acceptance intentionally not fabricated.

## What this branch changes

This branch hardens the failure class reproduced by WazzAI: individually completed tasks could previously add up to an apparently closed project while integration seams, critical user journeys, evidence provenance, runtime truth and later-change revalidation were still unproven.

The remediation stays inside the existing eight-system model. It adds cross-cutting reality-closure enforcement rather than a ninth OS:

- dependency-safe parallel Agent/Execution runtime with deterministic sequential fallback and `/boost`;
- phase convergence gates over complete non-cancelled denominators;
- product-scope critical-journey denominator and explicit integration contracts;
- one whole-system release convergence gate;
- exact-candidate trusted evidence producers;
- structured scenario artifacts bound to the same candidate/environment and revalidated by hash;
- change-impact revalidation of previously accepted proof;
- preservation-first migration/adoption safeguards for active projects;
- explicit ACTIVE-v3 policy validation so permissive defaults cannot silently create release truth;
- fail-closed BOOTSTRAP examples rather than fake ACTIVE/example evidence.

## Current declared regression surface

The repository currently declares a floor of **600 runtime tests across 69 required test files**.

This number is a distribution assertion only. It is **not a PASS** until the exact candidate executes successfully.

## Required exact-candidate continuation

On an authorized checkout/self-hosted runner:

1. Fetch this branch and record the exact SHA before running anything.
2. Confirm a clean working tree and correct official origin.
3. Run:
   - `npm run check`
   - `npm run audit:full`
4. Build the exact candidate:
   - `npm run candidate:build`
   - `npm run candidate:validate`
5. Collect all configured trusted evidence:
   - `npm run evidence:collect`
6. Verify integration/revalidation/release:
   - `npm run integration:release`
   - `npm run revalidation:require-clear`
   - `npm run release:check`
7. Exercise real-host boundaries required by canonical tasks:
   - V33: Antigravity restart/reload if required, normal dependency-safe parallel case, forced sequential fallback, `/boost` case, claim/worktree/integration inspection.
   - V34: export/prep a representative project; prove official GitHub `main` acquisition resolves to the recorded detached SHA; reject wrong-origin/ref/source overrides; perform restart-bound `executionkit_host_accept`.
   - V3 installer acceptance: preservation-first install/adopt/migrate on representative existing content without resetting valid implementation or canonical TODO.
8. Independently review the produced candidate/evidence/scenario artifacts and exact environment.
9. Update `TODO.md` only from observed evidence:
   - accept or remediate `EK3-022`;
   - accept or remediate `EK3-031`;
   - accept or remediate `EK3-033`;
   - run/accept or remediate `EK3-040`;
   - address historical blockers/dependencies required by `EK3-041`;
   - only then run/accept `EK3-041`.
10. Merge to `main` only after required dependencies and exact-candidate evidence are genuinely accepted.

## Do not do

- Do not convert IMPLEMENTED tasks to ACCEPTED from source inspection alone.
- Do not write PASS JSON or scenario reports manually.
- Do not weaken required producer, journey, phase or system-release gates to make readiness green.
- Do not replace dependency-safe parallelism with unsafe fan-out or with blanket sequential-only execution.
- Do not reset valid project implementation during migration.
- Do not treat old evidence as current after the candidate changes.
- Do not merge this branch merely because the diff is complete.

## Expected blocked state before real-host execution

It is valid for this branch to remain non-release-ready in the connected chat environment. In particular, real-host/exact-candidate acceptance tasks remain open until an authorized runner/workstation actually performs their verification.

The correct next environment should start by opening `TODO.md`, this handoff, and the live branch diff—not by reconstructing state from chat history.
