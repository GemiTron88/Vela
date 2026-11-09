# AI ExecutionKit Standard v2.2.4

**Status:** CANONICAL  
**Scope:** AI-executed software projects at any lifecycle stage  
**Normative language:** MUST, MUST NOT, SHOULD, SHOULD NOT and MAY are normative.

### 3.x override notice

This file preserves the v2.2.4 semantic base, including its historical sequential-runtime clauses. For current 3.x projects, `STANDARD_V3.md` is a normative overlay and **supersedes those sequential-only clauses** with dependency-safe parallel Agent OS execution, one canonical task authority, orchestrator-owned integration and deterministic sequential fallback. Do not interpret the preserved v2.2 wording as the current 3.x runtime policy.

## 1. Purpose

AI ExecutionKit is a reusable control system for end-to-end AI software delivery. It coordinates repository truth, one canonical mutable work authority, six capability authorities, cross-cutting State OS continuity, Agent routing, sequential runtime orchestration, product discovery, candidate-bound evidence and release gates without creating competing project-management systems.

v2.2 introduced executable runtime/discovery/evidence/adapters on top of the v2 authority/lifecycle model. v2.2.2 made wave/phase/release Audit boundaries deterministic lifecycle actions and hardened premium UI/component-system review. v2.2.3 made deep project integration explicit and maturity-aware. **v2.2.4 adds State OS as cross-cutting system #7** so multi-hour and multi-day autonomous execution can survive context compaction, interruption, process restart, model/agent change and machine handoff without treating chat memory or an external memory service as execution authority.

The standard has exactly **six capabilities**:

1. Execution OS
2. Agent OS
3. Content OS
4. Audit OS
5. Test OS
6. Launch OS

The complete control plane has **seven systems**: those six capability authorities plus **State OS**. State OS is not capability-leveled and cannot be selected as `NONE|LITE|STANDARD|FULL`; it spans the six capabilities because continuity and context integrity apply to every lifecycle action.

Skills, quality packs, adapters, MCP integration, discovery and evidence engines remain subsystems/resources rather than task-owning operating systems. State OS is also not a task owner. It observes and reconstructs current execution state while canonical task authority remains elsewhere.

The core State OS principle is:

> **Context is disposable. Repository state is reconstructable.**

Conversation history, model working memory, `/goal` persistence, State snapshots and external Memory MCP are caches or derived hints. Current repository, canonical task authority, implementation and current evidence always win.

## 2. Foundational invariants

Every conforming project MUST preserve all of these invariants:

1. `TODO.md`, or the explicitly configured project-native canonical source represented by a deterministic projection, is the single mutable execution authority.
2. No `.agents` file, `.executionkit` artifact, State snapshot/journal, external memory entry, OS document, plan, quality report, audit, handoff, graph or archive may become a second executable backlog/status ledger.
3. Specifications define intended behavior; current repository/runtime state defines implemented reality; reproducible evidence defines verification/acceptance reality.
4. A task is not complete merely because implementation exists.
5. Required implementation work normally reaches independent `ACCEPTED` before execution closure. `RELEASED` is stronger. `CANCELLED` is terminal only with rationale.
6. `PLANNED`, `READY`, `BLOCKED`, `IN_PROGRESS`, `IMPLEMENTED`, `REVIEW_REQUIRED` and `CORRECTION_REQUIRED` are non-terminal. `PLANNED` is not executable until Definition of Ready promotes it to `READY`.
7. `VERIFIED` is legacy compatibility terminology only when explicitly normalized to `ACCEPTED`; new v2 tasks SHOULD use `ACCEPTED`.
8. Every independent executable finding from Content, Audit, Test or Launch MUST map to canonical task authority or an explicit non-action disposition.
9. Agents MUST inspect current relevant implementation/evidence before mutation; plans, prior summaries, State snapshots and chat history do not override repository truth.
10. Agent context SHOULD be the minimum deterministic envelope required for the current lifecycle action.
11. Task IDs MUST be immutable and globally unique across active TODO and configured archives.
12. Discovered independent required work MUST be mapped before implementation/closure.
13. Manual progress percentages MUST NOT be authoritative; progress is derived from canonical task state.
14. Phase/project closure is false while any required non-terminal canonical work remains.
15. Blockers MUST remain visible. External/non-actionable blockers MUST NOT starve independent dependency-ready work; automatic blocker inspection requires explicit bounded AI-actionable metadata.
16. Existing healthy native controls MUST be preserved and reconciled through the least destructive adoption mode.
17. Migration MUST NOT manufacture progress, erase blockers, recycle IDs, weaken evidence, silently reset canonical state or rewrite mature native controls merely for appearance.
18. ExecutionKit v2.2 runtime orchestration is `SEQUENTIAL`: exactly one canonical lifecycle action is selected at a time.
19. Host-native bounded delegation MAY execute that selected action, but MUST preserve the same task/action/context/evidence contract and MUST NOT create another task queue or independent canonical ownership lane.
20. Code-edit authority does not imply permission for production, destructive or irreversible side effects.
21. CI/Test OS orchestration MUST use deliberate project-isolated self-hosted execution by default, with no automatic push run and no GitHub-hosted fallback.
22. Structural metadata cannot by itself prove product completeness, premium visual quality, test adequacy or live runtime behavior.
23. Candidate/evidence claims MUST identify the actual commit/tree/control inputs/environment/toolchain identity they prove.
24. Missing optional tools MUST be reported as `NOT_AVAILABLE`, `NOT_CONFIGURED` or `NOT_APPLICABLE`; absence MUST NOT become PASS.
25. Runtime/state/discovery/evidence artifacts under `.executionkit/` are derived state and MUST be excluded from product discovery and canonical mutable task state.
26. Distribution/test/evidence claims MUST identify the actual scope/candidate/environment they prove and MUST NOT imply unperformed validation.
27. Canonical boundary audit gates MUST use `Action: audit` with `Audit Boundary: ad-hoc|wave|phase|release`; unsupported declared actions or invalid/missing boundaries MUST fail closed rather than fall back to implementation.
28. A material wave/phase/release Audit finding that requires work MUST map to canonical task authority, keep the affected boundary gate non-terminal, and be reproduced after remediation before that gate closes.
29. Wave audits SHOULD stop cross-task/product-quality debt from compounding through focused A1 review and targeted checks; expensive full self-hosted CI is normally deferred to the final corrected phase candidate unless native project policy requires otherwise.
30. Premium UI/UX acceptance MUST use current rendered/contextual evidence where required. Source heuristics may identify component bypasses or generic/basic/poor review targets but MUST NOT pretend to be an aesthetic oracle.
31. **Managed file presence is not deep integration.** When deep integration is required, project-specific Execution/Agent/Content/Audit/Test/Launch authorities, State OS, applicable skills/rules/workflows/contracts, managed tools, MCP/editor/framework adapters, CI and quality/discovery contracts MUST be reconciled to live project truth before normal product execution proceeds.
32. When `adoption.deepIntegrationRequired=true`, the configured canonical integration gate MUST exist and the current product execution frontier MUST be dependency-gated transitively through the integration activation boundary; a READY/IN_PROGRESS product action that bypasses that ancestry is invalid.
33. A deep-integration-enabled project MUST NOT become or remain `ACTIVE` while its configured integration audit gate is unaccepted. The audit gate is independent review; activation occurs only after that gate is accepted.
34. Deep integration work MUST be represented in the one canonical mutable task authority. README/adoption documents, `.agents`, State OS and external memory may define or observe the protocol but MUST NOT substitute for canonical executable setup tasks.
35. Mature native task systems MUST be preserved when stronger/equivalent; if generic canonical blocks cannot safely represent them, deterministic `projection-json` MUST expose execution semantics without moving mutable ownership away from the native source.
36. Before non-trivial deep adoption/re-integration, the target MUST be classified from current observable repository/runtime/release evidence as one maturity profile: `M0_PLANNING_ONLY`, `M1_EARLY_IMPLEMENTATION`, `M2_ACTIVE_DEVELOPMENT`, `M3_NEAR_COMPLETE` or `M4_PRODUCTION`. A remembered or estimated completion percentage MUST NOT be treated as maturity evidence.
37. Maturity profile and adoption mode are orthogonal. Maturity controls preservation boundaries, current-frontier gating, adapter/test applicability and evidence depth; adoption mode controls how native authorities are preserved/migrated. One MUST NOT be inferred mechanically from the other.
38. Integration ancestry MUST gate the maturity-correct **current/future execution frontier**, not rewrite historical terminal work merely for uniformity. M0 normally gates all non-terminal product work; M1 preserves early implementation and gates its future frontier; M2 gates every independent active non-terminal root; M3 gates the remaining acceptance/release frontier; M4 gates current/future maintenance/change/release work while preserving historical releases.
39. M0 MAY represent genuinely absent product runtimes/components/design sources as explicit `NOT_IMPLEMENTED`, `PLANNED_NOT_IMPLEMENTED` or `NOT_APPLICABLE` only when transition rules make the corresponding controls applicable as soon as real runtime/surfaces appear. M1–M4 MUST NOT hide detected real runtimes or currently applicable tests/adapters behind planning-only states.
40. A complete embedded ExecutionKit source/runtime tree MUST be excluded from product discovery, UI audit, content discovery and coverage denominators. An isolated pinned runtime SHOULD use an ExecutionKit control path such as `.executionkit/runtime/...` or an equivalently excluded location; path-sensitive activation/State/MCP/editor/framework integrations MUST target the actual topology and be smoke-tested rather than assuming project-root `bin/` paths.
41. Static MCP/plugin/editor/framework files prove registration/wiring only. A required host integration MUST use observed process/tool discovery/callability/runtime evidence where authorized/observable, or remain truthfully `NOT_RUN`, `NOT_AVAILABLE`, `NOT_APPLICABLE` or blocked.
42. For `M4_PRODUCTION`, ExecutionKit `projectState=BOOTSTRAP` means normal ExecutionKit-controlled future product/change execution is paused for reconciliation. It MUST NOT be interpreted as evidence that the deployed service is offline/unreleased, and adoption MUST NOT deploy, mutate live data, rotate secrets, alter production infrastructure/provider/store state or perform other live side effects without separate explicit environment/operations authority.
43. State OS MUST use `BOOT → REHYDRATE → VERIFY → RESUME` at session start and after suspected context compaction, interruption/crash, model/tool restart, model/agent change or machine handoff before resumed mutation.
44. State rehydration MUST compare the latest derived snapshot with live branch/HEAD/worktree, canonical task authority, execution configuration, Agent manifest/route and relevant implementation/evidence. Live truth wins every contradiction.
45. State snapshots MAY contain observed task/action pointers, bounded working-set paths, evidence references, context-health hints and a next safe action, but MUST NOT contain an executable queue, authoritative status ledger or newly invented requirements.
46. State checkpoints MUST preserve dirty/interrupted work. Recovery MUST NOT reset/discard a worktree merely to make an older checkpoint appear fresh.
47. Long-running lifecycle actions MUST write semantic State checkpoints at meaningful milestones and SHOULD heartbeat within the configured State interval. Heartbeats are structured continuity facts, not transcript dumps.
48. External Memory MCP/equivalent is `ADVISORY_ONLY`. It MUST require live revalidation and MUST NOT own task state, queues, secrets, current test PASS claims or current release claims.
49. State OS behavior MUST be registered **and routable** through Agent OS. A State skill that exists on disk or in the manifest but cannot be reached from normal lifecycle routing is not integrated.
50. A project claiming multi-day autonomous continuity MUST be able to pass the State OS **Amnesia Test** from zero conversation history after a fresh reconciled checkpoint.
51. State OS does not replace Audit/Test/Launch evidence. Remembered or checkpointed evidence references cannot make stale evidence current after candidate/environment drift.
52. State recovery does not grant product, destructive or production authority. It reconstructs the context of an already-authorized canonical action only.

## 3. Authority model

| Question | Primary authority |
| --- | --- |
| What should exist? | approved product/specification/contracts |
| What exists now? | current repository, schema, config, deployment/runtime evidence |
| What executable work remains? | canonical `TODO.md` / configured native source |
| How is task state interpreted? | Execution OS + execution config/native adapter |
| Which role/skill/context handles the next action? | Agent OS manifest + resolver |
| Which action executes now? | Execution scheduler + sequential runtime coordinator |
| How can an interrupted/compacted session safely resume? | State OS rehydration + current repository/canonical truth |
| What may durable memory contribute? | advisory reusable hints only; live repository/canonical truth remains authoritative |
| What implementation surfaces exist? | derived discovery inventory + repository truth |
| Is discovered scope reconciled? | approved scope/contracts + reconciliation evidence |
| Is implementation acceptable? | task contract + required independent reproducible evidence |
| Is a finding closed/accepted risk? | finding contract + Audit/evidence authority |
| Which build/candidate did evidence validate? | candidate envelope + evidence identity |
| Is release safe? | Test/Audit/Launch/quality gates tied to current candidate |
| Is a live side effect authorized? | explicit environment/operations authority |

When authorities conflict, the contradiction MUST be reconciled before promoting the affected task/candidate or resuming mutation.

