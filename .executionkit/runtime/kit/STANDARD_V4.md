# AI ExecutionKit v4 — Runtime-First Standard

**Status:** V4 RUNTIME AUTHORITY on canonical main.
**Current source line:** 4.1.x compatibility reference (superseded by [STANDARD_V5.md](STANDARD_V5.md) 5.1.0 as current authority).
**Core rule:** installed files are never proof of integration, use, or success.

## Mission

ExecutionKit v4 is a CLI-first, runtime-enforced software delivery operating layer for Antigravity and compatible hosts. The human entrypoint remains the project root `AGENTS.md` plus canonical `TODO.md`; the host must not need a second prompt telling it to use ExecutionKit systems.

A v4 project is conformant only when applicable systems are invoked by the lifecycle kernel, emit current evidence, fail closed when required behavior is missing, and cannot be silently bypassed by the host.

## Ten systems

1. **Execution OS** — lifecycle, dependencies, canonical claims, safe scheduling, integration and closure.
2. **Agent OS** — routing, specialists, skills/rules/workflows/contracts, bounded multi-agent execution, isolated ownership, handoff and integration.
3. **State OS** — rehydration, continuity, drift detection, checkpoints, recovery and zero-context reconstruction.
4. **Content OS** — product content, completeness, provenance/rights, localization and editorial quality.
5. **SEO OS** — organic-search applicability, intent/entity/page-family architecture, crawl/index policy, structured data, internal discovery and release gates.
6. **Docs OS** — source-grounded project documentation and knowledge base, architecture, workflows, APIs, data, operations, deployment, decisions and glossary.
7. **Audit OS** — independent challenge of scope, implementation, evidence, security, quality and release truth.
8. **Test OS** — test selection, execution, adequacy, regression, browser/device/accessibility/performance/golden evidence and freshness.
9. **Launch OS** — exact candidate, production artifact, deployment, smoke/health, rollback and release authorization.
10. **Visual OS** — premium UI/UX authority for every UI-bearing surface and component.

Visual OS is not a cosmetic lint layer. It owns the requirement that UI is product-specific, premium, non-generic, non-basic, responsive, accessible, component-governed and independently reviewed in rendered form. Test OS owns execution of browser/device/golden/accessibility/performance test tooling requested by Visual OS.

## Knowledge & Intelligence Fabric

Repository Intelligence is shared infrastructure beneath all ten systems, not an eleventh system.

Live source always wins. v4 Repository Intelligence is **native-only** in the execution runtime:

- native bounded source packs/search/read;
- native Git status, diff and change-impact analysis;
- native macro/engineering context;
- Docs OS knowledge artifacts derived from current source.

External repository binaries such as CodeGraph, Repomix, RTK and Terrain are not part of the v4 runtime, installer, Antigravity hot path or release authority. They must not be probed, installed or invoked by v4 execution.

## CLI-first, MCP-free

MCP is not part of the v4 execution architecture. The ExecutionKit CLI is the stable machine interface.

The canonical host command is:

```bash
executionkit start . --host antigravity
```

Every command used by a host must support deterministic JSON output. Pipes/agents receive compact JSON (4096-byte target); terminals receive a readable summary. `--json` forces machine output, `--human` requests symbols and `--full-output` requests full details. Exit codes and failing status remain authoritative; truncation never certifies pending checks. Installed projects have a tracked `.executionkit/bin/ek` (Windows: `.executionkit/bin/ek.cmd`) entry even before standalone provisioning.
Standard discovery invocations used by agents/tooling are mandatory and non-destructive: `help`, `--help`, `-h`, `version`, `--version`, `-V`, and `<command> help|--help|-h`. They must succeed without executing the target operation. Unknown command/action input must return stable machine-readable JSON and a usage/discovery exit code. Node and portable-executable entrypoints must preserve identical CLI semantics.

Required command families:

```text
executionkit start|status|next
executionkit systems status
executionkit control-plane status
executionkit platform status
executionkit activation status|apply
executionkit boundary wave|phase
executionkit product status|reconcile
executionkit todo status|maintain|migrate
executionkit agents status|plan|run|delegated|collect|integrate|reconcile|cleanup|result
executionkit state status|rehydrate|checkpoint|amnesia
executionkit knowledge status|refresh|search|impact|providers|context|auto|usage
executionkit content status|discover|validate
executionkit seo status|validate
executionkit docs status|refresh|build|search|validate
executionkit visual status|validate
executionkit audit task|wave|phase|release
executionkit test impact|task|wave|phase|release
executionkit launch status|plan|build|verify|host-plan|host-check|release|deploy|rollback
executionkit reconcile status|task|wave|phase|release
executionkit providers status|doctor
executionkit guard all|assets|forms|lang
executionkit decision status|advise|refresh
executionkit install|update|upgrade|repair
executionkit doctor
executionkit rollback
```

