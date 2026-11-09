# TODO — Canonical Execution Entry Point

**Status:** CANONICAL for active executable work  
**AI ExecutionKit version:** `[STANDARD_VERSION]`  
**Project profile:** `[PROFILE]`  
**TODO scaling mode:** `[S0|S1|S2]`  
**Last reconciled:** `[DATE / COMMIT]`

> This file alone owns mutable task state and remaining execution order. Code/tests/production remain truth for implementation reality. Terminal history belongs in configured task archives, never a second backlog.

## 0. Execution contract

- Every non-terminal executable requirement is represented here exactly once.
- Task IDs are immutable and never recycled.
- `.agents`, plans, audits, handoffs, State OS/runtime artifacts, external memory and OS docs do not own task status.
- `PLANNED` is not executable; work becomes eligible only after Definition of Ready promotes it to `READY`.
- `IMPLEMENTED`/`REVIEW_REQUIRED` are candidates, not completion.
- Required work reaches independent `ACCEPTED` before normal closure.
- `BLOCKED` requires a concrete blocker/unblock condition and remains visible until resolved or truthfully cancelled.
- `CANCELLED` requires rationale and does not satisfy dependencies by default.
- `VERIFIED` is a legacy compatibility alias for `ACCEPTED`; prefer `ACCEPTED` for new v2 tasks.
- Evidence must be reproducible before acceptance.
- Discovered independent work is mapped here before implementation.
- Progress is derived from canonical states; do not hand-maintain authoritative percentages.
- Declared executable lifecycle actions are `audit`, `document` and `deploy`. `Action: audit` MUST also declare `Audit Boundary: ad-hoc|wave|phase|release` and routes to the independent reviewer workflow. `Action: document` routes to executable Documentation Fabric; `Action: deploy` routes to Production Deployment Fabric under Launch OS. Audit Boundary is invalid on non-audit actions.
- Wave/phase audit gates are canonical tasks, not prose-only phase metadata. Dependent work MUST depend on the applicable accepted audit gate.
- When an audit gate finds executable remediation, create/map the remediation tasks here, keep the gate non-terminal, add the required remediation dependencies, and rerun the gate after those dependencies are accepted. Audit reports never become a second queue.
- **Deep integration is mandatory before product execution.** `EK00` prepares/reconciles the complete ExecutionKit control plane, including conditional SEO OS, cross-cutting State OS, critical-journey/integration truth and the cross-cutting Premium Experience construction invariant. Product work MUST remain dependency-blocked until `EK00-ACTIVATE` is accepted.
- **SEO applicability must be decided from actual surfaces.** Public organic-search surfaces require an explicit SEO contract/gate; API-only, authenticated/private, native-only or otherwise non-indexable products may resolve SEO as `NOT_APPLICABLE` with evidence instead of fake SEO work.
- **Premium Experience applicability must be decided before Audit owns any verdict.** UI-bearing web/Flutter/desktop scope requires the Premium 1.1 quality contract and real design/component authorities; genuinely non-UI products may resolve Premium Experience as `NOT_APPLICABLE` only with an evidence-backed reason. Audit independently challenges the established contract; it does not create or own the construction standard.
- **Context is disposable; repository state must be reconstructable.** State OS snapshots/memory are derived hints only. Rehydrate live repository/TODO/native authority before resumed mutation, and never use recalled task state as authority.
- Repository file presence is not proof of local MCP/editor/runner/device/runtime/Memory MCP activation. Setup tasks remain non-terminal until direct evidence exists or the requirement is truthfully `NOT_APPLICABLE`/externally blocked.
- **Task-by-task continuation is mandatory.** If no executable lifecycle action remains but dependency-satisfied `PLANNED` work exists, evaluate the earliest readiness candidate instead of ending the session. Never implement `PLANNED` directly.

### Capability matrix

