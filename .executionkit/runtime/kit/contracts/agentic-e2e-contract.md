# Executable Agentic E2E Contract

Test OS combines deterministic unit/feature contracts, backend integration/permission/state guards, and semantic user journeys (`executionkit test journeys .`). None substitutes for the others.

## 1. Agentic Browsing 3/3

`executionkit.journeys.json` declares required executable journeys across every target browser/device and role:
1. `critical-happy-path`: complete the principal user goal; reload and verify every persisted field independently.
2. `cross-feature-workflow`: span multiple features; verify relationships, permissions, and state transitions across seams.
3. `adversarial-recovery`: trigger denied/invalid/offline/interrupted/duplicate actions; verify clear user feedback, recovery, and zero unintended writes.

A mobile-width browser is web evidence, never native Flutter Android/iOS evidence. Native mobile journeys use `@e2e-dev/mobile` against attested release builds on an enrolled physical workstation/device runner (never build mobile binaries on a production VPS).

## 2. Producer, Oracles & Evidence Binding

- Executes pinned `tester-army/e2e` (`e2e@0.18.0`, web `0.13.0`, mobile `0.10.0`). Missing producer, model, credentials, fixture, device, or runtime revision is `BLOCKED`, never `PASS`.
- Follow each `agent.act` with a deterministic locator assertion and a live `agent.assert` with observed revision and model provenance.
- Use `verifyPostcondition({ journeyId, id, kind, assertion }, liveRead, throwingCheck)` from generated `postconditions.mjs` to query real API/database state and reloaded UI state independently of agent prose or toast messages.
- The Kit validates the `report-1` schema, exact title/source/target binding, zero retries/skips/flakes, `createEvidenceStore()` immutable trace/screenshot SHA-256 snapshots, nonce-bound oracle receipts, zero runtime error logs, and 1-hour release freshness.
- Default budget: 1 worker, 0 retries, stop on first failure, max 9 journeys, 60 model calls, 200k tokens, 10 minutes. Run at wave/phase/release boundaries (`executionkit test journeys . --dry-run` then `executionkit test journeys .`), or scaffold with `executionkit test journeys . --init --platform web|android|ios`.

## 3. Visual Checkpoints & Test Portfolio Hygiene

- **Visual Checkpoints:** Up to 12 `visualCheckpoints` per journey capture live rendered states via `lib/visual-journeys.mjs` (`contracts/visual-os-v2-contract.md`).
- **Test Portfolio (`executionkit test portfolio . --base HEAD~1`):** Detects duplicate test files, repeated titles, and bursts of `>8` new test files. Every new deterministic test must protect a distinct business invariant or regression; never bulk-delete coverage to hit arbitrary file counts.