## AGENTS.md host boot contract

The root `AGENTS.md` is the first repository-owned execution contract for Antigravity.

Before any material project mutation it must direct the host to run the v4 CLI start command and obey the returned execution envelope. The file should be compact; detailed lifecycle logic belongs in executable runtime code, not prose the host may partially ignore.

The start envelope must identify:

- exact repository/worktree truth;
- canonical current task/action or closure state;
- State OS freshness/drift;
- Agent OS route and safe concurrency plan;
- native Knowledge Fabric status when explicitly needed;
- applicable systems and required preconditions/postconditions;
- ownership/integration constraints;
- exact verification commands;
- blockers.

## Context Economy hot-path invariant

The normal model-facing execution path MUST be context-budgeted. `start|status|next` default to a compact machine envelope and MUST NOT repeat full task metadata, full TODO/shard bodies, Repository Intelligence bodies, generated documentation, full Agent manifests, or boundary-only convergence data. The compact envelope retains exact task authority pointers, route/resource references, blockers and next action.

The default fast-context budget is **12 KiB serialized JSON**. Runtime telemetry reports payload bytes and an approximate token count. `--deep` is explicit-only for debugging or lifecycle operations that genuinely need deep state; it is never an ordinary edit-loop command.

Task work loads the exact canonical task block from `sourcePath:startLine` and routed rules/skills/workflows/contracts lazily. Parallel workers consume their project-local claim and `taskRef`; they MUST NOT inherit or duplicate the orchestrator's broad conversation/repository context.

The ten-system enforcement model is unchanged. Context Economy reduces model-facing orchestration bytes; it does not bypass State/Agent/Execution requirements or defer any gate beyond its canonical task/wave/phase/release cadence.

For v4-to-v4 updates, Context Economy migration is provenance-safe. The prior immutable project-local runtime is the ownership reference for managed AGENTS and Agent OS resources. Files that still match prior managed bytes may be compacted, replaced or retired; customized/project-native files must be preserved. Retired managed resources must also be removed from manifest/routing references. Product TODO/history and product code are never rewritten merely to reduce context.

## Kernel lifecycle

Every canonical lifecycle action passes through:

```text
BOOT / TASK TRANSITION
→ CLI ENTRY RULE (NO SYNCHRONOUS HOST HOOK)
→ FAST STATE REHYDRATE
→ EXECUTION PLAN
→ AGENT ROUTE / CLAIMS
→ OPTIONAL SAFE MULTI-AGENT FANOUT
→ IMPLEMENTATION / CORRECTION
→ ORCHESTRATOR INTEGRATION
→ LIGHTWEIGHT TASK CHECKPOINT
→ NEXT

The normal task hot path does not perform full repository intelligence, Product Closure, Docs, Visual, Test or Audit scans. Those are on-demand or boundary work.

At a WAVE or PHASE boundary:
PRODUCT CLOSURE
→ TEST OS
→ CONTENT / SEO / DOCS / VISUAL RECONCILIATION
→ AUDIT OS
→ STATE CHECKPOINT

At RELEASE:
READ-ONLY PRODUCT CLOSURE
→ EXACT CANDIDATE
→ RELEASE TEST
→ RELEASE RECONCILIATION
→ RELEASE AUDIT
→ LAUNCH / DEPLOYMENT READINESS

`executionkit launch release .` owns the non-deploying exact-candidate release pipeline. `executionkit launch deploy . --authorize` is the only v4 CLI production activation path and reruns that complete pipeline before deployment; direct artifact deployment is an internal Launch OS primitive and may not bypass Test/Docs/Content/SEO/Visual/Audit release gates.
```

A system may resolve `NOT_APPLICABLE` only from inspected project/task truth. Silent omission is forbidden.

### GitHub-native factory/control-plane contract

ExecutionKit v4 does **not** depend on the legacy per-device ExecutionKit Agent. Elmasna3 and other external control planes consume GitHub directly as the repository/status transport: repository/branch/HEAD, canonical `TODO.md` shard manifest and tracked shards, commits/checks/manual workflows, and GitHub self-hosted runner state. Local Antigravity/CLI execution remains independent and must never require the factory to be online.

The factory may request execution only through **repository-defined `workflow_dispatch` workflows**. Those workflows are the typed/allowlisted command surface: GitHub selects an eligible self-hosted runner by project/OS labels, so adding or removing Linux, Windows or macOS machines does not add another ExecutionKit daemon or control protocol. Arbitrary remote shell/command execution remains forbidden.