| Capability | Level | Authority / file |
| --- | --- | --- |
| Execution | `[LITE|STANDARD|FULL]` | `docs/execution/EXECUTION_OS.md` |
| Agent | `[LITE|STANDARD|FULL]` | `docs/agent/AGENT_OS.md` + configured `.agents` manifest |
| Content | `[NONE|LITE|STANDARD|FULL]` | `[NONE or docs/content/CONTENT_OS.md]` |
| SEO | `[NONE|LITE|STANDARD|FULL]` | `[NONE or docs/seo/SEO_OS.md + executionkit.seo.json]` |
| Audit | `[LITE|STANDARD|FULL]` | `docs/audit/AUDIT_OS.md` |
| Test | `[LITE|STANDARD|FULL]` | `docs/testing/TEST_OS.md` |
| Launch | `[NONE|LITE|STANDARD|FULL]` | `[NONE or docs/launch/LAUNCH_OS.md]` |

Canonical capability levels are machine-readable in `execution.config.json`. **State OS is system #8 and is cross-cutting rather than capability-leveled**; its project authority is `docs/state/STATE_OS.md` and its runtime policy is configured under `state`. **Premium Experience is also cross-cutting but is not another OS or capability level**; its construction/evidence authority is `docs/quality/premium-experience.md` plus the project-native quality/design/component contracts.

## 1. Current state

- Active phase: `EK00`
- Active workstream: `Deep Integration`
- Release target: `[TARGET]`
- Current release candidate: `NONE`
- Execution mode: `SEQUENTIAL`
- Blocking condition: `Product execution is gated by EK00-ACTIVATE`

### Lifecycle-aware next action

Use:

```bash
node bin/validate-execution.mjs .
node bin/validate-deep-integration.mjs .
node bin/validate-state.mjs .
node bin/validate-seo.mjs .
node bin/state-rehydrate.mjs .
node bin/next-execution.mjs . --json
```

Default closure order is:

1. dependency-ready canonical `Action: audit` boundary gates;
2. source-grounded `Action: document` lifecycle work when dependency-ready;
3. independent review/revalidation of `IMPLEMENTED`/`REVIEW_REQUIRED` work;
4. `CORRECTION_REQUIRED` work;
5. resume `IN_PROGRESS` work;
6. inspect a `BLOCKED` task only when it declares an AI-actionable unblock action;
7. new dependency-ready `READY` implementation;
8. dependency-ready `Action: deploy` only after its explicit prerequisites/authorization boundary are satisfied.

If `next-execution` returns no action and `readinessCandidates` is non-empty, do **not** stop. Run:

```bash
node bin/next-readiness.mjs . --json
```

Inspect the earliest candidate's exact contract, current repository truth and project Definition of Ready. If DoR is satisfied, change only that canonical task from `PLANNED` to `READY`, run `node bin/validate-execution.mjs .`, checkpoint State OS, rerun `node bin/next-execution.mjs . --json`, and continue. If a real blocker prevents readiness, record it truthfully; never fabricate READY and never implement PLANNED directly.

An external/non-actionable blocker remains visible in closure reporting but MUST NOT starve independent `READY` work. Do not ignore audit/candidate/revalidation states just because open tasks exist.

## 2. Global blockers

`NONE`

Use a global blocker only when it actually affects multiple tasks. Task-local blockers belong on the affected task.

## 3. Phase index

| Phase | Name | Status | Contract | Gate |
| --- | --- | --- | --- | --- |
| EK00 | ExecutionKit Deep Integration | ACTIVE | `docs/adoption/deep-integration.md` | `EK00-AUDIT` / `EK00-ACTIVATE` |
| P00 | Product Foundation | PLANNED | `docs/execution/P00.md` | `P00-AUDIT` |
| P01 | `[NAME]` | PLANNED | `docs/execution/P01.md` | `P01-AUDIT` |

Phase status is navigational only; task state below is canonical.

## 4. Canonical tasks

### EK00 — ExecutionKit Deep Integration

<!-- TASK:EK00-001 -->
### EK00-001 — Capture repository and adoption baseline