## 4. Required project elements

Every current v2 conforming AI-executed project MUST have:

- root `AGENTS.md` binding repository authority, canonical TODO/native source and `.agents`;
- one canonical active TODO/native task authority;
- `execution.config.json` (or supported equivalent) with `standardVersion`, `projectState`, profile, all six capability levels and State OS policy;
- Execution OS authority;
- Agent OS authority plus configured machine-readable manifest;
- State OS project authority and derived-state configuration;
- Audit OS and Test OS at non-`NONE` depth;
- Content OS and Launch OS according to selected profile/project contract;
- deterministic task IDs/lifecycle/dependencies;
- task/phase contracts or equivalent observable acceptance criteria;
- reproducible evidence rules;
- Agent + State + v2.2 policy + Execution + CI integrity validation;
- manual self-hosted CI policy controls;
- release gates when the project ships/deploys.

When deep integration is required, the project MUST additionally have:

- a recorded current maturity profile with evidence/rationale and a separately selected adoption mode;
- canonical integration tasks (default phase `EK00`, or a semantically equivalent native phase) inserted at the maturity-correct current execution frontier;
- a configured independent integration audit gate and activation boundary;
- current/future product/change execution frontier ancestry proving it cannot bypass that boundary;
- project-specific reconciliation of all six applicable capability authorities;
- project-specific State OS reconciliation, including current checkpoint/rehydration behavior, drift handling, Memory policy and Amnesia evidence;
- registered/routable project-specific Agent roles, skills, rules, workflows, contracts and templates as applicable, including State recovery behavior;
- explicit setup/verification for required MCP, editor, framework and project-local tooling integrations;
- an explicit managed-runtime topology that cannot pollute product discovery/audit denominators;
- project-specific component/design/content/quality/discovery contracts where applicable;
- canonical remediation mapping for integration findings;
- profile-appropriate evidence depth for any product/runtime/release/production truth that already exists.

The project-local managed runtime includes, where installed by standard bootstrap/migration:

- sequential runtime/checkpoint tooling;
- State snapshot/journal/rehydration tooling;
- product discovery/reconciliation tooling;
- candidate/evidence tooling;
- adapter registry and relevant quality/domain adapters;
- `.executionkit/` derived-state isolation;
- MCP/host integration surfaces where applicable.

## 5. Project state

`projectState` is one of `BOOTSTRAP` or `ACTIVE`.

### `BOOTSTRAP`

Structural wiring exists, but project-specific reconciliation is incomplete. A BOOTSTRAP project MUST NOT be represented as release-conformant merely because validators can parse its files.

Fresh installation and incompatible major authority/lifecycle migration enter BOOTSTRAP. A material adoption/re-integration that enables the deep-integration guard remains BOOTSTRAP until its canonical integration work — including State OS where current standard applies — and independent audit gate are accepted and activation succeeds.

For an `M4_PRODUCTION` project, BOOTSTRAP describes **ExecutionKit control-plane eligibility for future controlled work**. It does not roll back, undeploy or otherwise redefine the current live service/release. Production service truth remains governed by actual deployment/runtime/operations evidence.

### `ACTIVE`

Project-specific placeholders/reconciliation are complete and the project satisfies the active integrity contract. `ACTIVE` does not mean released; it means ExecutionKit controls are reconciled enough for normal operation.

A **compatible v2 minor/patch** managed-tooling migration MAY preserve `ACTIVE` only when canonical task semantics/native authority remain valid and post-migration validators pass. Managed runtime/State/schema evolution may require transactional adapter/manifest reconciliation without manufacturing task progress. If a material deep re-integration requirement remains, the project MUST truthfully return to or remain in reconciliation semantics until the configured gate is accepted.

## 6. Profiles, six capabilities and State OS

Capability profiles choose governance depth; they do not change authority ownership and they are not project-maturity classifications.

- `LITE`
- `STANDARD`
- `FULL`
- `CUSTOM`

`CUSTOM` MUST state all six capability levels and a rationale.

Execution, Agent, Audit and Test cannot be `NONE` in v2 standard conformance. Content and Launch depth depend on product/release context.

**State OS is outside capability-level selection.** Current v2.2.4 conformance requires State OS to be enabled as a cross-cutting integrity system because an executor cannot safely opt out of context/recovery integrity while claiming the current standard.

Capability docs and State OS may produce findings/evidence/derived state, but executable work remains represented once in canonical task authority.

### Deep-integration maturity profiles

Deep integration classifies current implementation/runtime maturity independently from capability profile and adoption mode:

| Maturity | Required interpretation |
| --- | --- |
| `M0_PLANNING_ONLY` | approved planning/task/contracts may be mature, but material product runtime is absent |
| `M1_EARLY_IMPLEMENTATION` | real product runtime and meaningful code exist, but implementation is still early |
| `M2_ACTIVE_DEVELOPMENT` | substantial multi-area implementation and active/partial execution history exist |
| `M3_NEAR_COMPLETE` | implemented denominator is largely present and current work is primarily acceptance/release hardening |
| `M4_PRODUCTION` | observable live production deployment/operational history exists |

The canonical maturity router and profile-specific preservation/evidence rules are `docs/adoption/deep-integration-profiles/README.md` and its M0–M4 playbooks. When classification is ambiguous, adoption SHOULD choose the more preservation-heavy/evidence-heavy profile. `M4_PRODUCTION` MUST NOT be claimed without observable production evidence.

## 7. Canonical lifecycle

Fresh v2 task semantics:

- `PLANNED` — known but not ready/executable.
- `READY` — dependency-ready and accepted for implementation or an explicitly declared special lifecycle action.
- `BLOCKED` — non-terminal with concrete blocker/unblock condition.
- `IN_PROGRESS` — currently/interrupted implementation or boundary-action state.
- `IMPLEMENTED` — implementation candidate exists; not accepted.
- `REVIEW_REQUIRED` — candidate awaiting independent review/revalidation.
- `CORRECTION_REQUIRED` — review found actionable correction work.
- `ACCEPTED` — independently accepted normal closure.
- `VERIFIED` — legacy compatibility alias to `ACCEPTED` when configured.
- `RELEASED` — stronger terminal state when release is applicable.
- `CANCELLED` — terminal only with rationale; dependency satisfaction is false by default.

`Action: audit` is the only v2.2 declared special task action. It MUST also declare a valid `Audit Boundary`. This changes routing/procedure, not task-state authority.

Projects with stronger compatible native state models MAY keep them through a deterministic projection/adapter as long as semantic closure/dependency behavior remains explicit. Projection adapters MUST preserve valid audit action/boundary metadata when the native authority uses canonical boundary gates.

