# AI ExecutionKit Standard v3.0 — Normative Overlay

**Status:** CANONICAL MAJOR-VERSION OVERLAY  
**Base:** `STANDARD.md` v2.2.4  
**Scope:** AI-executed software projects at any lifecycle stage  
**Normative language:** MUST, MUST NOT, SHOULD, SHOULD NOT and MAY are normative.

This document is the normative 3.x overlay for `STANDARD.md`. The v2.2.4 Standard remains the preserved semantic base for canonical task authority, lifecycle, the historical six-capability model, State OS, deep integration, evidence, CI and launch behavior. This overlay extends the current control plane with SEO OS as a seventh conditional capability authority. Where this overlay conflicts with v2.2.4 wording, this overlay wins for 3.x conformance. Together, `STANDARD.md` + `STANDARD_V3.md` define the current ExecutionKit 3.x standard.

## 1. Major-version intent

ExecutionKit 3.0 introduced fleet-aware observability and a deterministic per-device ExecutionKit Agent without transferring execution authority away from each project. The 3.x line also supports compatible capability/runtime evolution when canonical task truth, explicit migration and evidence boundaries remain preserved.

The current control plane has exactly **eight systems**:

1. Execution OS
2. Agent OS
3. Content OS
4. SEO OS
5. Audit OS
6. Test OS
7. Launch OS
8. State OS

The first seven are capability authorities. **SEO OS is conditional**: it applies to public surfaces intended for organic search and may resolve `NOT_APPLICABLE` for API-only, authenticated/private, native-only or intentionally non-indexable products after evidence-backed inspection. State OS remains the cross-cutting continuity/reconstruction authority and is not capability-leveled. Fleet telemetry, the per-device Agent, MCP fleet surfaces and Elmasna3 integration are subsystems/interfaces, not additional task-owning operating systems.


## 2A. Repository Intelligence cross-cutting fabric

Repository Intelligence is a cross-cutting subsystem of the eight-system control plane and MUST NOT be represented as a ninth operating system.

For 3.x conformance when Repository Intelligence is enabled:

- live repository/worktree/source truth MUST outrank all derived repository knowledge;
- derived artifacts MUST carry machine-readable provenance and a measurable trust/freshness state;
- missing or unreachable Git baselines MUST fail closed rather than be interpreted as fresh;
- generated context MAY guide navigation only according to trust policy and MUST NOT become task, implementation, acceptance or release authority;
- source retrieval MUST be bounded and secret-sensitive paths/source egress MUST default deny;
- large source packs and relationship indexes SHOULD remain local derived artifacts;
- optional providers such as Terrain, Repomix, CodeGraph and RTK MUST remain replaceable and MUST NOT become prerequisites for canonical local execution;
- provider self-reported health/freshness MUST NOT override independently observable repository drift;
- State OS MAY persist a compact knowledge baseline/trust summary, but knowledge drift MUST remain separate from canonical execution drift;
- Agent OS owns Repository Intelligence resource registration/routing and managed `AGENTS.md` blocks MUST preserve native unmanaged content;
- Audit/Test/Launch MAY consume repository intelligence only within their existing authority boundaries and MUST NOT weaken candidate-bound verification.

- Managed optional provider tooling MUST remain project-local, plan-first and explicitly applied; it MUST NOT silently install global packages or shell hooks.
- Managed provider packages MUST be exact-pinned, version-verified, receipt/lock-integrity checked and atomically replaceable with rollback to the previous valid tooling on failure.
- Optional incompatible/unsupported providers MUST NOT block remaining native/provider capabilities; required or explicitly selected unavailable/incompatible providers MUST fail closed.
- Tool reachability MUST remain distinct from repository/index freshness. A managed binary being healthy does not prove its repository-derived data current.

The normative contract is `contracts/repository-intelligence-contract.md`.


## 2B. Executable Documentation & Production Deployment Fabrics

ExecutionKit keeps exactly eight systems. Documentation and deployment are executable cross-cutting fabrics, not additional OSes.

### EXECUTABLE_DOCUMENTATION_INVARIANT

A Content/Launch/architecture Markdown file is not evidence that a project is documented.

When `documentation.enabled=true`:

- Agent OS MUST route Documentation Fabric on `Action: document` and on normal implementation/correction/resume lifecycle work;
- `bin/documentation-fabric.mjs` MUST build/validate the generated source-grounded knowledge base;
- the generated namespace MUST preserve manual documentation and MUST exclude itself from its own source evidence;
- required coverage spans the canonical 24-document project knowledge denominator defined by `contracts/documentation-fabric-contract.md`, including architecture/components/domains/features/business rules/workflows/background processing/interfaces/data/auth/config/storage/search-cache/notifications/payments/security/testing/deployment/operations/decisions/limitations/glossary;
- generated documents MUST expose source references/fingerprints and remain derived evidence;
- live source/runtime/canonical TODO remain authoritative;
- when `documentation.requiredForRelease=true`, stale/missing required generated documentation blocks release readiness.

### PRODUCTION_ARTIFACT_ALLOWLIST_INVARIANT

Launch OS owns release authority; Production Deployment Fabric provides the executable machinery.

Production deployment MUST:

- build from an allowlist rather than copying the repository wholesale;
- hard-exclude documentation, ExecutionKit/Agent/runtime control state, tests, TODO/AGENTS and secret-sensitive paths by default;
- bind the artifact to exact Git HEAD plus per-file hashes;
- fail closed when runtime-required files are absent;
- require an explicit configured target and explicit deployment authorization;
- stage before activation and use direct argv commands with `shell:false`;
- bind shared production state such as environment/storage only through explicit target configuration;
- execute smoke/health evidence on the activated release;
- preserve/execute rollback when activation validation fails.

The first executable filesystem target is `local-release-root`, intended for execution on the authorized production/VPS host. Remote/cloud/store adapters require separate explicit contracts and MUST NOT be guessed.

## 2. Authority and isolation invariants

For 3.x conformance:

- `TODO.md`, or an explicitly preserved project-native canonical task authority with deterministic projection, MUST remain the sole mutable execution/backlog/status authority.
- Telemetry, State snapshots, Agent registry, Elmasna3, MCP, host integrations, SEO reports and fleet projections MUST remain observational/derived and MUST NOT create a second mutable task list or scheduler.
- Elmasna3 MUST NOT become a required dependency for planning, selection, implementation, review, audit, testing, checkpointing or launch.
- A missing, unconfigured, unreachable or incompatible external control plane MUST degrade observability truthfully and MUST NOT stop canonical local execution.
- Remote control remains disabled in protocol v1. No generic remote shell is part of 3.0.
- Same repository on different devices/worktrees MUST remain distinct observed worktrees. Fleet views MUST NOT merge them into an invented single active state.
- Host activity, runtime/lifecycle activity, State freshness, Git activity and control-plane reachability MUST remain distinct facts.
- SEO applicability MUST be derived from actual public/indexable surfaces and product intent, not inferred from the mere presence or absence of an SEO file.
- Search-engine outcomes such as ranking, indexing, rich-result display or organic traffic MUST NOT be represented as guaranteed by repository validation.

### 2.1 TODO-first operator entry and long-running host contract

`TODO_FIRST_ENTRY_INVARIANT` is mandatory for every adopted ExecutionKit project.

The normal human/operator entrypoint MUST be the canonical `TODO.md` (or the project-native canonical task authority named by `execution.config.json`). Opening the repository and telling a supported host agent to read that authority and execute it task-by-task MUST be sufficient to enter the complete ExecutionKit lifecycle. The owner MUST NOT be required to remember or separately prompt bootstrap commands for `AGENTS.md`, State OS, task projection, routing, Test OS, Audit OS, Content OS, SEO OS, Launch OS, MCP or readiness scheduling.

After the TODO-first instruction, the host integration MUST internally perform the applicable lifecycle work: load root `AGENTS.md` and `execution.config.json`; honor all eight systems; inspect live repository/worktree truth; regenerate a configured native task projection; rehydrate State OS; validate authority; validate configured SEO applicability/contracts when present; resolve the earliest eligible canonical lifecycle action; resolve routable Agent OS context; execute only that action; run task-targeted verification; reconcile canonical task state/evidence; checkpoint State OS; synchronize any supported host checklist mirror; commit/push when repository policy requires it; and continue by resolving live truth again. Missing optional integrations MUST degrade truthfully rather than forcing the owner to supply a different bootstrap prompt.

A host persistence command such as Antigravity `/goal` MAY keep a session running for hours or days, but persistence MUST NOT become task authority, task selection or a shadow execution queue. ExecutionKit and the canonical TODO remain responsible for what happens next. Autonomous continuation MUST stop only at canonical closure, an explicit owner stop, a genuine unresolved blocker/required owner decision, unavailable mandatory evidence, or another declared safety/authorization stop condition.