- Status: READY
- Phase: EK00
- Priority: P0
- Depends: NONE
- Contract: docs/adoption/deep-integration.md#4-deep-integration-intake
- Requirements: NONE
- Verification: inspect branch/HEAD/status when locally observable; current ExecutionKit version; canonical TODO/native lifecycle; current frontier; `.agents`; seven capability authorities + State OS; native validators; CI/platforms; quality/tool/editor/release surfaces; public/indexable search surfaces; user-facing UI surfaces and native design/component authorities; write/update `docs/executionkit/ADOPTION.md`
- Evidence: PENDING

Objective: establish evidence-first repository truth and explicit preservation/adoption boundaries before any control-plane or product mutation.
<!-- /TASK -->

<!-- TASK:EK00-002 -->
### EK00-002 — Install or upgrade current managed ExecutionKit runtime

- Status: PLANNED
- Phase: EK00
- Priority: P0
- Depends: EK00-001
- Contract: docs/adoption/deep-integration.md#6-managed-runtime-and-tools
- Requirements: NONE
- Verification: current VERSION/config baseline; supported project-local `bin/`, `lib/`, State OS, SEO OS and Premium Experience quality tools/schemas/contracts plus manual self-hosted workflow present; managed conflicts reconciled explicitly; native tooling/design/component authorities preserved where stronger
- Evidence: PENDING

Objective: converge the repository on the current supported managed runtime without random partial copying, destructive native replacement or manufactured task progress.
<!-- /TASK -->

<!-- TASK:EK00-002T -->
### EK00-002T — Bootstrap tools and the host before studying the project

- Status: PLANNED
- Phase: EK00
- Priority: P0
- Depends: EK00-002
- Tags: tooling-bootstrap, mcp, agent, state
- Contract: docs/adoption/deep-integration.md#7-mcp-tooling-and-editor-integration
- Verification: inspect installed runtime receipt; run `node bin/setup-tooling.mjs .` and apply only missing required dependencies; discover the configured MCP tools and perform real read-only calls; register the actual host adapter when used; inspect nested framework manifests to identify applicable Laravel/Flutter tools; record missing tools as NOT_RUN/blocked, never PASS
- Evidence: PENDING

Objective: establish usable repository-reading/runtime tools before project study. If the installer already supplied matching core files, verify their receipt/import closure instead of reinstalling the kit. Optional external tools must have truthful applicability; do not deploy or execute product changes.
<!-- /TASK -->

<!-- TASK:EK00-002S -->
### EK00-002S — Study native plans and actual implementation before system reconciliation

- Status: PLANNED
- Phase: EK00
- Priority: P0
- Depends: EK00-002T
- Tags: project-study, planning, architecture, discovery
- Contract: docs/adoption/deep-integration.md#4-deep-integration-intake
- Verification: read the generated intake and every relevant native plan/authority; inspect existing code, branches and task/evidence history; map actors, surfaces, journeys, data, integrations, constraints and current frontier to exact source references; classify M0-M4 independently of adoption mode; document contradictions/missing decisions in canonical TODO; map all seven capability authorities and cross-cutting State OS to actual project needs; independent reviewer checks the study against the source
- Evidence: PENDING

Objective: understand what this specific project is, what already exists and what remains before choosing architecture/product work. Generic project summaries and remembered completion percentages do not satisfy this task. Preserve stronger native plans/contracts and make the selected maturity profile explicit.
<!-- /TASK -->

<!-- TASK:EK00-003 -->
### EK00-003 — Reconcile Execution OS and canonical task adapter

- Status: PLANNED
- Phase: EK00
- Priority: P0
- Depends: EK00-002S
- Contract: docs/adoption/deep-integration.md#execution-os
- Requirements: NONE
- Verification: `node bin/validate-execution.mjs .` + task/state/dependency/archive/projection/scheduler review; native source hashes verified when projection-json is used
- Evidence: PENDING

Objective: make the sole task authority, lifecycle semantics, dependency graph, audit lanes, integration gating and sequential scheduler deterministic for this project.
<!-- /TASK -->

<!-- TASK:EK00-003I -->
### EK00-003I — Reconcile critical journeys, integration seams and phase convergence