State OS records only an observed pointer to this lifecycle and cannot introduce a new lifecycle state or bypass a transition.

## 8. Closure-oriented scheduler

The default closure scheduler selects work in this order:

1. dependency-ready canonical `Action: audit` boundary gates;
2. review/revalidation of `IMPLEMENTED` / `REVIEW_REQUIRED` candidates;
3. `CORRECTION_REQUIRED` correction;
4. resume `IN_PROGRESS` work;
5. bounded inspection of explicitly AI-actionable `BLOCKED` work;
6. dependency-ready `READY` implementation.

`PLANNED` is not executable.

External/non-actionable blockers remain visible but MUST NOT repeatedly preempt unrelated READY work. The scheduler resolves one lifecycle action at a time. An AI executor MUST NOT implement only `READY` tasks while audit/candidate/correction lanes remain indefinitely unresolved.

An audit gate routes to independent Audit reviewer context. If that audit discovers executable remediation, those findings MUST become canonical tasks/dependencies before remediation and the gate MUST remain non-terminal until finding-specific evidence and applicable boundary checks pass.

When the deep-integration guard is enabled, scheduler output MUST also satisfy the configured integration ancestry contract before a product lifecycle action is returned.

State OS rehydrates and verifies the scheduler's current result; it does not select a competing next action.

## 9. Agent OS and sequential runtime

Agent OS owns roles, skills, rules, routing, context resolution, workflow procedures, handoffs and runtime coordination. It does not own task state.

A v2.2 Agent manifest MUST:

- use the current supported manifest schema;
- bind the configured canonical task authority;
- register referenced resources deterministically;
- enforce `delegation.mode = SEQUENTIAL` and `oneLifecycleActionAtATime = true`;
- reject forbidden shadow task/backlog state;
- reject invalid references, routing predicates, skill cycles/conflicts/role restrictions;
- preserve reviewer separation where required.

For current managed Agent layers, normal lifecycle routing MUST expand `skill.state-rehydration` through routed task-context/runtime/handoff behavior. A State resource that is only registered but unreachable MUST fail integration review.

For v2.2-managed Agent layers, `action=audit` MUST route to independent Audit reviewer procedure/context, and applicable platform/premium/component skills SHOULD compose from task/surface tags without overriding reviewer ownership.

Deep integration MUST reconcile generic and native Agent resources rather than merely install a generic `.agents` tree. Mature native resources SHOULD be preserved and registered/routed deliberately; file presence without routing/validation is incomplete integration.

Bounded host delegation is allowed only for the already-selected lifecycle action. The host delegate must receive sufficient canonical context plus State-derived resume context and return a result/handoff before another action is selected.

Older orchestration policy fields are migration input, not valid new v2.2 manifest controls.

## 10. Skills Engine

Skills are Agent OS resources, not a separate OS.

A skill SHOULD describe stable ID/path, purpose/tags/capabilities, dependencies/conflicts, preconditions, expected inputs/outputs, allowed roles, evidence expectations and risk/routing metadata where needed.

Resolver dependency expansion MUST be deterministic. Skills MUST NOT create private mutable work queues or override canonical reviewer/authority boundaries.

`skill.state-rehydration` is the managed bridge from Agent OS to State OS. It must remain task-state-free and must resolve current truth rather than replay remembered instructions.

## 11. Runtime checkpoints, State OS and recovery

Runtime checkpoints and State checkpoints are related but distinct derived state.

### Runtime checkpoints

Runtime checkpoints recover one current sequential lifecycle action after interruption. A runtime checkpoint MAY record selected task/action/route/resources/result/recovery status, but MUST NOT become authoritative task state.

After interruption, runtime recovery compares the checkpoint with the scheduler's current repository-derived next action:

- same task/action -> potentially resumable, subject to State rehydration;
- different current truth -> stale checkpoint;
- operator cancellation -> cancelled runtime checkpoint only, unless canonical task state is separately changed through authority.

A successful delegate process that does not produce the required canonical state transition MUST NOT be treated as task completion.

### State OS

State OS provides cross-session/context continuity around the sequential runtime action. Default local derived paths are:

```text
.executionkit/state/latest.json
.executionkit/state/journal.ndjson
```

A State checkpoint SHOULD contain:

- State schema/version and explicit derived/non-authoritative marker;
- Git branch/HEAD/upstream observation and worktree fingerprint/path set;
- hashes of canonical TODO/native projection inputs, execution config and Agent manifest;
- observed lifecycle task/action and routed Agent resource IDs;
- bounded working-set paths;
- evidence references rather than copied evidence bodies;
- context-health hint;
- concrete next safe action;
- external-memory policy.

It MUST NOT contain a private queue, task priority system, newly invented requirements or authoritative completion state.

### Resume protocol

At session start, suspected context compaction, interruption/crash, model/tool restart, model/agent handoff or machine change, the executor MUST follow:

```text
BOOT -> REHYDRATE -> VERIFY -> RESUME
```

1. **BOOT** — inspect current repository/config/task authorities without relying on conversational history.
2. **REHYDRATE** — load State snapshot/journal and optional external memory as hints.
3. **VERIFY** — compare hints with live branch/HEAD/worktree, canonical task authority, implementation, Agent route and relevant evidence.
4. **RESUME** — continue only the current canonical lifecycle action after contradictions/drift are understood.

Material drift requires inspection before mutation. A legitimate interrupted dirty worktree may cause drift; the work MUST be preserved and reconciled, not discarded.

### Semantic checkpoints and heartbeat

Managed runtime transition boundaries SHOULD checkpoint State automatically when configured. Long-running host agents MUST also checkpoint meaningful implementation/discovery/decision milestones because an outer coordinator cannot reliably observe model-context compaction while the delegate is still running.

The configured heartbeat interval is a maximum continuity freshness target, not an excuse to spam checkpoints. A semantic milestone checkpoint may satisfy the same freshness requirement.

### Amnesia Test

`node bin/state-amnesia-test.mjs .` deliberately assumes zero conversation history. A current pass requires reconstructable canonical task authority, Git identity/worktree, current lifecycle action and Agent route, fresh State checkpoint, next safe action and non-authoritative memory policy.

A failed Amnesia Test is a State OS gap. It MUST NOT mutate `TODO.md` automatically and MUST NOT be hidden by a remembered explanation from the previous model.

## 12. External Memory MCP

ExecutionKit exposes a sanitized State memory envelope through CLI and MCP. External Memory MCP or an equivalent durable memory service is optional unless `state.memory.mode=required` is deliberately configured.

Memory MAY store stable reusable decisions, discovered invariants and a bounded resume hint. It MUST NOT store or act as:

- authoritative current task/status;
- shadow backlog or priority queue;
- secrets/credentials;
- a transcript dump required for safe resume;
- current test/audit PASS authority;
- current candidate/release authority.

All recalled memory is `ADVISORY_ONLY` and must be revalidated against live repository/canonical truth before mutation. State OS remains functional without an external memory service.

## 13. Adapter registry

External/product integrations SHOULD use adapter contracts rather than stack-specific branching scattered throughout universal core.

An adapter identifies stable ID/kind, detection behavior, collection/execution behavior, validation/normalization behavior, optional/required semantics and evidence identity when it produces acceptance/release evidence.

Adapter statuses distinguish `PASS`, `FAILED`, `NOT_AVAILABLE`, `NOT_CONFIGURED` and `NOT_APPLICABLE` as appropriate. Optional adapters MUST NOT auto-install tools during ordinary validation unless an explicit operator action requests installation.

## 14. Product discovery and reconciliation

Discovery derives an inventory of implemented surfaces from current repository truth. It does not replace approved product scope.

Discovery MAY identify routes, screens, views, components, controllers/models/policies, tests, content and other adapter-supported surfaces.

Requirements:

- generated/dependency/derived directories MUST be excluded from the product denominator;
- `.executionkit/`, including State artifacts and an intentionally embedded runtime, is control-plane material and MUST be excluded;
- surface IDs MUST be stable enough to distinguish semantically different surfaces;
- explicit excluded scope MUST not generate executable gaps;
- declared required scope missing from implementation is a blocking reconciliation finding unless explicitly dispositioned;
- discovered independent required work MUST map to canonical authority before implementation/closure.

When `discovery.requiredForRelease=true`, the configured inventory/reconciliation artifacts must exist and blocking findings prevent release readiness.

Deep integration SHOULD execute discovery/reconciliation before its final integration audit so pre-existing code, project scope, component/content/design systems and previously documented work are reconciled rather than assumed.

## 15. Coverage graph

Coverage graphs are traceability artifacts linking requirements/tasks/surfaces/tests/evidence where data exists. They are derived and MUST NOT become task state. Missing links are useful findings; a graph node by itself does not prove implementation or verification.

## 16. Candidate identity

Candidate evidence MUST be attributable to an identifiable product state.

The candidate envelope binds at least:

- Git commit and tree;
- configured control-file hashes;
- dependency lockfile hashes where present;
- platform/architecture;
- Node/tooling identity represented by the envelope;
- configured environment;
- optional build ID.

Candidate creation normally requires a clean meaningful working tree. Untracked ExecutionKit-derived state under `.executionkit/` may be ignored by candidate cleanliness; tracked or unrelated changes MUST remain blockers.

A candidate becomes stale when its identity/control set changes. State OS may remember a candidate/evidence reference for continuity but cannot keep it current after identity drift.

## 17. Trusted evidence

Evidence required for acceptance/release SHOULD be collected through a trusted producer contract where practical.

A candidate-bound evidence record identifies producer/kind, candidate ID/commit/tree, environment/build/platform/toolchain identity, command/adapter action, ordered timestamps, process result, normalized summary and raw artifact hash/path where applicable.

Required producer evidence MUST be a trusted PASS for the current candidate/environment and satisfy configured freshness constraints. Malformed/future/stale evidence fails the configured gate rather than degrading to PASS.

## 18. Evidence graph

Evidence graphs trace evidence records to the candidate they validate. They support explanation/auditability but do not own task state or replace raw artifacts.

## 19. Test adequacy

A command exit code of zero is insufficient when the applicable test set is empty/inadequate.

Test-evidence policy MAY define minimum applicable test count, allowed/forbidden skips, allowed/forbidden flaky retry passes and supported report format.

When test adequacy is required, zero tests, failures, forbidden skips, forbidden flaky retries or an insufficient count MUST fail the gate. This project-level test adequacy is distinct from the ExecutionKit distribution regression floor.

## 20. Browser/accessibility evidence

Browser adapters MAY use Playwright-compatible execution and axe-compatible accessibility evidence. A browser gate SHOULD cover the project-required combination of routes/states/interactions/responsive behavior/console-network errors/accessibility/visual evidence. Automated accessibility checks do not replace required manual accessibility review. Missing browser tooling MUST NOT report PASS.

## 21. SEO/performance evidence

SEO/performance adapters MAY use Lighthouse CI-compatible evidence plus project-specific crawl/index/metadata/structured-data checks. Thresholds SHOULD be appropriate to route/product class. The standard does not require a universal Lighthouse-100 score. Missing reports/tooling or failed configured budgets prevent PASS when the gate is required.

## 22. Flutter/Dart evidence

Flutter quality adapters MAY run analyzer/unit/widget/integration/profile/release/device-oriented checks according to project policy. Device/emulator/native-platform evidence MUST remain distinguishable from web-only evidence. Dart/Flutter MCP integration is an optional host/tool interface; registration is not proof the tool actually executed.

## 23. Laravel Boost integration

Laravel Boost MAY be used as a project-native deep-development integration for routes/schema/logs/package-aware documentation/runtime tooling where installed. ExecutionKit MUST preserve project-native Laravel authority and MUST NOT claim Boost behavior merely because a dependency/config exists.

## 24. Component/design/content quality

Component contracts, design drift, content-depth and UI conformance analyzers are quality/evidence tools, not another task-owning OS.

They MAY validate/detect required component variants/states/platform/accessibility/responsive/RTL metadata, missing component implementation, declared component-system bypasses, missing premium component catalogs, token-file/design-literal drift, placeholder/demo/mock/lorem content, thin/missing content surfaces and suspicious repeated generic-layout signals requiring rendered review.

When component contracts declare semantic replacement roles and platform usage tokens, a raw matching primitive that bypasses the declared reusable component MAY be a mechanical finding. Without explicit semantic equivalence, tools SHOULD raise a review target rather than guess.

Premium UI/UX review MUST challenge product-specific identity, role/job hierarchy and density, component reuse, complete loading/empty/error/success/disabled/permission/recovery states, interaction quality, narrow/tablet/wide behavior, RTL/LTR and long copy, accessibility, real content/assets, production performance and required browser/native-platform behavior.

Framework-default/starter-template appearance, cloned dashboard/card recipes, gratuitous decorative complexity, raw one-off controls despite canonical components, sparse screens missing useful actions/context/recovery, inconsistent typography/iconography/spacing/motion, placeholder/demo residue and screenshot polish hiding broken behavior are review signals. They are not universal aesthetic bans and source heuristics MUST NOT independently pronounce a design premium or generic.