`HOST_CHECKLIST_DERIVED_MIRROR` is mandatory whenever the active host exposes a writable session checklist/task-plan surface (for example a Brain task checklist). That host checklist is a convenience mirror only: it MUST be derived from current canonical TODO/lifecycle truth, MUST be synchronized after every canonical task state mutation and at minimum after every completed task, and MUST NOT own dependencies, completion, acceptance or future work. On disagreement, canonical TODO truth wins and the host mirror MUST be refreshed from it. If the host does not expose a reliable writable checklist API/surface, ExecutionKit MUST report the mirror as `NOT_AVAILABLE`/not observable and MUST NOT invent a repository `brain/task.md` path or create a second backlog merely to satisfy this convention.

`PHASE_BOUNDARY_FULL_CI` is the portfolio-default expensive-CI policy. Applicable targeted verification (unit/feature/widget/static/search-contract checks and task-specific evidence) MUST run inside the task lifecycle as required, but the complete self-hosted CI suite MUST NOT be automatically dispatched after every task, lifecycle action, commit or push. The normal full-suite dispatch occurs after the phase's implementation/corrections and phase audit boundary are ready for verification; it remains deliberate/manual and self-hosted. Launch OS MAY require another explicit exact-candidate release run, but this does not authorize per-task full CI. A project MAY define a stricter explicit boundary policy, but MUST NOT silently turn the default into task-by-task full CI.

## 2.2 Dependency-safe parallel execution

For 3.x conformance, the v2.2 sequential-only runtime clauses are superseded by the following current policy:

- `runtime.mode` is `DEPENDENCY_SAFE_PARALLEL` by default for current generated/adopted 3.x projects.
- Multiple canonical implementation/resume tasks MAY run concurrently only when dependencies are satisfied and explicit parallel-safety, ownership, shared-hotspot and isolation checks prove independence.
- One orchestrator owns canonical claims and deterministic final integration; parallel workers do not own task state.
- Review, audit, acceptance, correction and production-side-effect boundaries remain serialized unless a separately audited contract explicitly proves otherwise.
- `/boost` increases only the maximum **currently safe** concurrency ceiling and MUST preserve all normal verification, reviewer, evidence, phase, Audit/Test/Launch and State OS rules.
- Any uncertainty, overlap, unsupported isolation or resource pressure MUST fall back to sequential execution.
- `TODO.md` / the configured native authority remains the sole mutable task-state authority. Claims, worktrees, runtime batches and host checklists remain derived coordination state.

Current Agent manifests MUST use the corresponding dependency-safe delegation contract and expose the parallel-orchestration skill as a registered and routable Agent OS capability.

## 2.3 Reality closure and system convergence

For 3.x release closure, terminal task counts are necessary but insufficient. Multi-task phases require a canonical phase audit gate that transitively converges the complete non-cancelled phase denominator. Release-critical product journeys MUST be declared in the configured integration contract, reconciled against the product-scope journey denominator, bound to concrete black-box/runtime/browser/device/integration scenarios and collected through configured candidate-bound evidence producers.

When enabled, one canonical system release audit gate MUST transitively converge the complete active non-cancelled release denominator. A later candidate change that affects accepted contracts, control surfaces or journey seams MUST trigger current-candidate revalidation; historical `ACCEPTED` task state cannot make stale evidence current.

## 3. ExecutionKit Agent

ExecutionKit 3.0 introduces one lightweight deterministic daemon per developer device.

The Agent MUST:

- support Windows and macOS service-install targets where the distribution claims those platforms;
- supervise multiple registered ExecutionKit worktrees from one process;
- use stable device, repository and worktree identities;
- canonicalize repository identity so equivalent remote syntax such as GitHub HTTPS and SSH does not create duplicate repository identity;
- observe cheap local sentinels and bounded Git state without repeatedly parsing or uploading large canonical task files;
- accept localhost-only host activity/execution pulses from supported host adapters;
- distinguish host-active from proven execution-active state;
- batch, compress and transport versioned telemetry when a compatible control plane is configured;
- tolerate offline operation with bounded local spooling and idempotent replay;
- remove acknowledged events only after a valid matching durable ACK;
- retain events on invalid/incompatible ACK, transport failure or timeout;
- expose side-effect-free status/diagnostic inspection;
- avoid uploading source code, transcript content, canonical TODO content or local filesystem paths by default;
- hide hostname by default unless explicitly opted in;
- keep machine CPU/memory telemetry opt-in.

The Agent is not an LLM, is not an Agent OS specialist and does not choose canonical project work.

## 4. Bootstrap-mode independence

Every 3.x-distributed project MUST remain fully operable without an external fleet server.