The v4 fleet policy supports Linux, Windows and macOS self-hosted runners, including multiple devices of the same OS. Installed consumers prohibit GitHub-hosted minutes and automatic push/pull-request/scheduled runs. The canonical Kit distribution has an explicitly manual Ubuntu x64 release exception; it does not apply to installed projects. GitHub is the synchronization, observation and typed-dispatch authority; canonical task truth remains in the repository and local execution remains usable when the factory is unavailable.

`executionkit control-plane status .` validates this contract. `executionkit platform status .` validates the portable CLI/runtime contract. Automatic structured Test/Launch/provider commands are executed through the portable process adapter: direct executables remain shell-free, npm/npx use the Node CLI on Windows where available, and unavoidable Windows `.cmd`/`.bat` shims are wrapped through `ComSpec` with shell metacharacters rejected.

### Database Integrity Fabric

Database Integrity is a cross-cutting fabric beneath the ten systems; it MUST NOT become an eleventh OS or a second task authority. Database-impacting execution MUST fail closed when current schema truth cannot prove a referenced table/column/relation. Agents MUST NOT infer database facts from naming conventions, stale memory, prose, or prior tasks when executable truth is available.

The normal task hot path MUST remain performance-first: a current snapshot uses metadata/fingerprint checks only, MUST NOT reread all migrations/models, MUST NOT scan the whole repository, and MUST NOT query or cache row data. A missing/stale snapshot may be refreshed once from supported project-local database authority. Task reconciliation MUST validate only changed DB-relevant files before acceptance. Wave/phase/release reconciliation MUST run the database guard before expensive Test/Audit/deep gates and SHOULD short-circuit those gates on a blocking DB mismatch.

Required CLI surface: `executionkit db status|refresh|guard|table|column|model`. Targeted lookups are preferred over full scans. `executionkit db guard . --all` is explicit deep validation, not a per-edit default.

### Surface Integrity Fabric

`executionkit guard all|assets|forms|lang` checks changed files; `--all` is explicit deep scope. All app assets/fonts/frontend libraries must be served locally. Source checks catch remote references, literal missing assets, native form CSRF/upload/field defects and missing translation catalogs/keys. Framework-managed submissions require native runtime verification. Unproven dependency usage is a review candidate; a text heuristic cannot authorize deletion.

The surface guard participates with DB/Route guards before expensive boundary work and exact-candidate release acceptance. Browser proof must cover form success/validation and no unexpected 5xx, rendered translations, loaded local assets and mobile responsiveness. Web boundaries require fresh mobile Lighthouse reports for every declared URL with 100 performance/accessibility/best-practices/SEO, successful HTTP and candidate-bound report hashes; configure the complete URL inventory. Static heuristics cannot certify premium UI; a trusted actual image review is required.

### Test artifact economy

Keep permanent critical regressions. Exploratory tests/generated fixtures use owned temporary directories and are removed after success/failure; never delete project sources or active gate proof. The source runner isolates each regression run, and Test OS isolates each bounded command without inheriting an enclosing Node test context. Keep candidate-bound screenshots/traces/reports and useful failure evidence until their gate is retired. Passing TAP case details are omitted by default; full runner output is explicit. Cheap failing upgrade checks run first and unrun checks stay pending.

### Boundary cadence

Task completion does **not** automatically run Test OS, Audit OS, Product Closure, Docs, Visual or full Repository Intelligence. Per-task execution stays lightweight: integrate the code, write a bounded task reconciliation/checkpoint, and continue. Deep whole-product reconciliation and canonical gap tasking run at wave/phase/release boundaries, or only when explicitly requested with a deep command. Task-level tests remain available only for explicit debugging or an exceptional safety check.

Automatic heavy gates run at **wave, phase and release** boundaries. A wave/phase boundary may not close until Product Closure reports no blocking gap. Release Product Closure is read-only: a release candidate that still exposes a blocking product gap fails rather than mutating canonical work after candidate creation.

### Whole-product closure

The repository is treated as one product/system. Canonical tasks are execution slices, never proof of whole-product completeness. Product Closure compares declared scope and the live repository at wave/phase/release boundaries and explicit deep inspections. It is intentionally absent from the normal per-task hot path. Blocking discovered gaps are converted into canonical correction tasks with stable IDs and full task metadata, and persistent gaps reopen or recur instead of disappearing behind prior ACCEPTED history.

`TODO.md` is the single execution entrypoint and shard manifest. Mutable task state belongs only to its declared active shards; terminal archives remain immutable history.