- Status: PLANNED
- Phase: EK00
- Priority: P0
- Depends: EK00-003
- Tags: integration, journeys, e2e, black-box, execution, audit, test, launch
- Contract: executionkit.integration.json
- Requirements: NONE
- Verification: inspect actual actors/surfaces/business flows and shared state; resolve `executionkit.integration.json` as REQUIRED or evidence-backed NOT_APPLICABLE; declare every release-critical journey with member task IDs, canonical phase/release gate, concrete required scenario IDs, black-box/runtime verification mode and scenario-scoped trusted evidence producer; verify every multi-task phase has a convergence gate that transitively covers its denominator; bind `releaseGateTask` to the canonical whole-system release audit gate
- Evidence: PENDING

Objective: make end-to-end product behavior and cross-component integration machine-visible before implementation expands, so isolated task acceptance can never substitute for coherent system acceptance.
<!-- /TASK -->

<!-- TASK:EK00-004 -->
### EK00-004 — Reconcile Agent OS and all project specialist resources

- Status: PLANNED
- Phase: EK00
- Priority: P0
- Depends: EK00-003I
- Contract: docs/adoption/deep-integration.md#agent-os
- Requirements: NONE
- Verification: run/reconcile `node bin/adopt-project.mjs --target . --apply --json` from the current ExecutionKit distribution when managed Agent resources/routes are missing, then `node bin/validate-agents.mjs .` + `node bin/coordinate-agents.mjs . --dry-run`; preserved project roles/skills/rules/workflows/contracts/templates registered; implementation/review/audit/blocker routing sampled; reviewer separation proven; State OS behavior, applicable SEO specialists, Documentation Fabric `route.documentation`, Production Deployment `route.deployment`, and UI-stack `design-system → component-system → premium-experience` resources reachable through deterministic routing
- Evidence: PENDING

Objective: ensure the project-specific Agent layer is not merely present but machine-routable, dependency-valid and composed with current ExecutionKit specialists.
<!-- /TASK -->

<!-- TASK:EK00-004S -->
### EK00-004S — Reconcile State OS, context recovery and durable-memory bridge

- Status: PLANNED
- Phase: EK00
- Priority: P0
- Depends: EK00-004
- Contract: docs/state/STATE_OS.md
- Requirements: NONE
- Verification: `node bin/validate-state.mjs .`; create/reconcile a real checkpoint with `node bin/state-checkpoint.mjs . --reason deep-integration`; `node bin/state-rehydrate.mjs .`; `node bin/state-amnesia-test.mjs .`; State MCP tools discoverable when MCP is required; Memory MCP/equivalent policy is `ADVISORY_ONLY` and live-revalidated; task state remains owned solely by canonical authority
- Evidence: PENDING

Objective: prove multi-hour/multi-day execution can survive context compaction, interruption, model/agent/device handoff and stale remembered state by reconstructing truth from the live repository plus non-authoritative State OS artifacts.
<!-- /TASK -->

<!-- TASK:EK00-005 -->
### EK00-005 — Reconcile Content OS to actual product content scope

- Status: PLANNED
- Phase: EK00
- Priority: P0
- Depends: EK00-004S
- Contract: docs/adoption/deep-integration.md#content-os
- Requirements: NONE
- Verification: applicable native content authorities + `node bin/discover-content.mjs .` + `node bin/validate-content-depth.mjs .`; source/provenance/rights/localization/editorial/media/search/offline/AI concerns explicitly configured or justified N/A
- Evidence: PENDING

Objective: make Content OS project-specific and executable instead of a generic capability label or empty template.
<!-- /TASK -->

<!-- TASK:EK00-005D -->
### EK00-005D — Build and validate executable project Documentation & Knowledge Fabric

- Status: PLANNED
- Phase: EK00
- Priority: P0
- Depends: EK00-005
- Tags: documentation, docs, knowledge-base, architecture-docs, runbook, repository-intelligence
- Action: document
- Contract: contracts/documentation-fabric-contract.md
- Requirements: NONE
- Verification: `node bin/documentation-fabric.mjs build .` + `node bin/documentation-fabric.mjs validate .`; generated KB covers the full default denominator: overview, architecture, components, domains, features, business rules, workflows, events/jobs, interfaces/APIs, data/persistence, auth/roles/permissions, integrations, configuration/environment, storage/files, search/cache, notifications/messaging, payments/money, security, testing, deployment, operations, architecture decisions, known limitations and glossary; every generated document has source references/fingerprint; manual docs preserved; Agent documentation route/resource reachability proven; documentation.requiredForRelease policy explicitly reconciled
- Evidence: PENDING