`NOT_CONFIGURED` is a valid observability status, not an execution failure. A configured but unreachable endpoint is a telemetry degradation, not a canonical lifecycle failure. State OS, Execution OS, Agent OS, Content OS, SEO OS, Audit OS, Test OS and Launch OS continue locally according to their own authorities and applicability.

This rule specifically enables Elmasna3 to dogfood ExecutionKit while Elmasna3's own ingestion API is still being built.

### 4.1 SEO OS applicability and authority

SEO OS is a first-class conditional capability authority. Projects MUST configure `capabilities.seo` as `NONE|LITE|STANDARD|FULL` and, when SEO is configured, reconcile that depth with the managed SEO contract profile.

SEO OS owns search-domain architecture and acceptance, including as applicable:

- public organic-search surface/page-family inventory;
- search intent and entity/topic mapping;
- URL/route information architecture;
- crawlability, indexability, robots, status, redirects and sitemap policy;
- canonicalization, pagination, filters/facets and duplicate-control policy;
- rendered search accessibility for the actual rendering stack;
- internal-link architecture and orphan prevention;
- search-facing semantic HTML, metadata, breadcrumbs and media semantics;
- structured-data eligibility and registry;
- international/hreflang/canonical coordination;
- local, ecommerce, marketplace, directory, editorial/media and programmatic search modes where truly applicable;
- mobile rendering and search-facing performance budgets;
- task/wave/phase/release/production/operations gates;
- candidate-bound release evidence and declared post-launch monitoring signals.

Content OS remains authoritative for content completeness, correctness, provenance/rights, localization/editorial lifecycle and actual human-facing copy. Test OS owns verification execution/evidence. Audit OS owns independent findings. Launch OS owns release/deployment authorization. Execution OS owns any executable remediation task state. SEO OS MUST NOT become a shadow backlog.

Programmatic SEO MUST fail closed. Indexable/generated page families MUST require distinct intent, distinct visible value and explicit coverage eligibility; empty/thin/duplicate generated pages MUST NOT become indexable by default.

`node bin/validate-seo.mjs .` is the managed structural/applicability contract validator. Lighthouse or `validate-seo-performance.mjs` MAY contribute runtime/performance evidence but MUST NOT be treated as equivalent to the SEO OS authority.

## 5. Fleet protocol v1

The 3.0 telemetry protocol MUST be versioned and fail closed on incompatible protocol/ACK semantics.

At minimum it MUST define:

- protocol version;
- batch identity;
- device/session identity;
- worktree/repository identity;
- event identity and monotonic sequence per session;
- occurrence time;
- bounded event kind/source/payload;
- server compatibility range;
- ACK status, accepted count and duplicate count;
- explicit upgrade-required behavior.

Batching MUST have both event-count and byte-size bounds. Protocol-v1 event count MUST NOT exceed the schema maximum. Local configuration MUST reject values that would knowingly violate the protocol rather than relying on server rejection.

Replay MUST be idempotent. Duplicate or reordered delivery MUST NOT mutate canonical task state. An invalid or mismatched ACK MUST NOT delete local unacknowledged events.

## 6. Privacy and security

3.0 defaults MUST be privacy preserving:

- remote telemetry uses HTTPS unless an explicit development override is set;
- host pulse listener binds to `127.0.0.1` only;
- local project paths are hidden by default;
- hostname is hidden by default;
- source/TODO/transcript contents are excluded from routine telemetry;
- secrets remain outside project Git;
- stored local credentials must not be echoed by CLI/doctor/config output;
- local Agent config/identity/spool/status use user-private storage permissions where the platform supports them;
- telemetry payloads are sanitized and bounded before enqueue/transmission;
- control-plane compatibility failure is explicit rather than silently accepting partial truth.

## 7. Host adapter contract

A host adapter MAY claim only capabilities it can actually observe or invoke.

For Antigravity, the required 3.0 integration is a best-effort localhost activity/execution pulse for one unambiguous ExecutionKit workspace. A host pulse proves recent host activity only. It MUST NOT be described as proof of task completion, model context percentage, hidden model reasoning, acceptance or release authorization.

When a host exposes no reliable API/hook for a fact, ExecutionKit MUST report that fact as unknown/not observable rather than infer it from process names, edited files or conversational memory.

## 8. State OS and semantic event integration

State OS remains the cross-cutting continuity authority and is system #8. Fleet telemetry observes sanitized State/lifecycle facts; it does not replace State reconstruction.

High-frequency Agent scans MUST NOT force full State fingerprint generation. Semantic State checkpoints remain event/milestone driven. The Agent SHOULD observe checkpoint metadata cheaply and parse the small current checkpoint only when changed.