During major-version adoption, stable project-native task prefixes are preserved. The default integration identities are `EK4-AUDIT` and `EK4-ACTIVATE`; a project that already uses a stable prefix may use the same prefix consistently, for example `ELM-EK4-AUDIT` and `ELM-EK4-ACTIVATE`. The configured pair is authoritative, and the installer must never create an unprefixed duplicate gate alongside a prefixed native authority.

## Multi-agent execution

`/boost` is not a plan-only feature in v4. It requests the maximum safe concurrency envelope.

Agent OS must create explicit claim envelopes containing task ID, ownership/write scope, isolated branch/worktree identity, selected role/skills/rules/workflows/contracts, bounded repository context, verification and handoff format.

Worker agents never own canonical TODO mutation or final integration. The orchestrator owns canonical claims/status transitions, conflict resolution, integration and post-integration verification.

Unknown ownership, shared schema/migrations, shared registries/tokens/auth, production side effects or stale context force sequential fallback.

## State OS

State OS is mandatory around execution transitions. It rehydrates before mutation and checkpoints after meaningful lifecycle transitions, handoffs, integration, audits and release-sensitive work.

Conversation history and host memory are non-authoritative. A stale snapshot must never overwrite live dirty work. Long-running acceptance requires the Amnesia Test to reconstruct the safe execution position without conversation history.

## Content OS

Content OS is executable and participates automatically at wave, phase and release reconciliation when applicable. Generic runtime checks cover placeholder/demo/unfinished content and baseline localization/content depth.

Content-heavy products may declare a tracked `executionkit.content.json` project contract with required shell-free Node validators. Those validators are invoked by the Content OS runtime itself and their deterministic findings/status become normal Content OS evidence, system gap tasking and release blockers. Missing or invalid required validators fail closed. This is the canonical mechanism for project/domain rules such as content provenance/licensing, taxonomy denominators, required locales, asset relationships, age/region eligibility and offline/catalog integrity; hosts must not implement those checks as detached scripts that the kernel can silently skip.

## Docs OS

Docs OS promotes the existing Documentation & Knowledge Fabric into an operating system.

It owns source-grounded generated knowledge for project overview, architecture, components, domains, features, business rules, workflows, events/jobs, interfaces/API, data, auth, integrations, configuration, storage, search/cache, notifications, payments, security, testing, deployment, operations, decisions, limitations and glossary.

Docs OS must refresh incrementally from material source/schema/config changes and validate freshness at configured boundaries. Manual documentation is preserved. Generated knowledge never overrides live source.

## Visual OS

Every detected UI-bearing product surface must resolve Visual OS applicability automatically.

Supported first-class stacks include:

- Laravel Blade / Livewire views;
- JavaScript/TypeScript frontend;
- Web Components/custom elements;
- Tailwind CSS;
- Alpine.js;
- Flutter/Dart;
- mixed web/mobile/desktop projects.

For applicable surfaces Visual OS requires:

- a canonical design/token authority;
- a reusable premium component contract/catalog;
- extend-before-create component governance;
- no raw primitive bypass where a canonical component exists;
- product-specific visual direction rather than generic AI/dashboard patterns;
- production-shaped data;
- loading, empty, error, success and disabled states, plus offline/retry where applicable;
- responsive behavior across applicable form factors;
- RTL/LTR truth where applicable;
- keyboard/touch/mouse/screen-reader behavior where applicable;
- accessibility semantics;
- independent rendered review;
- browser/device/golden/visual-regression evidence through Test OS when configured.

Static source heuristics may identify generic/basic/AI-pattern risk but may not claim visual PASS. Release PASS for an applicable premium UI requires rendered evidence bound to the current candidate.

## System implementation contract

Every system must have all six of these or it is incomplete:

1. **Trigger** — machine-observable applicability.
2. **Runtime** — executable implementation.
3. **CLI** — deterministic host interface.
4. **Kernel integration** — mandatory lifecycle placement.
5. **Evidence** — current proof or explicit NOT_RUN/NOT_APPLICABLE.
6. **Negative regression** — a test proving bypass/drift is rejected.

Markdown-only systems are forbidden.

### Host-isolated deployment model

Launch OS deployment is project-configured and MUST NOT hard-code a hosting username, home directory, domain, service account or production path.

For deployable projects:
- source/build execution may run from a declared isolated workspace such as a project-owned Antigravity workspace;
- production lives in a separate configured target;
- production receives allowlist artifacts only, never repository checkout/build state;
- immutable versioned releases plus an atomic `current` pointer are the default local-host activation pattern;
- persistent state is explicit through shared links;
- normal deploy/rollback is unprivileged after one-time host provisioning;
- root/sudo may be used only outside the release transaction for initial host provisioning such as directory/ACL ownership, service manager units, reverse proxy or TLS;
- `executionkit launch host-plan|host-check` exposes whether the declared host is ready before release activation.

