# Deep Integration Protocol — AI ExecutionKit v3.x

This document defines the required project-integration procedure when AI ExecutionKit is introduced to a new repository or upgraded in an existing repository. It is an adoption/control-plane protocol, not a product backlog.

## 1. Core rule

Installing files is not adoption.

A project is deeply integrated only when the current repository truth has been reconciled into all applicable ExecutionKit authorities, the project-specific Agent layer is routable, cross-cutting State OS continuity is reconstructable, project-local managed tools are current, configured integrations have been structurally installed, and the canonical task authority prevents product execution from bypassing the integration gate.

`TODO.md`, or a preserved native task authority with a deterministic projection, remains the only mutable execution authority. State snapshots, journals, handoffs, plans and external memory remain derived/advisory and MUST NOT become shadow task state.

### Maturity classification is mandatory

Before selecting the detailed integration procedure, classify the target using `docs/adoption/deep-integration-profiles/README.md` as exactly one current maturity profile:

- `M0_PLANNING_ONLY`
- `M1_EARLY_IMPLEMENTATION`
- `M2_ACTIVE_DEVELOPMENT`
- `M3_NEAR_COMPLETE`
- `M4_PRODUCTION`

**Maturity is orthogonal to adoption mode.** Adoption mode controls preservation/migration strategy; maturity controls applicability, frontier gating, evidence depth and activation safety. Record both in the adoption record.

Do not classify from a remembered percentage or chat description. Inspect live repository/runtime/release evidence. When uncertain, choose the more preservation-heavy/evidence-heavy profile; production requires observable production evidence.

## 2. The mandatory integration phase

Every new adoption and every material upgrade that changes runtime/authority semantics MUST create or reconcile a canonical integration phase before the relevant current product-execution frontier. The recommended phase ID is `EK00`.

The integration phase MUST be represented by real canonical tasks, with dependencies and evidence. It MUST NOT live only in README, an adoption report, `.agents`, State OS, external memory, an audit report, a handoff, or an issue.

For a canonical-block TODO, the default sequence is:

1. `EK00-001` — capture repository/adoption baseline, maturity profile and preservation boundaries;
2. `EK00-002` — install/upgrade managed runtime, schemas and project-local commands;
3. `EK00-003` — reconcile Execution OS, lifecycle semantics, task adapter/projection and scheduler;
4. `EK00-004` — reconcile Agent OS roles, skills, rules, workflows, contracts, templates, routing and reviewer separation;
5. `EK00-004S` — reconcile State OS, context recovery, semantic checkpoints, Amnesia Test and advisory durable-memory bridge;
6. `EK00-005` — reconcile Content OS to real project content scope, provenance, localization and content-quality needs;
7. `EK00-005D` — build/validate the executable Documentation & Knowledge Fabric and source-grounded project knowledge base;
8. `EK00-005S` — reconcile SEO OS applicability, search architecture, search-surface contracts and specialized search modes;
9. `EK00-006` — reconcile Audit OS, audit boundaries, product-quality policy, premium UI/UX and component/design/search contracts;
10. `EK00-007` — reconcile Test OS, native tests, adapters, test adequacy, browser/device/search evidence and exact-candidate evidence policy;
11. `EK00-008` — reconcile Launch OS, environments, candidate identity, rollback, release readiness and applicable SEO release gates;
12. `EK00-008D` — configure executable Production Deployment Fabric, production artifact allowlist, target/shared-runtime policy, smoke/health and rollback path;
13. `EK00-009` — install/configure MCP and applicable tooling/editor/framework adapters, including State/SEO MCP tools and Memory MCP policy where available;
14. `EK00-010` — reconcile manual self-hosted CI policy and runner/platform requirements;
15. `EK00-011` — execute discovery, scope/component/content/design/search reconciliation and map independent gaps to the canonical TODO;
16. `EK00-AUDIT` — independent deep phase audit of the integrated control plane (`Action: audit`, `Audit Boundary: phase`);
17. `EK00-ACTIVATE` — activate normal ExecutionKit-controlled product execution only after the audit gate and all profile-required evidence pass.