Execution, State, Agent, SEO, Audit, Test and Launch transitions MAY emit sanitized semantic events through the common local event sink. Those events MUST identify provenance and MUST NOT create a second lifecycle owner.

## 9. MCP and diagnostics

Project-local MCP in 3.x MAY expose Execution/State/SEO/Agent/fleet/discovery/candidate/evidence diagnostics and explicitly safe operations. MCP remains an interface to the local authorities, never canonical task authority.

When SEO capability is installed, the MCP surface SHOULD expose SEO status/applicability and validation without mutating canonical task state. MCP registration alone is not runtime proof.

Read-only status/list/doctor operations MUST be side-effect-free: inspecting configuration MUST NOT create identity/config/state files or start the daemon merely to answer a query.

## 10. Bootstrap, adoption and migration

Greenfield bootstrap and current migration MUST install/reconcile the current project-side managed surfaces required for supported execution/observation while preserving project authority.

Migration MUST preserve:

- canonical TODO/native task bytes and status semantics;
- stronger native specialists/resources/routing;
- State OS history semantics;
- SEO decisions/contracts when stronger/equivalent, with explicit profile/applicability reconciliation;
- manual self-hosted CI policy;
- project-specific editor/framework behavior;
- privacy defaults;
- remote control disabled for protocol v1.

The current v3 migration path MUST include the SEO OS overlay for current-distribution adoption; a successful historical base migration alone MUST NOT be represented as current SEO-integrated adoption. Mechanical migration MUST NOT fabricate search applicability, indexing, rankings, fleet enrollment, physical runner evidence, active host state, task completion, acceptance or release evidence.

## 11. Resource and network efficiency

3.0 treats efficiency as a release requirement.

Required defaults/behavior include:

- one daemon per device, not one per repository;
- adaptive active/idle scan and heartbeat cadence;
- staggered initial repository scans;
- no busy-loop full-repo parsing;
- cheap metadata sentinels before content reads;
- bounded event payloads, batches and spool size;
- gzip batching above a threshold;
- one default in-flight upload;
- exponential bounded backoff with jitter;
- no large TODO/source upload on heartbeat;
- replaceable heartbeat/host-presence coalescing before dropping semantic events where possible.

When a bounded spool must evict data, the Agent MUST surface a telemetry-gap diagnostic/state rather than pretending the external view is complete.

## 12. Elmasna3 compatibility contract

Elmasna3 is the initial reference control plane, not an authority embedded into ExecutionKit.

The compatibility contract MUST distinguish at least distribution version, Agent version, telemetry protocol version, supported capabilities and server-supported protocol range. Incompatibility MUST be explicit and observable.

ExecutionKit 3.x remains valid with Elmasna3 offline, absent or replaced by another compatible control plane.

## 13. 3.x project conformance

A project claiming current 3.x conformance MUST satisfy the preserved v2.2.4 semantic base plus applicable current project-side controls:

- current managed runtime/project validation surfaces are present and coherent;
- all seven capability authorities are configured/preserved at truthful levels;
- State OS remains enabled and routable as system #8;
- SEO applicability/profile/search-surface contract is reconciled or truthfully `NOT_APPLICABLE`;
- applicable SEO specialists are registered **and routable**;
- fleet config is observational;
- protocol-v1 remote control is disabled;
- host pulse is localhost-only;
- privacy defaults forbid routine TODO/source upload and hide local paths;
- migrations preserve canonical task bytes and native stronger controls;
- generated CI remains manual self-hosted only;
- missing fleet endpoint is `NOT_CONFIGURED`, not failure;
- any claimed runtime/physical-platform/search-engine behavior has direct evidence rather than file-presence inference.

## 14. Distribution publication, certification and release evidence

ExecutionKit 3.x MUST NOT manufacture executable, search-engine, device, runner, IDE or release evidence from architecture/document presence alone.

**Distribution publication** and **physical-device certification** are distinct states:

- publication means a coherent supported distribution version is present on repository `main` with aligned version/config/manifest/documentation surfaces;
- physical-device certification means direct current evidence proves the applicable Agent/runtime behavior on a concrete macOS or Windows device;
- project adoption/conformance remains a separate target-project evidence boundary;
- fleet connectivity remains a separate external-control-plane evidence boundary;
- SEO repository validation remains separate from external search-engine outcomes.

For any executable certification or release-evidence claim, the exact applicable candidate MUST run the canonical complete distribution gate (`npm run check`) and the evidence MUST identify the tested commit/environment. A prior PASS from a materially different candidate is stale.

