# Agentic E2E in Test OS

`contracts/agentic-e2e-contract.md` is normative. Implementation lives in `lib/agentic-e2e.mjs`, independent oracle recording in `lib/agentic-postconditions.mjs`, scaffold generation in `bin/init-agentic-e2e.mjs` and operator routing in the existing `test` CLI family. This is part of Test OS, not an eleventh system.

| Layer | Detects | Runs |
|---|---|---|
| PHPUnit/Pest / Flutter / stable Playwright | Domain and API contracts, known regressions, permissions and persistence | Focused task checks and applicable boundaries |
| Route and DB guards | Source/schema/route mismatches | Before expensive boundary tests |
| tester-army/e2e | Discoverability, real cross-feature journeys, recovery dead ends | Wave, phase, exact release |
| Independent API/DB and UI oracles | Partial save, incorrect relationships/state, unexpected writes | Live after each relevant journey |
| Accessibility / Lighthouse / Visual OS | Configured technical and visual budgets | Existing applicable gates |

The runner performs a live environment preflight, allocates isolated output under `tests/agentic/.e2e/runs/<run-id>`, executes the pinned upstream CLI with shell-free bounded process handling, validates its complete schema and verifies each expected journey and artifact. It produces `.executionkit/gates/agentic-<boundary>.json` with per-journey failures and replay/call usage. The parent Test gate embeds this result. Release independently rechecks source/current candidate and artifact integrity.

Dependency installation is explicit and project-local. The installed v4 runtime includes the new library, contracts, scaffold and CLI through the existing installer; mature native suites remain project-owned and are never overwritten. Invariant `system.test.boundary` revision 2 triggers historical revalidation on upgrade, preventing old ACCEPTED claims from being grandfathered into the new policy. Normal session/task entry does no agentic run or heavy scan.

CI is manual, self-hosted and exact-SHA. Use Node 24.19 or another supported upstream runtime, install the native suite's committed lockfile with `npm ci`, preserve replay cache scoped to trusted suite/manifest/role context, and upload evidence with `always()`. Native mobile jobs require platform-specific build/device runners. Browser evidence cannot certify Flutter. No model or device credential should be offered to untrusted branch code.

For producer failures, inspect `environment.json`, `runner.log`, upstream `report.json`, JUnit and each trace. A budget/executor/model outage is a blocker, not proof of a product defect. A failing live assertion with screen evidence is a product observation. Compare that observation to deterministic tests from the same product revision before claiming a demonstrated test-suite miss.

The opt-in `npm run test:agentic-runtime` runs the actual pinned producer against the isolated HTTP app in `tests/fixtures/agentic-runtime`. Its healthy/replay/renamed-control/partial-save variants validate the adapter, not a product. Paid model calls are explicit; routine Kit regressions remain deterministic. See the fixture README.

The implementation pilot and acceptance limitations are recorded in `docs/execution/evidence/agentic-e2e/REPORT.md`. Those archived observations are not reusable release gates. A project must generate fresh evidence against its own attested application and candidate.