Objective: make full project documentation and its knowledge base executable, source-grounded and freshness-gated so agents cannot satisfy documentation merely by having Content/Launch OS Markdown files present.
<!-- /TASK -->

<!-- TASK:EK00-005S -->
### EK00-005S — Reconcile SEO OS applicability, search architecture and search-surface contracts

- Status: PLANNED
- Phase: EK00
- Priority: P0
- Depends: EK00-005D
- Tags: seo, seo-discovery, seo-planning, seo-architecture, public-web
- Contract: docs/adoption/deep-integration.md#seo-os
- Requirements: NONE
- Verification: inspect actual public/indexable surfaces and rendering model; reconcile `executionkit.seo.json`; `node bin/validate-seo.mjs .`; applicable page families have intent/index/canonical/value/internal-link/structured-data/localization/performance rules; local/ecommerce/marketplace/directory/international/programmatic modes enabled only when real; non-search projects record evidence-backed `NOT_APPLICABLE`; Agent SEO resources are registered and routable
- Evidence: PENDING

Objective: decide SEO applicability before implementation expands public routes, and establish search architecture as an executable contract rather than a launch-time metadata checklist.
<!-- /TASK -->

<!-- TASK:EK00-005P -->
### EK00-005P — Reconcile Premium Experience applicability and product design/component authorities

- Status: PLANNED
- Phase: EK00
- Priority: P0
- Depends: EK00-005S
- Tags: premium, ui, ux, design-system, component-system, accessibility, responsive, web-ui, flutter, desktop
- Contract: docs/quality/premium-experience.md
- Requirements: NONE
- Verification: inspect actual user-facing web/Flutter/desktop surfaces and roles; resolve `premiumExperience.applicability`; UI-bearing scope requires `REQUIRED` + quality schema `1.1.0`/`premium`; genuinely non-UI scope requires `NOT_APPLICABLE` + standard quality + evidence-backed reason; reconcile/preserve project-native token/design/component authorities, canonical component registry, extend-before-create and shrink-only legacy debt; map real state/form-factor/direction/input/theme/native-behavior matrices; require production-shaped data and anti-generic review; `node bin/validate-quality.mjs .`; `node bin/validate-agents.mjs .`; prove applicable `design-system → component-system → premium-experience` routing without relying on a literal `premium` tag
- Evidence: PENDING

Objective: establish Premium Experience as a fail-closed construction invariant before Audit reviews it, preserving stronger project-native design/component systems and preventing generic/basic UI debt from becoming the implementation baseline.
<!-- /TASK -->

<!-- TASK:EK00-006 -->
### EK00-006 — Reconcile Audit OS and independent product/search quality review

- Status: PLANNED
- Phase: EK00
- Priority: P0
- Depends: EK00-005P
- Contract: docs/adoption/deep-integration.md#audit-os
- Requirements: NONE
- Verification: current Audit OS boundary protocol reconciled; independently review the already-established Premium Experience contract, rendered UI/UX criteria, canonical component consumption, design drift, accessibility/RTL/LTR, native behavior, content/SEO regressions and AI-generic/basic/poor rejection dimensions; findings map back to canonical TODO and Audit never becomes the construction authority or a shadow backlog
- Evidence: PENDING

Objective: configure evidence-first deep/honest/full audits that independently challenge the product/design/search quality contracts established earlier instead of defining or owning Premium construction themselves.
<!-- /TASK -->

<!-- TASK:EK00-007 -->
### EK00-007 — Reconcile Test OS, native verification and evidence adapters