Applicable SEO release evidence MUST bind the current SEO contract into candidate identity. A valid SEO contract is not proof of production crawl/index state; production/search-console/crawl evidence is required when those claims are made.

A physical macOS or Windows certification claim MUST come from that actual platform/device (or another explicitly authorized equivalent physical validation path). A result on one platform MUST NOT certify another. Missing, failed, unavailable or stale physical evidence is `NOT_RUN`/`UNVERIFIED`, never PASS.

The normal GitHub Actions path remains manual self-hosted only. Publication MUST NOT reintroduce push autorun, GitHub-hosted fallback, fake checks or fabricated artifacts merely to obtain a green release surface.

ExecutionKit 3.0.0 may remain the last published distribution while later compatible work is prepared on a branch. A later distribution MUST NOT be called published until version surfaces, changelog/publication records, canonical TODO dependencies and required evidence boundary are reconciled on `main`.

When a canonical TODO for a future version explicitly makes exact-SHA platform certification or independent audit a blocking release dependency, that dependency MUST be honored or explicitly cancelled/superseded with rationale before publication; it MUST NOT be silently skipped.

A **certified release-evidence package** additionally SHOULD include an independent authority/security/release audit after the required executable and physical evidence exists. Certification status MUST remain separate from the canonical task authority and from version-number publication.

## 15. Anti-patterns

The following are non-conforming in current 3.x:

- treating Elmasna3 as required for local project execution;
- using telemetry, SEO reports or State data as a mutable task store/scheduler;
- one daemon per repository;
- deriving current task from file edits instead of canonical lifecycle evidence;
- merging multiple machines/worktrees into one invented active state;
- calling recent host activity "execution active" without lifecycle evidence;
- transmitting TODO/source/transcript/local-path content by default;
- deleting spool data before a valid matching ACK;
- accepting an ACK for another batch;
- allowing local batch configuration to exceed protocol schema bounds;
- claiming physical runner/host integration from static repository files;
- exposing stored secrets through status/config/doctor output;
- enabling generic remote shell or protocol-v1 task mutation;
- weakening the eight-system authority model to simplify fleet/search integration;
- treating Lighthouse/performance output as the entire SEO authority;
- making indexable programmatic pages without proven distinct intent/value/coverage eligibility;
- treating repository SEO PASS as guaranteed ranking, indexing, rich results or traffic;
- labeling publication as certified release evidence when exact-candidate/device/audit proof did not actually run;
- silently bypassing a canonical blocking test/certification task instead of recording the explicit cancellation/supersession and evidence boundary;
- requiring the owner to memorize an ExecutionKit bootstrap prompt instead of supporting the canonical TODO-first entrypoint;
- treating a host Brain/task checklist as mutable task authority or allowing it to diverge from the canonical TODO;
- automatically dispatching the full self-hosted CI suite after each ordinary task/commit.

## 16. Normative references

For current 3.x, read together:

- `STANDARD.md` — preserved v2.2.4 semantic base;
- `STANDARD_V3.md` — this major-version overlay;
- `docs/capabilities/seo-os.md` — current SEO capability authority and gates;
- `docs/adoption/deep-integration.md` — canonical current deep-integration contract including `EK00-005S`;
- `docs/architecture/v3.0-scope.md` — architecture/scope;
- `docs/architecture/v3-fleet-protocol.md` — protocol contract;
- `docs/architecture/v3-bootstrap-mode.md` — control-plane-independent bootstrap behavior;
- `docs/architecture/executionkit-agent.md` — Agent architecture;
- `docs/operations/v3-publication-status.md` — publication/device-certification terminology and current 3.0.0 evidence boundary;
- `docs/operations/v3-release-validation.md` — physical-device certification/exact-SHA evidence procedure;
- `PLAYBOOK.md` — operator workflow;
- `TODO.md` — sole mutable ExecutionKit distribution work authority.

## 17. Premium Experience cross-cutting construction invariant

Premium Experience is mandatory for every **UI-bearing** product scope. It is a **cross-cutting construction invariant**, not a ninth OS, not an eighth capability authority, and not a mutable backlog. The eight-system authority model remains unchanged.

A current 3.x deep integration MUST explicitly resolve `premiumExperience.applicability` before its integration gate can be accepted:

- `REQUIRED` means the project contains user-facing web, Flutter/mobile or desktop UI. `qualityProfile` MUST be `premium`, `quality.contractPath` MUST be configured, and the referenced contract MUST use `schemaVersion=1.1.0` with `profile=premium`.
- `NOT_APPLICABLE` is allowed only for a genuinely non-UI product. `qualityProfile` MUST be `standard`, `quality.contractPath` MUST still be configured, and `notApplicableReason` MUST contain a meaningful evidence-backed rationale.
- `UNRESOLVED`, `NOT_CONFIGURED`, a missing quality contract, or `profile=standard` for UI-bearing scope MUST NOT satisfy deep-integration acceptance or activation.