Projects MAY add project-specific integration tasks, but MUST NOT remove a dimension merely because a generic file exists. Profile-specific playbooks determine whether a dimension is currently implemented/applicable, planned with a transition rule, unavailable/blocking, or requires production-grade evidence. SEO may be `NOT_APPLICABLE`, but only after actual public/indexable surfaces and rendering/deployment boundaries are inspected; absence of an SEO plan is not itself proof of non-applicability.

## 3. Product-frontier blocking

The integration activation boundary MUST gate every current non-terminal frontier root that could otherwise bypass deep integration.

The exact scope depends on maturity:

- **M0:** normally gate all non-terminal product work because material product implementation has not started.
- **M1:** gate the current early product frontier while preserving real implemented/partial work.
- **M2:** gate all independent current non-terminal frontier roots; preserve historical terminal work and active partial evidence.
- **M3:** gate the remaining acceptance/release frontier; do not reopen completed history merely to add ancestry.
- **M4:** gate the next current/future maintenance/change/release frontier; never reconstruct historical production releases into a new backlog.

For active/mature repositories:

- preserve terminal history and evidence;
- preserve `IN_PROGRESS`, implemented, review and correction evidence instead of resetting work;
- identify every live non-terminal execution root;
- insert the integration dependency where needed to prevent bypass;
- if a task was READY but gains a real unsatisfied integration prerequisite, represent the new non-executable condition truthfully under the native lifecycle;
- record the change as an adoption prerequisite, not loss of completed implementation.

A native task system that cannot express this safely MUST use a deterministic projection or adapter. Do not destructively rewrite rich native task storage only to fit generic Markdown blocks.

## 4. Deep integration intake

Before writing anything, inspect and record:

- repository/default/current branch, HEAD and observable remote/local/worktree state;
- existing ExecutionKit version/baseline and adoption history;
- selected maturity profile with live evidence and selected adoption mode with rationale;
- canonical task authority, syntax, states, dependencies, archives and current frontier;
- all existing Execution/Agent/Content/SEO/Audit/Test/Launch documents and stronger native equivalents;
- existing State OS/runtime checkpoint/recovery/memory surfaces and whether they are actually usable;
- `.agents` resources and any native agent/router/plugin/editor system;
- stack/runtime/package manifests and current product implementation state;
- current implementation denominator: routes/screens/APIs/jobs/models/components/content/tests as applicable;
- public, authenticated/private and native-only surfaces; rendering model; current robots/sitemap/canonical/locale/search behavior where public web exists;
- native build/test/lint/analyze/validation commands and known failures/flakes/skips;
- CI triggers, project runner labels, platform matrix and artifact/evidence policy;
- quality/design/component/content/search contracts and visual-reference systems;
- security/data/offline/money/authorization/observability requirements;
- MCP/editor/framework integrations already present or required, including external Memory MCP if the host exposes one;
- release environments, signing/secrets ownership, rollback and operational runbooks;
- for M4, observable current production release/deployment/health/search-indexability evidence and explicit unknowns.

Never infer local MCP activation, Memory MCP availability, runner registration, installed packages, devices, credentials, production health or search-engine indexing from repository files alone.

## 5. Seven capability authorities + State OS

### Execution OS

Deep integration MUST configure or preserve:

- one canonical mutable task authority;
- immutable task IDs and explicit dependency semantics;
- state mapping to v2 semantic lifecycle without manufactured completion;
- deterministic task adapter (`canonical-blocks` or `projection-json`);
- archive and cancellation semantics;
- dependency-safe parallel scheduling for explicitly independent implementation/resume work, with deterministic sequential fallback;
- correction/review/blocker/audit lanes;
- wave/phase audit gates and integration gate;
- interruption/recovery/checkpoint rules;
- project-specific phase/workstream contracts;
- maturity-correct frontier ancestry that preserves historical work.

### Agent OS

Deep integration MUST classify `.agents` as missing/partial/mature and then:

- install the current managed Agent foundation or overlay;
- preserve stronger project-native roles/skills/rules/workflows/contracts/templates;
- register every retained executable resource in the machine-readable manifest;
- reconcile duplicate/overlapping resources deliberately;
- route implementation, correction, review, audit and blockers deterministically;
- preserve independent reviewer ownership;
- compose stack/domain skills from real task tags;
- register and route State OS rehydration behavior through normal task-context/runtime/handoff dependency expansion;
- register and route applicable SEO discovery/planning/architecture/technical/specialized/gate resources through task tags rather than relying on file presence;
- validate references, skill dependencies/conflicts and routing;
- keep Agent OS task-state-free.