Non-deployable cores/libraries/templates set `distributionRepository=true` and deployment disabled. Launch OS certifies them as `RELEASE_READY_NON_DEPLOYABLE`; `launch deploy --authorize` is invalid for them. Derived/application projects define their own target paths.

## Installer / updater / upgrader

The project-local immutable upstream snapshot and managed runtime remain the distribution boundary.

### Install

`executionkit install .` must inspect before writing, classify M0–M4 maturity, preserve native code/task/agent authorities, install the project-local runtime, reconcile `AGENTS.md`, configure Antigravity CLI-entry integration without a managed synchronous hook, configure applicable systems with native Repository Intelligence, create or reuse a canonical integration gate, run doctor and return the next action.

### Update

`executionkit update .` is same-major managed evolution. It fetches/verifies the current official source, produces a plan, updates managed runtime/blocks/config transactionally, validates, and preserves project-owned bytes.

### Invariant-aware upgrade revalidation

A Kit update MUST NOT grandfather existing `ACCEPTED`/`RELEASED` project truth when the new runtime changes an enforcement invariant. The installed runtime records a versioned invariant manifest covering all ten systems plus cross-cutting enforcement fabrics. Update/upgrade compares the previous and incoming manifests and derives only the affected validation checks.

Rules:

- normal `start|status|next` reads only the compact tracked `.executionkit/upgrade-revalidation.json` receipt; it MUST NOT load or run the heavy revalidation runner, walk source trees or invoke Test/Audit/Visual/Docs/DB scans;
- no invariant delta means no historical sweep;
- a project with no accepted/released historical baseline skips historical revalidation;
- HISTORY invariants revalidate only when accepted historical work exists; RELEASE invariants run only when release/production history exists;
- changed Database Integrity, Visual, Docs, Content, SEO, Test, Audit, Launch, Agent, State, Execution, evidence, integration, Repository Intelligence, platform/control-plane or installer invariants route only to their declared checks;
- pending mandatory revalidation blocks ordinary canonical product execution but MUST allow canonical correction tasks generated by the upgrade revalidation itself;
- failed checks become canonical correction work through Product Closure/System Gap tasking;
- the compact baseline becomes PASS only after required checks pass and upgrade correction work is closed;
- heavy work is one-time per changed invariant set. A certified baseline adds only a compact receipt read to the task hot path.

The invariant registry is executable policy, not documentation-only metadata. Any new enforcement behavior capable of invalidating old project truth MUST be represented in the registry and covered by negative/performance regressions.

### Upgrade

`executionkit upgrade .` is a major migration. v3→v4 must explicitly migrate eight-system configuration to ten systems, promote Documentation Fabric to Docs OS, promote Premium Experience to Visual OS, replace MCP host/runtime integration with CLI, migrate Agent routing/concurrency, remove external repository-tool configuration and preserve canonical TODO/history.

### Repair

`executionkit repair .` may repair only managed runtime, managed AGENTS blocks, generated adapter/config wiring. Product code changes require canonical product tasks.

### Rollback

Every mutating install/update/upgrade/repair transaction must be rollback-capable and refuse to overwrite later user/project changes.

## v4 release acceptance

The decisive black-box acceptance prompt is intentionally small:

> Open TODO and continue the project task by task.

With no additional reminder, Antigravity must enter through `AGENTS.md`, use the fast CLI task path, rehydrate bounded State, route Agent OS, use real safe multi-agent fanout when available, integrate tasks without per-task deep scans, execute Product Closure plus heavy Test/Content/SEO/Docs/Visual/Audit gates at wave/phase/release boundaries, checkpoint State, and continue until a genuine stop condition.

The host must not repeatedly invoke `start`, `status`, deep reconciliation or repository-wide scans inside one task. External repository tools are forbidden in the v4 runtime.

## Executable semantic journey layer

Test OS now runs pinned `tester-army/e2e` alongside existing deterministic suites and backend/route/database protections. Agentic Browsing 3/3 means critical happy-path, cross-feature workflow and adversarial/recovery journeys for each required actual target/role. See `contracts/agentic-e2e-contract.md` and `docs/architecture/agentic-e2e.md`. Use `executionkit test journeys .`; automatic wave/phase/release gates reject missing, stale, skipped, flaky or unproven journey evidence. Replay actions with live agent fallback; semantic assertions and independent persistence/permission/state oracles always run fresh. New tests require distinct risk mapping, never a count target.