- Status: PLANNED
- Phase: EK00
- Priority: P0
- Depends: EK00-006
- Contract: docs/adoption/deep-integration.md#test-os
- Requirements: NONE
- Verification: native tests/build/analyze/lint commands preserved; ExecutionKit adapters/test adequacy configured for applicable Laravel/Flutter/browser/device/accessibility/visual/SEO/performance/security/data/offline/sync/money surfaces; Premium rendered/component/design/native requirements mapped to executable evidence where applicable; SEO contract validation separated from optional Lighthouse/runtime evidence; exact candidate/environment evidence policy reviewed
- Evidence: PENDING

Objective: establish truthful targeted task/wave verification and final corrected-phase candidate CI without replacing stronger native quality gates.
<!-- /TASK -->

<!-- TASK:EK00-008 -->
### EK00-008 — Reconcile Launch OS and release-candidate controls

- Status: PLANNED
- Phase: EK00
- Priority: P0
- Depends: EK00-007
- Contract: docs/adoption/deep-integration.md#launch-os
- Requirements: NONE
- Verification: candidate identity, environments/config ownership, migrations/backups/restore/rollback, signing/store/deployment/provider boundaries, observability/health/stabilization and release-readiness requirements configured or truthfully N/A; applicable SEO release gate and required Premium quality evidence are candidate-bound; missing/failed/not-run/stale required Premium evidence blocks release
- Evidence: PENDING

Objective: make release truth exact-candidate and environment bound before product implementation begins relying on deployment assumptions.
<!-- /TASK -->

<!-- TASK:EK00-008D -->
### EK00-008D — Reconcile executable Production Deployment Fabric and production artifact policy

- Status: PLANNED
- Phase: EK00
- Priority: P0
- Depends: EK00-008
- Tags: deployment, deploy, production, launch, release-artifact, rollback, runtime-health
- Action: deploy
- Contract: contracts/production-deployment-contract.md
- Requirements: NONE
- Verification: configure `deployment` target/policy or record a truthful external blocker/N/A; `node bin/production-deployment.mjs plan-artifact .`; inspect hard exclusions for docs/ExecutionKit/Agent/tests/TODO/secrets; build/validate a current production artifact when the project has a deployable runtime; shared production paths, migration/runtime pre/post commands, smoke, health and rollback path are explicit; when a real production target is authorized, deploy the exact artifact and verify the activated release with current smoke/health evidence before release-state claims; Agent deploy route/resource reachability proven; deployment.requiredForRelease policy reconciled
- Evidence: PENDING

Objective: establish a real production deployment contract before launch work: only runtime-required bytes may leave the repository, target identity and authority are explicit, and deployment/smoke/health/rollback are executable rather than prose-only Launch OS guidance.
<!-- /TASK -->

<!-- TASK:EK00-009 -->
### EK00-009 — Install and smoke-test MCP, tooling and applicable integrations

- Status: PLANNED
- Phase: EK00
- Priority: P0
- Depends: EK00-008D
- Contract: docs/adoption/deep-integration.md#7-mcp-tooling-and-editor-integration
- Requirements: NONE
- Verification: `node bin/setup-tooling.mjs .` then `--apply`; `node bin/mcp-server.mjs .` startup/tool discovery including `executionkit_state_*`, `executionkit_seo_*`, `executionkit_documentation_*` and `executionkit_deployment_*`; Antigravity integration when used; Laravel Boost and Dart MCP adapters evaluated for applicable stacks; browser/render tooling installed only where required by Premium/Test evidence; external Memory MCP capability evaluated when available; runtime evidence or truthful N/A/blocker recorded
- Evidence: PENDING

Objective: prove required MCP/tool/editor/framework integrations are actually usable in the execution environment rather than merely represented by files.
<!-- /TASK -->

<!-- TASK:EK00-010 -->
### EK00-010 — Reconcile manual self-hosted CI and platform evidence policy

- Status: PLANNED
- Phase: EK00
- Priority: P0
- Depends: EK00-009
- Contract: docs/adoption/deep-integration.md#8-ci-policy
- Requirements: NONE
- Verification: `node bin/validate-ci-policy.mjs .`; workflow_dispatch-only, project-specific self-hosted label, no hosted fallback/push autorun, one runner per project/device, required macOS/Windows platform expectations and observed runner evidence boundary recorded
- Evidence: PENDING