File presence alone is not sufficient: the manifest and routing must make the project resources reachable. `registered == integrated` is forbidden.

### State OS — cross-cutting system #8

State OS is mandatory for current deep integration and is **not capability-leveled**. It MUST preserve the principle:

> **Context is disposable. Repository state is reconstructable.**

Deep integration MUST prove:

- `docs/state/STATE_OS.md` or a preserved stronger compatible project authority exists;
- State configuration keeps snapshot/journal paths under `.executionkit/` and treats them as derived non-authoritative state;
- `TODO.md`/native task authority remains the sole mutable backlog/status authority;
- `BOOT → REHYDRATE → VERIFY → RESUME` is the resume protocol at session start, interruption, context compaction, restart, model/agent change and device handoff;
- rehydration compares live branch/HEAD/worktree, canonical task authority, execution config, Agent manifest/route, implementation and relevant evidence against the latest checkpoint;
- live repository/canonical truth wins every conflict with a checkpoint or recalled memory;
- semantic checkpoints occur at lifecycle/task transitions and meaningful long-task milestones, with heartbeat bounded by configured policy;
- checkpoints preserve interrupted dirty work rather than resetting it for convenience;
- external Memory MCP/equivalent is `ADVISORY_ONLY`, requires live revalidation and cannot own task status, queues, secrets or current PASS/release claims;
- normal Agent routes mechanically reach the State rehydration skill; a registered but unreachable State resource fails integration;
- `node bin/state-amnesia-test.mjs .` passes after a fresh reconciled checkpoint, proving a zero-conversation agent can reconstruct the current safe execution position.

State OS complements Runtime checkpoints: Runtime owns recoverable state for the currently claimed canonical work/batch; State OS carries reconstructable cross-session/context continuity around it. Neither owns canonical task state.

### Content OS

Content OS is configured from actual product scope. Where applicable it MUST cover:

- content inventory/types/surfaces;
- source/provenance/rights/freshness;
- localization, RTL/LTR and long-copy behavior;
- media/assets and placeholder/demo rejection;
- editorial/review/publication/revocation lifecycle;
- content semantics consumed by internal search, SEO, offline and AI experiences where applicable;
- content-depth evidence and project-specific specialist skills.

Content OS owns what the product says and whether that content is complete/correct/maintainable. It does not own crawl/index/canonical/search-intent architecture merely because content participates in search.

`content=FULL` with a generic template and no project reconciliation is not deep integration.

### SEO OS

SEO OS is a first-class **conditional capability authority**. It is applicable when the project has public surfaces intended to acquire organic search traffic; it may resolve `NOT_APPLICABLE` for API-only, authenticated/private, native-only or intentionally non-indexable products after evidence-backed inspection.

Deep integration MUST reconcile:

- `capabilities.seo` depth and `executionkit.seo.json` profile without silent mismatch;
- `AUTO|ENABLED|DISABLED` applicability and explicit rationale when disabled;
- public search surface/page-family inventory rather than ad-hoc individual-page metadata;
- search intent, entity/topic mapping, route/URL architecture and index/noindex policy;
- canonical/redirect/status/robots/sitemap/pagination/facet/filter behavior;
- rendered HTML/search accessibility for the actual rendering stack;
- internal-link architecture and orphan-page prevention;
- title/meta/heading/media/breadcrumb semantic rules where they affect search surfaces;
- structured-data eligibility and registry without fabricating unsupported rich-result claims;
- localization/hreflang/canonical coordination when multilingual/international search is real;
- local SEO, ecommerce, marketplace, directory, editorial/media and programmatic modes only when the product actually needs them;
- programmatic search surfaces fail-closed: distinct intent, visible value, coverage thresholds and empty/thin duplicate protection precede index eligibility;
- mobile rendering and search-facing performance budgets without conflating Lighthouse with the whole SEO authority;
- task/wave/phase/release/production/operations gates at the configured depth;
- current candidate binding for release-critical SEO contract evidence;
- monitoring signals and post-launch regressions where operations monitoring is enabled.