The portable project-local mechanical audit commands are:

```bash
node bin/validate-component-system.mjs . --audit --boundary=wave
node bin/validate-component-system.mjs . --audit --boundary=phase
node bin/validate-component-system.mjs . --audit --boundary=release
```

Automated heuristics do not replace required independent rendered visual/editorial review.

## 25. Change impact, test selection and flakes

Impact/test-selection output is derived optimization guidance. Targeted testing MUST NOT be represented as full release coverage unless the project release contract says it is sufficient. Unknown relationships MUST NOT fabricate selected tests. Flake analysis MUST preserve retry/failure history; “rerun until green” is not acceptance evidence.

## 26. Security, data, offline, money, authorization and observability

These concerns remain adapters/skills under Agent/Test/Audit/Launch as applicable.

Projects SHOULD enable relevant specialist contracts for secrets/dependencies/static security/auth boundaries, destructive/backward-incompatible data migrations, offline/sync conflict/retry/idempotency behavior, money/tax/discount/wallet/payment integrity, tenant/ownership/permission isolation and runtime logs/queues/scheduler/cache/search/storage/external-health checks.

Generic tool presence is not evidence the project-specific risk was tested.

## 27. Derived state

The default derived-state root is `.executionkit/`.

It MAY contain:

```text
.executionkit/runtime/checkpoint.json
.executionkit/runtime/history.ndjson
.executionkit/state/latest.json
.executionkit/state/journal.ndjson
.executionkit/discovery/...
.executionkit/evidence/...
.executionkit/migrations/...
```

Rules:

- it is not a backlog;
- product discovery excludes it;
- bootstrap/migration provide local Git isolation;
- writers SHOULD defensively preserve that isolation;
- tracked/unrelated changes are not hidden from candidate cleanliness merely because derived untracked files are ignored;
- State snapshots/journals are disposable/reconstructable continuity artifacts and never canonical task state.

An intentionally embedded complete ExecutionKit runtime MAY live beneath `.executionkit/runtime/...` when used as an isolated pinned topology; it remains control-plane source, not product scope, and MUST be excluded from product discovery/audit denominators.

## 28. TODO archive

Active canonical TODO contains non-terminal executable work. Configured archives contain terminal historical task blocks only. Automatic archive movement MUST preserve complete task blocks and MUST NOT move PLANNED/READY/BLOCKED/IN_PROGRESS/IMPLEMENTED/REVIEW_REQUIRED/CORRECTION_REQUIRED work. Global task IDs/dependencies/evidence remain visible across active + archive sources.

## 29. Native task compatibility

A project with mature native task syntax SHOULD preserve it when deterministic adaptation is possible.

`projection-json` is a read-only normalized adapter. Its source files are SHA-256 bound; stale projections fail validation. A projection MUST NOT become shadow mutable task authority. Mutation remains in the native canonical source.

For audit boundary gates, the normalized projection MAY include `action: audit` and MUST include a valid `auditBoundary`. Invalid special-action metadata MUST fail rather than silently turn into implementation work.

For deep integration, native projection MUST also expose the configured integration gate/activation dependency semantics needed to prove that the maturity-correct current product/change execution frontier cannot bypass setup/reconciliation. State OS observes this projection; it does not own or mutate it.

## 30. Adoption and migration

`docs/adoption/universal-adoption.md` is the canonical operator protocol. `docs/adoption/deep-integration.md` is the canonical detailed integration protocol. `docs/adoption/deep-integration-profiles/README.md` and the selected M0–M4 profile are the canonical maturity-specific preservation/frontier/evidence contract.

Modes include `NATIVE_BOOTSTRAP`, `NATIVE_RECONCILIATION`, `CONTROLLED_MIGRATION` and `COMPATIBILITY_ADOPTION`.

Selection MUST be evidence-based and least destructive. Maturity classification MUST be evidence-based and independent from mode selection. Healthy project-native execution systems MUST NOT be rewritten merely to match template shape. Migration MUST NOT manufacture progress.

Distribution-side adoption/migration tools MUST:

- inspect before writing;
- preserve canonical TODO/native task bytes unless the migration explicitly targets task syntax with separately authorized semantics;
- preserve/register mature native Agent resources where possible;
- dry-run by default where supported;
- require explicit replacement permission for conflicting managed tooling;
- maintain backups/transaction rollback for captured controls;
- post-validate the target.

Current distribution adoption uses:

```bash
node bin/migrate-current.mjs --target /path/to/project
node bin/migrate-current.mjs --target /path/to/project --apply
```

`migrate-current.mjs` routes into the atomic v2 managed migration that includes State OS. Shared runtime/MCP/Agent/State files MUST NOT be upgraded through two competing migration transactions. `migrate-state-os.mjs` is a targeted repair tool only when shared current State integration is already present; otherwise it MUST fail closed and direct the operator to current migration.

Mechanical migration protects canonical TODO bytes. It MUST NOT silently insert project-specific State tasks, mark them accepted or claim the Amnesia Test passed. Project-specific integration remains a deliberate canonical-authority operation.

### Deep integration contract

For a new project or material existing-project adoption where `adoption.deepIntegrationRequired=true`:

1. inspect live repository/task/branch/evidence truth;
2. classify current maturity from live evidence and record M0–M4 profile;
3. choose least-destructive adoption mode independently;
4. establish/preserve canonical task authority and native lifecycle semantics;
5. install/reconcile current managed runtime/tools/schemas using a denominator-safe topology;
6. reconcile Execution OS and task adapter/projection;
7. reconcile Agent OS resources/routing/reviewer separation;
8. reconcile **State OS** authority/config, Agent routing, checkpoints, drift handling, Memory policy and Amnesia Test;
9. reconcile Content, Audit, Test and Launch OS authority to actual product scope/maturity;
10. configure applicable quality/component/design/content/discovery contracts;
11. configure and smoke-test required project-local tooling/MCP/editor/framework adapters where observable/authorized;
12. reconcile manual self-hosted CI platform/runner policy and applicable suites;
13. run profile-appropriate discovery/audit of pre-existing implementation;
14. map every independent integration finding into canonical task authority;
15. run independent phase-level deep integration audit;
16. activate only after that audit gate and profile-required evidence pass.

The default canonical integration phase is `EK00`. The starter sequence includes `EK00-004S` after Agent OS and before Content OS. Another native phase/task name is allowed if it preserves the same semantics.

The maturity-correct current/future product/change execution frontier MUST depend on the integration activation boundary directly or transitively; historical terminal tasks need not be rewritten merely to manufacture ancestry.