Objective: ensure CI orchestration matches the project and never turns missing physical runner/runtime evidence into PASS.
<!-- /TASK -->

<!-- TASK:EK00-011 -->
### EK00-011 — Reconcile discovered product, scope, component, design, content and search gaps

- Status: PLANNED
- Phase: EK00
- Priority: P0
- Depends: EK00-010
- Contract: docs/adoption/deep-integration.md#6-managed-runtime-and-tools
- Requirements: NONE
- Verification: `node bin/discover-product.mjs .`; `node bin/reconcile-product.mjs .`; `node bin/build-coverage-graph.mjs .`; quality/component/design/content/SEO validators; reconcile actual UI surface/component/design inventories against the Premium contract; every independent executable gap mapped back into this canonical TODO without a shadow backlog
- Evidence: PENDING

Objective: establish a current repository denominator and reconcile every independent control/product/search-quality gap before the integration gate.
<!-- /TASK -->

<!-- TASK:EK00-AUDIT -->
### EK00-AUDIT — Independently audit the complete deep integration

- Status: PLANNED
- Phase: EK00
- Priority: P0
- Depends: EK00-011
- Action: audit
- Audit Boundary: phase
- Tags: phase-audit, deep-audit, honest-audit, full-audit, integration, quality, premium, acceptance, seo
- Contract: docs/adoption/deep-integration.md#12-deep-integration-completion-evidence
- Requirements: NONE
- Verification: `node bin/validate-component-system.mjs . --audit --boundary=phase` + `node bin/validate-quality.mjs .` + `node bin/validate-execution.mjs .` + `node bin/validate-agents.mjs .` + `node bin/validate-state.mjs .` + `node bin/validate-seo.mjs .` + `node bin/documentation-fabric.mjs validate .` + `node bin/production-deployment.mjs readiness .` when deployment is required/configured + `node bin/state-amnesia-test.mjs .` + all applicable native/rendered/browser/device/tooling checks + independent evidence-first review of every deep-integration row
- Evidence: PENDING

Objective: prove the seven capability authorities, State OS, Premium construction contract, managed runtime, project Agent routing, quality/search contracts, MCP/tooling, CI policy, discovery and product-frontier gate are coherently integrated without hidden missing/poor/generic/unverified surfaces.
<!-- /TASK -->

<!-- TASK:EK00-ACTIVATE -->
### EK00-ACTIVATE — Activate the integrated project and release product execution

- Status: PLANNED
- Phase: EK00
- Priority: P0
- Depends: EK00-AUDIT
- Contract: docs/adoption/deep-integration.md#13-agent-start-contract
- Requirements: NONE
- Verification: `node bin/activate-project.mjs .` dry run then `node bin/activate-project.mjs . --apply`; post-activation Execution/Agent/State/SEO/Premium/CI/deep-integration validation; State rehydration + Amnesia Test; confirm product routing remains blocked while this activation task awaits independent acceptance; after this task is accepted, `node bin/next-readiness.mjs . --json` may nominate the earliest product task for DoR evaluation and `node bin/next-execution.mjs . --json` may select dependency-ready product work
- Evidence: PENDING

Objective: set `projectState=ACTIVE` only after deep-integration acceptance, transition the first valid product frontier through Definition of Ready, and make the repository self-contained enough for the operator to say only “start from TODO and execute task by task” even across context resets or model/agent handoffs.
<!-- /TASK -->

### P00 — Product Foundation

<!-- TASK:EX-0001 -->
### EX-0001 — `[OUTCOME-ORIENTED PRODUCT TITLE]`

- Status: PLANNED
- Phase: P00
- Priority: P0
- Depends: EK00-ACTIVATE
- Journey: `[J-PRIMARY]`
- Integrates With: `[task IDs / shared contracts / external seams]`
- Contract: docs/execution/P00.md#ex-0001
- Requirements: `[REQ-... | NONE]`
- Verification: `[TST-... / command / reference]`
- Evidence: PENDING

Objective: `[Concise required product outcome.]`
<!-- /TASK -->