`node bin/validate-seo.mjs .` is the structural/applicability contract validator. `node bin/validate-seo-performance.mjs .` remains an optional runtime/performance adapter and MUST NOT be treated as the SEO OS authority by itself. Rankings, indexing, rich results and traffic are external outcomes and are never guaranteed by a passing repository validator.

### Audit OS

Audit OS MUST configure:

- evidence-first deep/honest/full audit semantics;
- A1 wave, A2 phase and A3 release boundaries;
- finding severity/ownership/remediation mapping back to TODO;
- rendered/contextual product review where required;
- premium UI/UX rejection criteria;
- reusable component-system conformance for Blade/Livewire, Web Components and/or Flutter as applicable;
- design-token/drift checks;
- AI-generic/basic/poor UI review signals;
- security/data/content/SEO/release audit dimensions required by the product.

State checkpointing occurs before/after material audit boundaries so audit context can be reconstructed, but State OS never turns a stale audit result into current acceptance evidence.

M2/M3/M4 integration MUST audit pre-existing implementation sufficiently to expose material existing gaps; M3/M4 require release/production-sensitive evidence rather than planning-only inference.

### Test OS

Test OS MUST reconcile native and ExecutionKit evidence instead of replacing stronger native tests. Configure as applicable:

- unit/integration/feature/regression suites;
- Laravel/PHP and Flutter/Dart analyzer/test commands;
- browser E2E, accessibility and visual regression;
- device/emulator/native-platform evidence;
- SEO contract/gate checks plus optional Lighthouse/search-facing performance evidence;
- security/data migration/offline/sync/money integrity tests;
- test-report adapter and minimum applicable test adequacy;
- retry/skip/flake policy;
- exact candidate/environment evidence;
- targeted task/wave checks versus expensive final phase CI.

State OS may retain exact evidence references/candidate context for resume only. Previous PASS evidence never becomes current merely because a State snapshot remembers it.

M0 MAY truthfully use `NOT_IMPLEMENTED`/`NOT_APPLICABLE` for product runtimes that do not exist, but MUST define transition rules that make those controls applicable when runtime manifests/surfaces appear. M1–M4 MUST NOT hide detected real runtimes as planning-only.

### Launch OS

Launch OS MUST define the actual release path appropriate to maturity:

- candidate identity and exact SHA/artifact binding;
- environments and configuration ownership;
- migrations/backups/restore/rollback;
- signing/store/deployment/provider requirements;
- observability/health/stabilization checks;
- launch blockers and explicit external authority;
- release-readiness command/evidence;
- applicable SEO release/production verification gates without treating search outcomes as deployment guarantees;
- production verification and rollback evidence.

Before release-sensitive operations, State OS rehydrates exact branch/HEAD/candidate/environment/rollback context. State recovery never grants production authority by itself.

M3 and M4 require reconciliation against the actual release/production process. Generic Launch templates may not replace stronger native production controls.

## 6. Managed runtime and tools

A deep integration must make the current supported managed surface reproducible. The normal bootstrap/migration topology distributes current managed `bin/`, `lib/`, schemas, quality/discovery/evidence/SEO contracts, State OS, CI workflow and Agent foundation/overlay into the project.

A project MAY instead deliberately use a complete **isolated pinned runtime** (for example a submodule) when that topology is compatible with its adoption strategy. In that case:

- place the full kit source under an ExecutionKit-excluded control path such as `.executionkit/runtime/AI-ExecutionKit`, or prove an equivalent complete discovery exclusion;
- never allow the kit's own files to enter product discovery/UI/content/search/coverage denominators;
- provide project wrappers/adapters for path-sensitive commands;
- ensure activation, State OS, SEO OS, MCP, editor hooks/plugins and framework adapters target the actual runtime path rather than assuming project-root `bin/`;
- bind the runtime to an exact approved commit/version;
- validate the submodule/vendor/runtime identity on fresh checkout.

Do **not** embed the complete kit under an ordinary product path such as `tools/AI-ExecutionKit` without explicit complete denominator exclusion.