The Premium 1.1 contract MUST bind product-quality acceptance to project-native design/component authorities rather than inventing a disposable theme. It MUST require, as applicable:

- one canonical semantic design/token authority with delegated/parity-tested compatibility layers only;
- canonical component governance with **extend-before-create**, stable identities, reusable consumption and covered raw-primitive bypass forbidden on product surfaces;
- shrink-only legacy design/component debt when old families still exist;
- role/surface-specific hierarchy, density, navigation and interaction language;
- complete applicable loading, skeleton, empty, error, success, disabled, permission, degraded, offline, retry and conflict states;
- responsive/adaptive behavior across declared form factors;
- declared RTL/LTR behavior, long localized content and mixed data formatting;
- accessibility across semantics, focus, contrast, target size, reduced motion, text scaling/zoom and supported input modes;
- native Flutter/desktop behavior where applicable, including safe areas/system UI, navigation/back semantics, keyboard/insets, lifecycle, permissions, deep links and connectivity;
- production-shaped data and assets rather than final mock/demo/placeholder acceptance;
- explicit anti-generic/basic/poor product-experience review;
- rendered evidence and independent visual review where required.

Agent OS MUST make the construction chain deterministically reachable. Applicable UI-stack work MUST resolve the platform specialist plus `design-system`, `component-system` and `premium-experience` resources even when the canonical task does not literally contain a `premium` tag.

The normal UI implementation lifecycle MUST be **inspect real product truth → load design/component authorities → implement complete behavior/states → render with production-shaped data → inspect → correct → re-render → targeted verification → independent Premium review when required**. Source inspection alone MUST NOT be represented as rendered acceptance.

Ownership boundaries remain strict:

- Execution OS / canonical TODO owns mutable work state and remediation tasks.
- Agent OS owns deterministic Premium/design/component routing.
- Content OS owns actual human-facing content/provenance/localization.
- SEO OS owns organic-search architecture for applicable public surfaces.
- Audit OS independently challenges Premium UI/UX, component consumption, design drift and AI-generic/basic/poor results at configured boundaries.
- Test OS owns browser/device/widget/accessibility/performance/native executable evidence.
- Launch OS consumes accepted current-candidate evidence and blocks missing/failed/not-run/stale required Premium results.
- State OS preserves reconstructable context/evidence references only.

Bootstrap MUST begin Premium applicability as `UNRESOLVED`; it MUST NOT invent a product design direction. The managed Premium starter MUST fail closed until real design authorities, component/design contracts, surfaces, roles, states and TODO-linked requirements are reconciled.

Current migration/adoption MUST preserve stronger project-native design systems, component libraries and existing quality contracts. Managed migration MAY install/reconcile the quality runtime/schema and Premium Agent protocol, but MUST NOT silently replace a native quality contract or declare a project Premium because managed files exist. The self-contained `configure-quality.mjs` path MAY create a Premium contract only when one is absent; an existing contract requires explicit reconciliation.

Static/distribution validation can prove contract coherence only. It MUST NOT be represented as rendered UI acceptance, browser/device execution, independent visual approval or release certification without direct current evidence.

## Reliable installation and activation boundary

The [unified installer contract](docs/adoption/installer.md) governs current project intake and managed upgrades. First adoption MUST preserve native code, task history, contracts and registered/routable Agent resources. Unknown completion semantics MUST be reconciled explicitly; installers MUST NOT manufacture task acceptance. The optional native-markdown adapter derives tasks from the canonical TODO and MUST NOT own mutable state elsewhere.

All product lifecycle selectors, readiness, runtime and MCP consumers MUST enforce ACTIVE plus accepted integration audit and activation with activation ancestry. Merely accepting the audit or choosing a review/correction/resume action MUST NOT bypass activation. Historical terminal tasks remain unchanged. A source upgrade MUST pause the future frontier and add a distinct canonical reconciliation phase without rewriting prior accepted integration evidence.

The installed source/receipt MAY be tracked under the exact managed runtime Git ignore exception described in the installer contract; State/derived writers MUST NOT write into those paths. A pending installation transaction MUST block task loading until recovery. CLI and MCP installation MUST share plan/apply semantics, reject stale plans/conflicts/symlink destinations, and preserve later user edits during rollback. Mechanical installation is independent of host MCP smoke, physical-device certification and canonical independent integration acceptance.