For M4, deep integration is a control-plane migration for future controlled work unless separately authorized. BOOTSTRAP does not redefine the live deployment, State recovery grants no production authority, and the adoption procedure does not itself authorize production changes.

## 31. Conformance

**Conformance is semantic and evidence-based**, not cosmetic file equality.

A project can preserve stronger/equivalent native mechanisms while satisfying the same observable invariants. Conformance validation MUST NOT claim facts it cannot observe. Repository files cannot prove physical runner topology, a live IDE plugin process, external Memory MCP availability, device behavior or production health without relevant runtime evidence.

When deep integration is required, conformance additionally requires a recorded maturity profile, valid configured integration gate, maturity-correct non-bypassing current/future frontier, product-denominator-safe runtime topology, project-specific State OS reconciliation and accepted gate before normal ACTIVE operation.

Merely finding six capability Markdown files, `docs/state/STATE_OS.md`, `.agents` resources or MCP tool declarations is insufficient.

## 32. Product quality contracts

Product-quality contracts are optional cross-capability acceptance controls. When configured, structural requirements and release evidence MUST validate. `NOT_CONFIGURED` is not a product-quality PASS; it means the generic quality contract is absent and product-native gates remain authoritative.

Premium experience, SEO/performance and content depth fit within existing capability/adaptor/skill boundaries; they do not create new task-owning OS backlogs.

## 33. Antigravity/host/MCP integration

Host integration uses project-native plugin/skill/rule/hook/MCP mechanisms where supported.

Registration/discovery shape is not runtime proof. Direct evidence is required for claims about plugin activation, MCP calls, delegated execution, browser/device operations or other installed-host behavior.

ExecutionKit MCP exposes State operations for status, rehydration, checkpoint, Amnesia Test and sanitized Memory envelope. MCP is an interface to ExecutionKit behavior, not authority itself.

Antigravity integration SHOULD inject bounded State status before invocation and expose the `ek-state` skill without creating parallel Agent/task ownership. An external Memory MCP remains advisory and must be revalidated live.

ExecutionKit workflow documents remain internal procedures/contracts; host entrypoints MUST NOT become a second canonical backlog.

## 34. CI/Test runner policy

Default GitHub Actions policy:

- `workflow_dispatch` only;
- self-hosted project runner;
- stable `project-<slug>` label;
- allowed project OS: macOS and/or Windows as required;
- no GitHub-hosted `*-latest` fallback;
- no automatic push autorun;
- maximum one runner for the same project on the same physical device.

The same project may have a runner on Mac and Windows when a task/phase/release contract requires both. The repository cannot prove physical registration topology by itself.

Generated project workflow runs structural Agent/State/v2.2-policy/Execution/CI/quality gates. Product tests/adapters remain project-defined and must be executed when their contract requires them.

A clean checkout intentionally lacks local derived State snapshots, so the generated structural workflow SHOULD run `validate-state.mjs` but MUST NOT pretend a clean-checkout `state-amnesia-test.mjs` proves a reconciled long-running session. The Amnesia Test belongs to the canonical State integration/acceptance task after a real checkpoint exists.

Audit cadence MUST NOT abuse CI to simulate rigor: ordinary tasks use targeted verification; wave boundaries use focused audit/targeted integration; phase boundaries run full A2 audit/remediation before manual self-hosted CI on the final corrected candidate by default. If later remediation changes that candidate, the affected final gate MUST be rerun.

M0 may defer product-runtime tests that cannot exist yet only with explicit transition rules. M1–M4 must execute or truthfully block currently applicable product suites rather than treating detected runtime as planning-only.

## 35. Release readiness

Release readiness requires, at minimum when applicable:

- project `ACTIVE`;
- accepted configured deep-integration gate when deep integration is required;
- clean named Git branch with local upstream synchronization proof;
- Agent/State/v2.2-policy/Execution/CI integrity;
- terminal canonical required work, including required audit gates;
- required product-quality evidence;
- required discovery/reconciliation denominator;
- current candidate identity;
- required trusted/fresh evidence producers;
- required test adequacy;
- product-specific Test/Audit/Launch gates.

A local upstream comparison is not proof that the remote was freshly fetched. The result MUST state that limitation when remote freshness is unobserved.

For long-running release work, State rehydration SHOULD be fresh before release-sensitive mutation, but State freshness itself is not release evidence. For M3/M4, release-readiness claims MUST reconcile the actual release/deployment path and current candidate/environment evidence; generic structural configuration alone is insufficient.

## 36. Distribution release integrity

The ExecutionKit distribution itself MUST keep all release surfaces synchronized:

- `VERSION` / package version;
- runtime default standard version;
- template/example config and Agent manifests;
- Standard/README/CHANGELOG/AGENTS/PLAYBOOK;
- State architecture/project template/runtime/MCP/Agent surfaces;
- bootstrap/current-migration/targeted-repair inventory;
- deep-integration model/validator/adoption protocol;
- schemas and the historical 34 v2.2 implementation surfaces;
- package command surfaces/dependencies;
- canonical-document semantic drift checks;
- base + State distribution self-audits;
- regression baseline.

v2.2.4 records a minimum distribution regression floor of **246 runtime tests across 28 required test files**.

The canonical distribution gate is:

```bash
npm run check
```

The manual self-hosted distribution workflow writes exact-clean-commit validation evidence only after this gate succeeds and uploads it as an artifact. A prior run against another commit is not current proof.

## 37. Versioning and compatibility

A **major** standard version is required when canonical task authority/lifecycle/closure semantics are changed incompatibly such that a project cannot preserve meaning through documented migration/adaptation.

A **compatible v2 minor/patch** release MAY evolve managed Agent/runtime/State/adaptor/schema formats when:

- canonical task authority and task-progress truth are preserved;
- migration is explicit/transactional where needed;
- native stronger/equivalent controls are preserved;
- post-migration validators prove the new managed contract;
- the release does not manufacture progress/evidence.

Thus v2.2.4 is compatible: State OS adds derived continuity and additional integration evidence without changing canonical lifecycle/closure meaning or transferring task authority.

Adding/refining maturity-aware deep-integration or State-recovery requirements within v2 is compatible when canonical task/lifecycle semantics remain unchanged and the new controls only make preservation, continuity, applicability, evidence and production-safety requirements explicit.

## 38. Change control

A material change to this standard SHOULD update atomically:

1. normative Standard;
2. affected capability/architecture/adoption/contracts;
3. templates/examples;
4. schemas/runtime validators;
5. positive + negative regressions;
6. distribution self-audit;
7. VERSION/README/CHANGELOG when released.

Canonical-document semantic validation MUST prevent known stale authority wording from silently returning.

## 39. Safety boundaries