Do not hand-copy a random subset and call the project upgraded. Use supported distribution migration/bootstrap or a deliberate complete pinned-runtime topology, inspect conflicts, preserve native tooling, and authorize managed replacement only after reconciliation.

Minimum structural command set after current integration includes the applicable equivalents of:

```bash
node bin/validate-execution.mjs .
node bin/validate-agents.mjs .
node bin/validate-state.mjs .
node bin/validate-seo.mjs .
node bin/state-status.mjs .
node bin/state-rehydrate.mjs .
node bin/state-checkpoint.mjs . --reason deep-integration
node bin/state-amnesia-test.mjs .
node bin/validate-ci-policy.mjs .
node bin/validate-v22-policy.mjs .
node bin/doctor.mjs .
node bin/next-execution.mjs . --json
node bin/coordinate-agents.mjs . --dry-run
node bin/discover-product.mjs .
node bin/reconcile-product.mjs .
node bin/build-coverage-graph.mjs .
node bin/validate-component-system.mjs . --audit --boundary=phase
node bin/discover-content.mjs .
node bin/validate-content-depth.mjs .
node bin/build-candidate.mjs .
node bin/validate-candidate.mjs .
node bin/collect-evidence.mjs .
node bin/build-evidence-graph.mjs .
node bin/release-readiness.mjs .
```

If an isolated runtime is used, invoke them through the project's canonical wrappers or the explicit runtime path. Run project-native validators too; ExecutionKit never weakens them.

## 7. MCP, tooling and editor integration

MCP is part of the integration phase when requested/required; a server file alone is not installation evidence.

Repository/setup tasks MUST distinguish:

1. static managed server/plugin/config files;
2. dependencies installed/resolvable;
3. MCP process startup;
4. expected tool discovery/callability;
5. editor/plugin/framework registration;
6. observed host/runtime smoke evidence.

For the normal root-distributed topology, canonical commands include:

```bash
node bin/setup-tooling.mjs .
node bin/setup-tooling.mjs . --apply
node bin/mcp-server.mjs .
node bin/integrate-antigravity.mjs .
node bin/integrate-antigravity.mjs . --apply
```

The ExecutionKit MCP surface must expose the State OS tools when MCP is applicable: status, rehydrate, checkpoint, Amnesia Test and sanitized Memory envelope. When SEO capability is installed, MCP must also expose SEO status/validation surfaces. Structural tool registration is not runtime proof.

If the host provides a Memory MCP, first generate the State OS sanitized memory envelope. Memory remains `ADVISORY_ONLY`; every recall must be revalidated against live repository/canonical truth before mutation. A missing optional Memory MCP is not an execution failure unless `state.memory.mode=required` is deliberately configured.

For an isolated runtime, project wrappers/adapters MUST translate these paths and install project-local plugin/hook surfaces without erasing stronger native host resources.

Use browser tooling only when browser/Lighthouse adapters are applicable. For applicable stacks, inspect/configure Laravel Boost and Dart MCP adapters. Structural registration is not runtime proof. The integration task remains non-terminal until the actual execution environment proves required packages, MCP startup/tool discovery and applicable editor/framework integration or records a truthful `NOT_RUN`/`NOT_AVAILABLE`/`NOT_APPLICABLE`/external blocker.

## 8. CI policy

Default project policy remains:

- `workflow_dispatch` only;
- self-hosted project-specific runner label;
- no GitHub-hosted fallback;
- no push autorun;
- at most one runner registration for the same project on the same physical device;
- Mac and/or Windows based on the real project platform needs.

A repository workflow validates structure. It does not prove a physical runner is registered or online. Structural State/SEO OS validation belongs in the generated integrity workflow where configured; the zero-context Amnesia Test requires a reconciled runtime checkpoint and therefore belongs to the canonical State integration/acceptance gate rather than a clean-checkout workflow with no local derived snapshot.

M0 may defer product-runtime suites that cannot exist yet; M1–M4 must reconcile all currently applicable native/product suites. Expensive full CI normally runs on the final corrected integration/phase candidate rather than after every setup edit.

## 9. Maturity-specific procedure router

Read the selected profile before executing migration:

- `deep-integration-profiles/M0_PLANNING_ONLY.md`
- `deep-integration-profiles/M1_EARLY_IMPLEMENTATION.md`
- `deep-integration-profiles/M2_ACTIVE_DEVELOPMENT.md`
- `deep-integration-profiles/M3_NEAR_COMPLETE.md`
- `deep-integration-profiles/M4_PRODUCTION.md`

The profile is authoritative for preservation scope, frontier placement and required evidence within this universal protocol.

### M0 planning-only

Build the control plane before first product implementation. Planning-only component/design/discovery/runtime/search states may remain explicitly unimplemented with transition rules. Do not fabricate runtime or search-engine evidence.

### M1 early implementation

Inventory actual existing code before migration. Real detected runtimes/public surfaces make their tests/adapters/SEO applicability review real. Preserve early implementation and partial task state.

### M2 active development

Preserve substantial partial/history state, gate every current independent frontier root, audit pre-existing implementation and map existing product/search gaps without turning adoption into a project reset.

### M3 near-complete

Gate the remaining acceptance/release frontier, run a current denominator-based deep audit, require candidate-bound product/search evidence where applicable and minimize unrelated refactoring.

### M4 production

Preserve serving production and operational history. Deep integration is a control-plane change for future work; it must not deploy, mutate live data, rotate secrets or alter production state without separate explicit authority. `projectState=BOOTSTRAP` pauses normal ExecutionKit-controlled execution; it does not mean the live service is offline. Existing public search behavior must be measured and preserved/corrected deliberately rather than reset from a template.

## 10. New-project procedure

1. inspect target/repository intent;
2. classify maturity (`M0` for a genuinely new project) and choose adoption mode/profile/capabilities;
3. run `init-project.mjs`;
4. leave `projectState=BOOTSTRAP`;
5. reconcile generated `EK00` tasks to actual stack/product requirements;
6. execute `EK00` through the dependency-safe scheduler, allowing only explicitly proven-safe parallel implementation/resume work and falling back to sequential execution for shared/integration-sensitive steps; include State OS rehydration/Amnesia proof, SEO applicability/search contract, local tooling/MCP and native validation;
7. map product scope through discovery/quality/content/component/search contracts;
8. pass `EK00-AUDIT`;
9. run `activate-project.mjs --apply` in `EK00-ACTIVATE`;
10. only then allow the first product task to become executable.

## 11. Existing-project/upgrade procedure

1. capture baseline;
2. classify maturity from live evidence and read the matching profile;
3. choose the least-destructive adoption mode independently;
4. run `node bin/migrate-current.mjs --target <project>` and inspect every managed conflict/preservation decision, including the SEO overlay plan on current v3 distributions;
5. choose/validate managed runtime topology and denominator exclusion;
6. apply current managed runtime migration only with explicit replacement for reconciled managed files;
7. preserve native TODO bytes/resources during mechanical migration;
8. create/reconcile canonical `EK00` integration work at the maturity-correct current frontier, including `EK00-004S`, `EK00-005S` or semantically equivalent native State/SEO integration tasks;
9. configure `adoption.deepIntegrationRequired=true`, integration phase/gate metadata, State policy, SEO capability/applicability and appropriate native task adapter/projection;
10. re-adopt/reconcile `.agents`; do not discard mature project specialists, and prove State rehydration plus applicable SEO specialists are routable;
11. execute the seven capability-authority, State OS and tooling/MCP tasks at profile-appropriate evidence depth;
12. create/reconcile a real State checkpoint, rehydrate it and pass the Amnesia Test from zero conversation history;
13. run discovery/audit against pre-existing implementation and public-search surfaces when the profile has real code;
14. map newly discovered independent gaps to TODO;
15. pass independent `EK00-AUDIT` and current validators including `validate-seo.mjs` when SEO capability is configured;
16. activate only after the integration gate and profile-required evidence pass;
17. release the correct current product/change frontier by satisfying its integration activation dependency.

For a table/database/issue-based native task model, preserve it and generate a deterministic projection. The projection source hash must bind to current canonical bytes so stale projections fail closed.

For production, perform repository/control-plane adoption in branch/staging first and preserve the live service. Production side effects remain separately authorized Launch/operations actions.

## 12. Deep-integration completion evidence

Integration is complete only when evidence demonstrates all applicable rows:

| Area | Required proof |
| --- | --- |
| Baseline | adoption record + maturity classification + preserved task/history truth |
| Managed runtime | current version/identity + complete denominator exclusion + current managed commands/schemas |
| Execution OS | valid lifecycle/task adapter/scheduler/maturity-correct frontier gating |
| Agent OS | valid manifest, registered native resources and deterministic routes; State behavior and applicable SEO resources reachable through normal routed context |
| State OS | project authority/config + fresh checkpoint/rehydration + drift handling + semantic heartbeat policy + `ADVISORY_ONLY` memory policy + Amnesia Test |
| Content OS | real content scope/contracts/adapters or justified NONE |
| SEO OS | capability/profile/applicability reconciled; search-surface contract valid; applicable specialized modes/gates/evidence configured or evidence-backed NOT_APPLICABLE |
| Audit OS | audit boundaries + profile-appropriate existing-product/premium/component/domain/search checks |
| Test OS | native + adapter/test-adequacy/evidence policy at current runtime/search applicability |
| Launch OS | candidate/release/environment/rollback + applicable SEO release/production policy appropriate to maturity |
| MCP/tooling | installed/resolvable/runtime-smoke evidence or truthful blocker/N/A; State/SEO MCP tools discoverable where required |
| CI | manual self-hosted policy + observed runner evidence when required |
| Discovery | current product/scope/search reconciliation with kit runtime excluded and mapped gaps |
| Audit gate | independent deep integration audit accepted |
| Activation | normal ExecutionKit-controlled execution enabled only after gate acceptance |
| Product frontier | current/future work cannot bypass integration activation dependency |
| Production safety | for M4, no unauthorized live side effect and production/search truth kept distinct from control-plane state |

A missing required row is not PASS.

## 13. Agent start contract

After deep integration, the operator should be able to give an intentionally tiny instruction such as:

> Start from `TODO.md` and execute task by task.

The repository itself must provide everything else: authority, lifecycle, routing, skills, contracts, State recovery, SEO applicability/search contracts, MCP/tooling setup tasks, quality gates, audit cadence, verification and release rules. Long-running execution must remain safely resumable even if the conversation is compacted, the agent/model changes, the process restarts or execution moves between machines.

If a long external prompt or the previous model's memory is still required to remember how the project must operate or where safe execution should resume, the deep integration is incomplete.

## Installer and lifecycle enforcement

Use the [unified installer](installer.md) for mechanical preparation and preservation-first intake. The configured `integrationActivationTaskId` defaults to `EK00-ACTIVATE`. Every nonterminal product task, including PLANNED, IMPLEMENTED, REVIEW_REQUIRED, CORRECTION_REQUIRED and BLOCKED, must carry activation ancestry. Selection and readiness share the guard: ACTIVE plus independently accepted audit and activation. Setting ACTIVE during activation does not make the activation task accepted; product work remains closed until its review finishes. Source upgrades create a new integration phase and preserve prior terminal evidence.

Native unchecked plans may use the canonical-TODO native-markdown adapter. Existing completion semantics and mature projections require explicit reconciliation before automatic adoption. Registration without reachability does not satisfy Agent integration.

The canonical initial chain is runtime preparation (`EK00-002`) → tooling bootstrap (`EK00-002T`) → native project study (`EK00-002S`) → system reconciliation (`EK00-003` onward). Current guarded projects MUST include tooling-bootstrap and project-study tasks with this dependency relationship and audit ancestry. A later full integration smoke boundary may deepen framework/host checks after contracts are reconciled; it does not replace the initial usable-tooling prerequisite.

## Reality-closure integration reconciliation

Deep integration must reconcile not only the eight authorities but also how product tasks compose. Before normal product execution is activated, resolve the configured critical-journey/integration contract, identify release-critical actor journeys and provider/consumer seams, and ensure planned phase/release gates converge their member tasks. This is cross-cutting Execution/Audit/Test/Launch metadata, not a ninth OS.

Existing projects upgraded to this policy may continue valid implementation while integration applicability is being reconciled. However, unresolved critical journeys, missing phase convergence, or unconfigured strict release evidence must block phase/project/release closure rather than being converted into PASS.