Current deep integration MUST place explicit project study after initial runtime/tool setup and before system reconciliation or product implementation. The study must consume native plans and implementation, select maturity from evidence and map project actors/surfaces/workflows/constraints to all eight systems. Gate validation MUST verify the tooling → study → independent audit dependency chain.

## 5. Reality closure and critical-journey invariant

ExecutionKit 3.x MUST distinguish **task closure** from **system/release closure** without creating a ninth OS.

- A multi-task phase is not closed merely because every member task is terminal. Its canonical phase-audit gate MUST transitively converge the complete non-cancelled phase denominator.
- Release-critical product journeys and integration seams MUST be represented by the configured integration contract. This contract is cross-cutting metadata governed by the existing Execution/Audit/Test/Launch authorities; it is not another task owner or operating system.
- Task-level verification MUST NOT be generalized into proof that a provider/consumer journey works. The owning phase/release gate MUST use applicable black-box/runtime/browser/device evidence over the real integrated path.
- When Launch OS applies under strict release truth, release readiness MUST require an exact candidate, configured trusted evidence producer(s), test-adequacy evidence and resolved critical-journey applicability. Missing proof remains NOT_RUN/blocked.
- A hand-authored label such as REAL_PRODUCTION is not provenance. Production evidence must be attributable to the configured collector/procedure, candidate, environment and observation.
- Material changes to shared seams, candidate/control inputs or runtime environment invalidate stale evidence for affected gates. Historical ACCEPTED state does not authorize reuse of stale proof for a new release.
- Migration to this invariant MUST preserve valid implementation/history and canonical TODO bytes where promised. Active projects may continue implementation, but false phase/release closure MUST fail closed until integration/evidence reconciliation is complete.

## 10. Eight-system executable runtime and project closure

### PROJECT_CLOSURE_RELEASE_INVARIANT

For a product project with Launch OS enabled, canonical task convergence is **implementation closure**, not project/release closure.

Execution OS MUST report the distinction mechanically. A project MUST NOT enter a closed/released state until the applicable release lifecycle is proven for the exact candidate:

```text
IMPLEMENTATION CONVERGENCE
→ EXACT CANDIDATE
→ RELEASE AUDIT
→ RELEASE TEST
→ PRODUCTION ARTIFACT / READINESS
→ EXPLICIT PRODUCTION AUTHORITY
→ DEPLOYMENT
→ PRODUCTION SMOKE
→ PRODUCTION HEALTH
→ PRODUCTION_VERIFIED
```

Missing Audit/Test evidence, an unconfigured deployment target, zero smoke commands, a missing health endpoint, stale candidate evidence or an unauthorized deployment MUST result in a blocked release state, never an inferred PASS.

A source/distribution repository is not a deployable product merely because Launch OS exists. It MUST use an explicit distribution-publication authority and MUST NOT fabricate product-production evidence.

### EIGHT_SYSTEM_EXECUTABLE_INVARIANT

The eight systems are runtime authorities, not names for Markdown guidance:

- **Execution OS** selects and coordinates canonical lifecycle work and gates final closure on required release truth.
- **Agent OS** resolves registered and routable roles/skills/rules/workflows/contracts and receives bounded Repository Intelligence context.
- **Content OS** maintains content authority and executable Documentation/Knowledge Fabric where configured.
- **SEO OS** executes its applicable S0–S5 search authority and evidence gates.
- **Audit OS** executes a multi-domain audit matrix, records findings and writes candidate-bound release gates; UI heuristics alone are never a full audit.
- **Test OS** executes configured trusted producers, validates reports/adequacy and writes candidate-bound release gates; reading an old report is not test execution.
- **Launch OS** owns release authorization and invokes artifact/deployment/smoke/health/rollback machinery for product releases.
- **State OS** checkpoints and rehydrates bounded execution/release context without owning task state.

Repository Intelligence / Knowledge Fabric is the cross-cutting substrate under these systems. Terrain, Repomix, CodeGraph, RTK and equivalent providers MAY enrich source-grounded understanding, change impact, relationship queries and bounded context, but live source wins and provider output cannot substitute for executed Audit/Test/Launch evidence.

### CIRCULAR_EVIDENCE_PROHIBITION

A project-authored certificate, status field, sign-off flag or prose statement MUST NOT prove the fact it asserts merely by being read back by a validator. Release-critical claims require independently executed producer/runtime evidence bound to the current candidate/environment. A validator MAY validate a certificate's structure only when the certificate itself references and binds the underlying executed evidence.