Agents MUST NOT infer authorization for production deployment, destructive data mutation, secret/credential disclosure, irreversible infrastructure/account changes, external communications/purchases or other side effects requiring explicit operator/environment authority.

A canonical task can define required work; it does not automatically grant every side-effect permission needed to perform it. State OS recovery also cannot grant that permission.

M4 production deep integration remains subject to these boundaries even when repository/control-plane changes are explicitly authorized.

## 40. Anti-patterns

Non-conforming patterns include:

- a second mutable backlog under `.agents`, `.executionkit`, State OS, external memory, plans or audits;
- executor scans only READY/open work and ignores audit/candidate/correction lanes;
- an audit gate represented only in prose or accidentally routed to the implementer;
- invalid special task action metadata silently falling back to implementation;
- implementation treated as acceptance;
- managed ExecutionKit files called “deep integration” while project-specific capability/Agent/State/tooling/MCP/CI reconciliation is still absent;
- no maturity classification, or maturity inferred from an unverified completion percentage;
- product READY/IN_PROGRESS work bypassing a required integration gate/activation boundary;
- historical terminal/released work rewritten only to force integration ancestry;
- an ACTIVE project retaining an unaccepted required deep-integration gate;
- integration instructions existing only in README/chat instead of canonical executable tasks;
- M1–M4 real runtimes hidden as `NOT_IMPLEMENTED`/`NOT_APPLICABLE` to avoid product evidence;
- an embedded ExecutionKit source tree counted as product routes/components/content/tests/coverage;
- path-sensitive MCP/editor/State/activation config copied from a root-distributed layout into an isolated runtime without adaptation;
- static plugin/MCP files claimed as host activation evidence;
- an M4 control-plane BOOTSTRAP described as if the live service were undeployed/offline;
- production side effects performed merely because deep integration or State recovery was authorized;
- hidden manual percentages overriding task state;
- stale projection accepted after native source changed;
- optional tool absence reported as PASS;
- evidence from another candidate/environment reused as current proof;
- zero/skipped/flaky-only tests reported as adequate contrary to policy;
- discovery inventory treated as approved scope;
- source heuristics represented as proof that UI is premium/generic;
- `npm run check` subset represented as full distribution proof;
- rewriting healthy native systems for cosmetic consistency;
- derived `.executionkit` artifacts becoming product/discovery/task authority;
- multiple canonical lifecycle actions being independently owned under ExecutionKit orchestration;
- relying on conversation history or `/goal` persistence for facts required to resume safely;
- treating a State snapshot as permission to continue after HEAD/TODO/worktree drift;
- resetting dirty interrupted work merely to match a stale checkpoint;
- recording current task status or a private execution queue in Memory MCP;
- treating recalled memory as current test/release truth;
- registering State resources without making them reachable through Agent routing;
- claiming multi-day continuity while the zero-context Amnesia Test cannot reconstruct the safe next action.

## 41. Minimum conformance checklist

A release reviewer SHOULD be able to answer yes, with evidence, to all applicable questions:

- Is there exactly one mutable task authority?
- Are all six capabilities explicitly configured?
- Is State OS enabled as cross-cutting system #7 without becoming a capability/backlog?
- Is Agent routing valid and bound to the canonical task source?
- Is State rehydration registered **and routable** through normal Agent context?
- Is v2.2 runtime policy sequential one-action-at-a-time?
- Are task states/dependencies/archives semantically valid?
- Are declared `Action: audit` boundaries valid, dependency-gated and routed to independent Audit review?
- Does closure include audit/review/correction/resume lanes before new implementation?
- Are blockers truthful and non-starving?
- Are native controls preserved through the least destructive adoption mode?
- If deep integration is required, is current maturity classified from live evidence independently from adoption mode?
- Is its canonical integration phase project-specific and does it include State OS reconciliation?
- Is the maturity-correct current/future frontier transitively gated through activation without rewriting historical terminal work?
- Is the configured integration audit gate present/accepted before normal ACTIVE execution?
- Can a fresh State checkpoint rehydrate against live branch/HEAD/worktree/TODO/Agent route?
- Does the Amnesia Test reconstruct a safe next action from zero conversation history when multi-day continuity is claimed?
- Is external Memory MCP absent/optional or explicitly configured `ADVISORY_ONLY` and live-revalidated?
- If a complete ExecutionKit runtime is embedded, is it isolated from product discovery/audit denominators and are path-sensitive wrappers correct?
- Are required MCP/editor/framework/tool integrations configured and directly evidenced rather than inferred from files?
- Are currently detected product runtimes/tests/adapters treated as applicable at the selected maturity?
- Are discovery/reconciliation gates configured when required?
- Is required evidence current and bound to the right candidate/environment?
- Is test adequacy satisfied when required?
- Are optional tools distinguished from actual PASS evidence?
- Is derived state isolated and non-authoritative?
- Are CI runner/trigger rules conformant?
- Are premium rendered/component-system checks performed when applicable instead of inferred from source-only heuristics?
- Are product-specific Audit/Test/Launch/quality gates satisfied?
- For M4, is production truth distinct from control-plane state and were live side effects separately authorized?
- Are validation claims limited to what actually ran?

Only then should ExecutionKit controls be described as conforming for that scope.

## 42. Verified execution and evidence boundaries

A runtime step takes exclusive ownership of its project-local step lock, validates Execution/v2.2/State policy before and after a real delegate, and proves progress on the selected task's canonical state. Scheduler reordering or removal of tasks cannot prove progress/closure. Cancellation prevents new steps and is retained after a running host command returns. It does not guarantee termination of the host process tree. Resuming cancellation requires the explicit recovery option after the current step has stopped.

State checkpoints are additional continuity observations around that runtime step. They cannot prove canonical progress, acceptance or completion. A post-delegate State checkpoint records the newly observed live state only after runtime/authority validation.

Release-required evidence must match the current candidate/environment, configured producer command, successful exit and valid ordered timestamps. Configured artifacts must exist with collected SHA-256. A required test report must be one of those verified artifacts even when requiredProducers is empty. Null, duplicate, misnamed, incomplete or stale evidence is not PASS. The collector rechecks candidate integrity after execution. Local provenance fields and hashes are integrity checks, not cryptographic authentication of a runner or independent reviewer.

Test adequacy requires completed test records, consistent counts and no hidden failures. TAP plans/points, JUnit cases, Playwright results/global errors and Flutter completion events are inspected; aggregate-only and truncated reports fail. Required minimums count executed tests, excluding skips. Browser accessibility gates inspect current axe violations and incomplete checks. Lighthouse score budgets require refreshed reports and finite numeric thresholds. These checks do not establish design quality or full product scope.