<!-- TASK:W01-AUDIT -->
### W01-AUDIT — Audit the first bounded product wave

- Status: PLANNED
- Phase: P00
- Priority: P0
- Depends: EX-0001
- Action: audit
- Audit Boundary: wave
- Tags: wave-audit, quality, acceptance
- Contract: docs/execution/P00.md#wave-plan
- Requirements: NONE
- Verification: `node bin/validate-component-system.mjs . --audit --boundary=wave` + applicable native targeted checks/rendered review
- Evidence: PENDING

Objective: independently audit W01 current implementation, integration seams and applicable premium/component quality before dependent work proceeds.
<!-- /TASK -->

<!-- TASK:EX-0002 -->
### EX-0002 — `[SECOND OUTCOME-ORIENTED PRODUCT TITLE]`

- Status: PLANNED
- Phase: P00
- Priority: P1
- Depends: W01-AUDIT
- Journey: `[J-PRIMARY]`
- Integrates With: `EX-0001, [other task IDs / shared contracts]`
- Contract: docs/execution/P00.md#ex-0002
- Requirements: `[REQ-... | NONE]`
- Verification: `[TST-... / command / reference]`
- Evidence: PENDING

Objective: `[Concise required product outcome.]`
<!-- /TASK -->

<!-- TASK:P00-AUDIT -->
### P00-AUDIT — Full product phase boundary audit and final phase gate

- Status: PLANNED
- Phase: P00
- Priority: P0
- Depends: EX-0002
- Action: audit
- Audit Boundary: phase
- Journey Gate: `[J-PRIMARY and every release-critical P00 journey]`
- Verification Mode: `black-box, integration, runtime`
- Tags: phase-audit, deep-audit, quality, acceptance, release
- Contract: docs/execution/P00.md#phase-boundary-audit
- Requirements: NONE
- Verification: `node bin/validate-component-system.mjs . --audit --boundary=phase` + full applicable A2 audit/remediation + manual self-hosted CI on the final corrected candidate
- Evidence: PENDING

Objective: prove the complete P00 denominator, rendered/runtime quality, finding closure and final corrected-candidate CI before phase closure.
<!-- /TASK -->

<!-- TASK:REL-AUDIT -->
### REL-AUDIT — System release convergence and black-box acceptance

- Status: PLANNED
- Phase: RELEASE
- Priority: P0
- Depends: P00-AUDIT
- Action: audit
- Audit Boundary: release
- Journey Gate: `all release-critical journeys`
- Verification Mode: `black-box, integration, runtime`
- Tags: release, convergence, integration, evidence
- Contract: docs/launch/LAUNCH_OS.md
- Requirements: NONE
- Verification: update this task's dependencies during planning so it transitively covers every non-cancelled active phase denominator/gate; require every release-critical journey's concrete scenarios to be covered by executable black-box/runtime/browser/device/integration producers; run `node bin/validate-integration.mjs . --release`, exact-candidate trusted evidence collection, `node bin/analyze-revalidation.mjs . --require-clear`, applicable full Test/Audit/Launch gates and authorized black-box production/runtime verification
- Evidence: PENDING

Objective: converge the complete product candidate so individually accepted phases and tasks cannot be mistaken for a coherent releasable system.
<!-- /TASK -->

## 5. Recurring operations

Recurring work is represented here only when it has a concrete current occurrence requiring execution. Pure cadence documentation belongs in the owning OS runbook, not as permanently open fake tasks.

State OS heartbeats are runtime continuity events, not recurring TODO tasks.

## 6. Archive policy

- Only configured semantic terminal states (`ACCEPTED`, legacy alias `VERIFIED`, `RELEASED`, or justified `CANCELLED`) may leave the active TODO.
- Use `node bin/archive-todo.mjs .` first for a dry run and `node bin/archive-todo.mjs . --apply` after inspection.
- Move the complete canonical task block without rewriting ID, contract, dependencies or evidence.
- Archive partitions remain visible to global ID/dependency/evidence validation.
- Never archive a blocker, candidate or audit/integration gate merely to reduce active-file size.
