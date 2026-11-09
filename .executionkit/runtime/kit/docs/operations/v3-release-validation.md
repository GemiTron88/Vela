# AI ExecutionKit 3.0 — Physical device and exact-candidate certification

This runbook defines **physical-device certification evidence** for the published ExecutionKit 3.0.0 distribution and the evidence boundary for later current-3.x exact-candidate capability evolution. It does not replace `TODO.md`, SEO OS, Test OS, Audit OS or Launch OS authority, and it does not manufacture evidence for a workstation or candidate that has not actually executed the required checks.

ExecutionKit 3.0.0 publication, physical-device certification and later compatible-evolution acceptance are intentionally separate states. See `docs/operations/v3-publication-status.md`.

## Certification targets

A concrete device is certified only after the applicable current checks run on that physical target platform:

- macOS self-hosted runner labeled `self-hosted`, `project-ai-excutionkit`, `macOS` when certifying a macOS workstation;
- Windows self-hosted runner labeled `self-hosted`, `project-ai-excutionkit`, `windows` when certifying a Windows workstation.

A result from one platform does not prove the other. A result from another device, worktree, branch or stale commit does not prove the current target/candidate.

A current capability evolution such as SEO OS has a separate exact-candidate acceptance boundary: committed implementation/tests/docs, static distribution inspection or code already present on `main` are not substitutes for the canonical independent audit and executable gate required by that evolution's TODO dependency chain.

## Pre-run conditions

Before a certification or exact-candidate evidence run:

1. The checkout must resolve to the exact distribution/project commit being certified.
2. The working tree must be clean unless the certification contract explicitly captures and permits a dirty candidate.
3. The branch/upstream relationship and remote freshness must be understood and recorded.
4. `VERSION`, package/config/Agent version surfaces and the applicable test baseline must be coherent.
5. No GitHub-hosted fallback is allowed when the canonical policy requires self-hosted execution.
6. The external Elmasna3 control plane may be absent or unreachable; Bootstrap Mode requires local ExecutionKit operation to remain valid without it.
7. The Agent must be installed/run only on an operator-authorized workstation.
8. When SEO release validation is applicable, the candidate envelope must identify/hash the current SEO contract and enabled SEO must not bypass `requiredForRelease=true`.

## Preferred certification sequence

Where the repository self-hosted runner is configured, `.github/workflows/execution-integrity.yml` remains the preferred execution surface and remains `workflow_dispatch` only.

For distribution-level evidence the runner should execute the currently required canonical command set, including:

```bash
npm install --ignore-scripts --no-package-lock --no-audit --no-fund
node -e "Promise.all([import('@modelcontextprotocol/server'), import('@modelcontextprotocol/server/stdio'), import('zod/v4')]).then(() => console.log('MCP runtime imports: PASS'))"
npm run check
node bin/agent-doctor.mjs
node bin/executionkit-agent.mjs status
node bin/write-validation-evidence.mjs --root . --output <runner-temp>/executionkit-validation.json
```

For an independent SEO exact-candidate audit, the current canonical audit task may require the stronger executable boundary `npm run check && npm run audit:full` plus exact SHA/environment/run evidence and independent review. That audit deliberately does **not** weaken or bypass Launch readiness.

`npm run release:check` remains the strict Launch/release-readiness gate. It evaluates canonical closure as well as release evidence and therefore must not be pulled earlier into an audit task while canonical promotion/release work is still non-terminal. A capability audit must not add an “ignore open TODO” escape merely to make release-readiness green.

For a project adoption, run the project's applicable deep-integration, State/Amnesia, Agent-routing, SEO, framework/editor, Test, Audit, Launch and project-specific acceptance gates in addition to the Agent diagnostics.

## SEO exact-candidate evidence

Applicable SEO release certification must preserve the SEO OS ownership boundary:

- S3 evaluates the **exact release candidate** and current SEO contract identity/hash;
- Test OS owns execution/adequacy/freshness of browser/Lighthouse/performance/schema/check evidence;
- Audit OS independently challenges search denominator, implementation and evidence trustworthiness;
- Launch OS owns release/deployment authorization and invokes the applicable release gate;
- S4 is post-deployment production SEO verification;
- S5 is ongoing operational/search observability.

