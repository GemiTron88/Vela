# Test OS — AI ExecutionKit repository

**Capability level:** `STANDARD`

The canonical distribution gate is `npm run check`. Root self-hosting integrity is part of that gate in addition to the complete Node regression suite, v3 policy, examples, CI policy, canonical-doc checks and distribution validation.

GitHub Actions remains manual `workflow_dispatch` on self-hosted `project-ai-excutionkit` runners only. There is no push autorun and no GitHub-hosted fallback. A workflow startup failure with zero jobs is not test execution evidence; only a run that actually executes the candidate gate can prove the candidate.

Before release, the promoted 3.0.0 SHA requires fresh physical macOS and Windows evidence. Evidence from an older SHA becomes stale after candidate mutation.

## V35 integrated test truth

V35 adds negative regressions for false closure, incomplete phase convergence, untrusted journey evidence and stale accepted-proof revalidation. Release-critical integration proof must be produced by configured candidate-bound collectors and exercise the actual provider→consumer path at the declared black-box/runtime/browser/device boundary. Hand-authored PASS JSON and terminal TODO counts are not test evidence.

## Executable semantic journey layer

Test OS now runs pinned `tester-army/e2e` alongside existing deterministic suites and backend/route/database protections. Agentic Browsing 3/3 means critical happy-path, cross-feature workflow and adversarial/recovery journeys for each required actual target/role. See `contracts/agentic-e2e-contract.md` and `docs/architecture/agentic-e2e.md`. Use `executionkit test journeys .`; automatic wave/phase/release gates reject missing, stale, skipped, flaky or unproven journey evidence. Replay actions with live agent fallback; semantic assertions and independent persistence/permission/state oracles always run fresh. New tests require distinct risk mapping, never a count target.