S3 evidence does not become S4/S5 evidence. No stage guarantees external indexing, rankings, traffic, rich-result appearance or search-engine behavior.

## Repository Intelligence exact-candidate evidence

When the Repository Intelligence compatible evolution is being considered for merge/promotion, the exact candidate must additionally prove:

- `npm run repository:validate` on the exact checkout;
- `npm run repository:tooling:doctor` must PASS when managed provider tooling is installed, or report `NOT_INSTALLED` without fabricating a requirement when all such tools are optional;
- managed provider deployment regressions must prove exact pins, deterministic plan identity, explicit apply, isolated npm policy, unsafe-root rejection, receipt/package-lock integrity and both pre-swap and post-swap rollback;
- the manual exact-candidate workflow must run the real `npm run repository:tooling:smoke` equivalent on Node 22 against the official registry for managed Repomix/CodeGraph/RTK, then preserve its JSON evidence;
- Repository Intelligence contract/source/freshness/context/provider/security/evaluation regressions through the normal test runner;
- preservation-first installer/adoption behavior for native `AGENTS.md`;
- State OS remains resumable when only knowledge freshness/storage changes;
- optional Terrain/Repomix/CodeGraph/RTK absence does not fail canonical local execution;
- required-provider failures do fail closed;
- no source pack or secret-sensitive source is uploaded through routine telemetry;
- benchmark/evaluation output is measured evidence, not a performance claim inferred from architecture;
- `npm run repository:benchmark:scenarios` must execute the reproducible small/medium/large/monorepo suite and preserve its exact-candidate JSON output alongside validation evidence;
- full `npm run check && npm run audit:full` on the exact self-hosted candidate before merge/promotion acceptance.

## Required evidence properties

A certification evidence package must identify at minimum:

- actual result (`PASS` only when the required checks really passed);
- ExecutionKit/distribution version;
- tested commit/HEAD and branch/candidate identity;
- physical platform (`darwin`/macOS or `win32`/Windows as applicable);
- device/worktree identity at the allowed privacy level;
- Node/runtime version;
- Agent doctor/status result when device certification is claimed;
- self-hosted run metadata when GitHub Actions produced the evidence;
- candidate-control hashes required by the applicable gate, including the SEO contract when applicable;
- timestamp and evidence freshness.

Where `write-validation-evidence.mjs` or candidate/evidence tooling is used, it must refuse PASS evidence when exact-candidate requirements are not met. A newer material candidate or changed SEO contract invalidates older evidence for the changed behavior.

## Failure semantics

Any failed, cancelled, unavailable, missing or stale required run is not PASS. A GitHub workflow registration/startup failure with zero jobs is CI orchestration evidence only and is neither a test failure nor a test pass.

Missing physical certification does **not** convert the published distribution into a failed project execution dependency. It means only that the specific device/platform claim remains `NOT_RUN`/`UNVERIFIED` until direct evidence exists.

Likewise, unavailable exact-candidate execution leaves the corresponding canonical audit/certification task `BLOCKED`/`NOT_RUN` where that is the truthful task state. Static integration quality must not be promoted to executable acceptance merely because the environment cannot dispatch or run the required suite.

## Publication boundary

Distribution publication may precede physical-device certification **only when the publication record explicitly preserves this evidence boundary and makes no physical PASS claim**. Publication must not weaken CI defaults, invent a tag/release, claim a self-hosted run that did not happen, imply that one platform certifies another, or reinterpret later compatible-evolution code presence as an accepted release.

Physical certification becomes mandatory before describing a concrete workstation, runner, Agent installation or platform-specific runtime path as certified/verified. Exact-candidate capability acceptance becomes mandatory before the corresponding canonical promotion/version-release task may claim that evolution accepted or release-ready.

For 3.0.0, the durable publication state is recorded in `VERSION`, package/config/manifests, README/CHANGELOG, canonical `TODO.md` and `docs/operations/v3-publication-status.md`. Device evidence is produced later at the real device/adoption boundary and remains separate from canonical task authority. Current SEO evolution evidence remains governed by its own canonical TODO tasks and exact-candidate gate.