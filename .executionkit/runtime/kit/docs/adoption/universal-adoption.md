# Universal Adoption Protocol — current 3.x

This is the normative operator contract for applying AI ExecutionKit to a repository at any lifecycle stage. The detailed control-plane procedure lives in `docs/adoption/deep-integration.md`; maturity-specific procedures live in `docs/adoption/deep-integration-profiles/` and are part of this contract.

ExecutionKit has seven capability authorities — Execution, Agent, Content, SEO, Audit, Test and Launch — plus **State OS as cross-cutting system #8**. SEO OS is conditional by real public organic-search applicability. State OS is not a capability level, not another backlog and not a replacement for any capability authority.

## Shorthand operator intent

The instruction:

> `Add AI-ExecutionKit to <project>`

means **inspect before installing**, establish current repository/execution/runtime/release truth, classify project maturity, choose the least destructive conforming adoption mode, preserve stronger native controls and canonical task progress, install/upgrade the supported managed runtime, deeply reconcile all seven capability systems plus State OS and Agent resources, decide SEO applicability from real surfaces, create a canonical integration phase at the correct current execution frontier, configure required MCP/tool/editor/framework/CI integrations, validate native and ExecutionKit rules, independently audit the integration, and only then release the appropriate product/change frontier.

It never means “copy the template files”. Migration MUST NOT manufacture progress; task progress changed without code/test/evidence reconciliation is invalid.

## Evidence-first intake

Before choosing a mode or profile, inspect at minimum:

- default/current branch and HEAD;
- current working tree and unpushed/behind state when locally observable;
- root instruction files;
- canonical task/backlog source and task-state semantics;
- current executable/non-terminal frontier;
- existing `.agents`, roles, skills, rules, workflows, hooks, plugins, contracts and automation;
- native validators/test/build/analyze commands and known failures/skips/flakes;
- Execution, Agent, Content, SEO, Audit, Test and Launch authorities;
- existing State OS/checkpoint/recovery/memory behavior and whether it is actually usable;
- actual stack/runtime manifests and implemented product denominator;
- public/indexable, authenticated/private and native-only surfaces plus rendering/deployment boundaries;
- existing robots/sitemap/canonical/hreflang/search metadata behavior where public web exists;
- quality/component/design/content/search contracts and evidence policy when present;
- editor/MCP/framework/runtime integrations where present or required, including external Memory MCP when available;
- CI workflow triggers/runner labels/platform matrix;
- task IDs, dependencies, blockers, candidate/review/correction states and archives;
- current ExecutionKit config/version/baseline and prior adoption record;
- release environments, rollback/restore/observability/signing/provider boundaries;
- observable production deployment and search-surface evidence when production is claimed.

Never claim local-only git/IDE/MCP/Memory MCP/runner/runtime/device/production or search-engine state from remote repository evidence.

## Maturity profile — mandatory and independent from adoption mode

Every non-trivial adoption MUST classify the current target using `docs/adoption/deep-integration-profiles/README.md`:

- `M0_PLANNING_ONLY` — approved plans/TODO/contracts, no material product runtime;
- `M1_EARLY_IMPLEMENTATION` — real runtime/product code exists, implementation still early;
- `M2_ACTIVE_DEVELOPMENT` — substantial code and active partial execution history;
- `M3_NEAR_COMPLETE` — implemented denominator is largely present and work is release/acceptance hardening;
- `M4_PRODUCTION` — observable live production deployment/operational history exists.

Maturity controls **what must be preserved, which adapters/tests/search modes are applicable, where the integration gate is inserted, how much current product auditing is required, and what evidence is necessary for activation**.

Do not classify from a guessed completion percentage. If ambiguous, choose the more preservation-heavy/evidence-heavy profile; `M4` requires observable production evidence.

## Adoption modes

Adoption mode is a separate dimension describing **how authorities are migrated/preserved**.

### `NATIVE_BOOTSTRAP`

Use for a greenfield/effectively empty repository. Generate current files from templates, leave `projectState=BOOTSTRAP`, reconcile project specifics and the generated integration phase, validate, audit, then activate.

### `NATIVE_RECONCILIATION`

Use when meaningful plans/specs and a strong native task system exist but material implementation/execution history does not. Preserve approved scope and native task identity, build a deterministic adapter/projection where required, and place deep-integration work before the native product frontier without inventing completion.

### `CONTROLLED_MIGRATION`

Use when an active project has an execution system that materially violates current invariants (for example shadow backlogs, no deterministic task identity, broken agent routing or unsafe lifecycle semantics). Preserve evidence/history, back up replaced managed tooling, use a branch, make migration transactional/idempotent, then perform the canonical integration phase before new product execution.

### `COMPATIBILITY_ADOPTION`

Use when a mature active project already has healthy task IDs/lifecycle, validators, agent roles/workflows, editor integrations or stronger domain/quality/search controls. Preserve them. Register/adapt them through Agent OS and native task projection rather than rewriting for cosmetic shape. Gate the current product frontier without rewriting historical terminal work.

## Mode + maturity selection rule

Choose the **least destructive** mode that can satisfy current semantics, then apply the selected maturity profile's evidence/frontier rules.

Typical combinations are guidance, not hard coding:

| Maturity | Common safe choice |
| --- | --- |
| M0 rich planned repository | `NATIVE_RECONCILIATION` |
| M1 early code | `NATIVE_RECONCILIATION` or `COMPATIBILITY_ADOPTION` |
| M2 active development | usually `COMPATIBILITY_ADOPTION` |
| M3 near-complete | strongly prefer `COMPATIBILITY_ADOPTION` |
| M4 production | `COMPATIBILITY_ADOPTION` by default; staged controlled migration only where required |

Repository-shape consistency is never sufficient reason to discard healthy native controls.

## Canonical state safety

Migration/adoption MUST NOT manufacture progress. It MUST NOT:

- turn open/candidate/blocked work into `ACCEPTED` without current evidence;
- reset implemented/partial work to open and reimplement from scratch merely because the kit changed;
- erase blockers/review findings/cancellation rationale;
- recycle/change task IDs;
- move non-terminal work into archives;
- create a `.agents`, `.executionkit`, State, SEO-report, external-memory, quality, audit or handoff task ledger;
- weaken stronger native verification/quality/search gates;
- reconstruct historical production/release work as fake current tasks.

Adding a new unsatisfied deep-integration prerequisite can legitimately make an otherwise READY frontier task non-executable. Represent that transition truthfully using the native state model and document it in the adoption record; this is a new prerequisite, not loss of completed product work.

## Mandatory deep-integration phase

Every new adoption and material ExecutionKit upgrade that changes execution/runtime/authority semantics MUST create or reconcile a canonical integration phase before the maturity-correct current execution frontier. `EK00` is the recommended ID.

The phase MUST cover, as applicable:

1. baseline, maturity classification and preservation record;
2. current managed runtime/tools/schemas;
3. Execution OS and task adapter/projection;
4. Agent OS roles/skills/rules/workflows/contracts/templates/routing/reviewer separation;
5. State OS context recovery, semantic checkpoints, drift handling, Memory policy and zero-context Amnesia Test;
6. Content OS project-specific scope and evidence;
7. SEO OS applicability, search architecture, search-surface contract and specialized modes;
8. Audit OS boundaries, quality, premium UI/component/design/domain/search review;
9. Test OS native/adapters/test adequacy/candidate/search evidence;
10. Launch OS environments/candidate/rollback/release evidence and applicable SEO release gates;
11. MCP/tooling/editor/framework adapter installation and runtime smoke evidence, including State/SEO MCP tools and external-memory policy where available;
12. manual self-hosted CI policy/platform/runner requirements;
13. discovery/reconciliation and mapping independent product/content/design/search gaps to canonical TODO;
14. an independent deep phase audit;
15. deliberate activation.

The exact default task sequence is documented in `docs/adoption/deep-integration.md` and the current `templates/TODO.md`; the canonical starter uses `EK00-004S` for State OS and `EK00-005S` for SEO OS applicability/search architecture.

Frontier placement follows maturity:

- M0: normally all non-terminal product work waits behind activation;
- M1: preserve early implementation and gate its current future frontier;
- M2: gate all independent current non-terminal frontier roots;
- M3: gate the remaining acceptance/release frontier, not historical completion;
- M4: gate current/future maintenance/change/release work, not historical production releases.

## Native task syntax and projection

If project-native TODO syntax is not directly parseable by the generic validator, preserve storage and supply `projection-json`. Projection source hashes MUST match canonical source bytes. A stale projection blocks conformance.

The projection MUST preserve task IDs, native states/state mapping, dependencies, source references and deep-integration gate semantics. It is derived routing input, never a second status authority.

## Managed runtime topology and product-denominator safety

The complete ExecutionKit source/runtime MUST NOT pollute product discovery, UI audit, content discovery, SEO discovery or coverage denominators.

The normal bootstrap/migration path distributes supported managed project files intentionally. If a project instead embeds a complete pinned kit runtime/submodule, use an isolated ExecutionKit control path such as:

```text
.executionkit/runtime/AI-ExecutionKit
```

or prove equivalent complete discovery exclusion.

Do not embed the full kit under an ordinary product path such as `tools/AI-ExecutionKit` without explicit denominator exclusion. When the runtime is isolated, project wrappers MUST adapt activation, State OS, SEO OS, MCP, editor hooks/plugins and other path-sensitive commands; root-relative `bin/...` assumptions are invalid until adapted and tested.

## State OS — continuity across long execution

State OS exists so execution can continue safely when a conversation is compacted, a session/process restarts, the model or agent changes, the operator interrupts and returns later, or work moves between machines.

Its invariant is:

> **Context is disposable. Repository state is reconstructable.**

The resume protocol is `BOOT → REHYDRATE → VERIFY → RESUME`:

1. inspect current repository/config/task authorities instead of trusting chat;
2. read the latest State snapshot/journal and optional external memory as hints;
3. compare those hints with live branch/HEAD/worktree, canonical task state, code, Agent route and evidence;
4. continue only the current canonical lifecycle action after contradictions/drift are understood.

Default derived continuity lives under `.executionkit/state/`. It is never authoritative task state. Long-running agents must write semantic checkpoints at meaningful milestones and within the configured heartbeat window; runtime/lifecycle boundaries checkpoint automatically where configured.

External Memory MCP is optional unless deliberately required. It is always `ADVISORY_ONLY`, requires live revalidation, and MUST NOT own task status, queues, secrets or current test/SEO/release claims.

The project must pass the **Amnesia Test** after a fresh reconciled checkpoint: an agent with zero conversation history can reconstruct the current safe execution position from live repository truth plus non-authoritative State data.

## SEO OS — conditional organic-search authority

SEO applicability is a project fact that must be explicitly reconciled during adoption. Inspect public surfaces, authentication boundaries, rendering model, routes/page families, locales and acquisition intent before deciding.

- Use `NONE`/evidence-backed `NOT_APPLICABLE` for products with no public organic-search surface.
- Use `LITE|STANDARD|FULL` according to actual search complexity and evidence needs.
- Keep `capabilities.seo` and the SEO contract profile aligned.
- Treat Content OS as owner of actual content quality/provenance/editorial lifecycle; SEO OS owns search intent, crawl/index/canonical/internal-link/structured-data/search-architecture rules.
- Enable local/ecommerce/marketplace/directory/editorial/media/international/programmatic modes only when real.
- Programmatic surfaces default to non-indexable until distinct intent, visible value and coverage eligibility are proven.
- Candidate-bound SEO release validation does not guarantee external indexing/ranking/rich-results/traffic.

The managed structural validator is:

```bash
node bin/validate-seo.mjs .
```

Release contract validation is:

```bash
node bin/validate-seo.mjs . --release
```

Lighthouse/search-facing performance tooling is optional evidence, not the entire SEO authority.

## Deep-integration configuration

Projects using the mechanical adoption guard declare State/deep-integration policy plus current capability configuration. The managed config also names the SEO contract when SEO capability is installed:

```json
{
  "capabilities": {
    "seo": "STANDARD"
  },
  "seo": {
    "contractPath": "executionkit.seo.json",
    "requiredForRelease": true
  },
  "state": {
    "enabled": true,
    "snapshotPath": ".executionkit/state/latest.json",
    "journalPath": ".executionkit/state/journal.ndjson",
    "checkpointOnRuntimeTransitions": true,
    "requireRehydrateOnDrift": true,
    "heartbeatMinutes": 20,
    "memory": {
      "mode": "auto",
      "authority": "advisory",
      "requireLiveRevalidation": true,
      "allowTaskState": false
    }
  },
  "adoption": {
    "deepIntegrationRequired": true,
    "integrationPhase": "EK00",
    "integrationGateTaskId": "EK00-AUDIT",
    "productExecutionBlockedUntilGateAccepted": true
  }
}
```

A project in `BOOTSTRAP` may execute integration tasks. It MUST NOT activate until the configured integration audit gate satisfies project dependency-acceptance semantics. READY/IN_PROGRESS work outside the integration phase must not bypass the configured gate ancestry when product blocking is enabled.

For `M4_PRODUCTION`, `projectState=BOOTSTRAP` means normal ExecutionKit-controlled product/change execution is paused for reconciliation. It does **not** assert that the currently deployed service is offline or unlaunched.

## Agent layer reconciliation

Classify target `.agents` as:

- `missing` — install managed canonical foundation;
- `partial` — preserve existing content and install/register a current overlay;
- `mature` — preserve native resources, register them with unique IDs, install only missing current controls and deliberately reconcile routing.

Do not duplicate equivalent roles/skills or overwrite native resources by filename coincidence. Native specialists must be reachable from machine-readable routing; file presence alone is not integration. Editor adapter files do not prove runtime loading.

State OS follows the same rule: `skill.state-rehydration` must be registered and mechanically reachable through routed task-context/runtime/handoff behavior. Applicable SEO skills follow the same rule through task tags/supplements. `registered == integrated` is forbidden.

## Seven capability authorities + State OS

Adoption is not complete until all enabled capability authorities are project-specific/coherent and State OS continuity is integrated:

- **Execution OS:** task authority, lifecycle, dependencies, projection, scheduler, audit/integration gates, recovery/archive and maturity-correct frontier.
- **Agent OS:** manifest, native resources, routing, reviewer separation and specialist skill composition; State rehydration and applicable SEO specialists must be routable.
- **Content OS:** real content inventory/sources/rights/localization/editorial/distribution/depth requirements where enabled.
- **SEO OS:** evidence-backed applicability; page-family/search-intent/index/canonical/internal-link/structured-data/specialized-mode/gate policy where enabled; no search-outcome guarantees.
- **Audit OS:** deep/honest/full semantics, wave/phase/release boundaries, finding remediation, rendered premium/component/domain/search audits where applicable; pre-existing product audit depth increases from M1 through M4.
- **Test OS:** native suites, adapters, adequacy, browser/device/security/data/offline/performance/search evidence and phase-CI cadence; M0 may use explicit planning-only transition states only while runtimes truly do not exist.
- **Launch OS:** exact candidate, environments, migrations/backups/rollback, signing/deployment, observability and release readiness; M3/M4 reconcile the actual release/production path, including applicable SEO release/production gates.
- **State OS:** project authority/config, derived snapshot/journal isolation, live drift reconciliation, semantic heartbeats, Memory policy and Amnesia Test; never task authority.

Generic template presence without project reconciliation is not completion.

## MCP/tooling/editor completion gates

Where MCP/tooling is required, setup must be a canonical integration task and must distinguish:

- managed server/adapter files present;
- isolated dependencies installed/resolvable;
- MCP server starts;
- expected tools are discoverable/callable, including `executionkit_state_*` and, when SEO is installed, `executionkit_seo_*`;
- editor/plugin/framework adapter is registered;
- actual editor/framework/runtime smoke evidence exists;
- external Memory MCP availability/policy is observed or truthfully N/A/unavailable rather than inferred.

For Antigravity or another editor, distinguish repository registration, editor discovery/config and local runtime smoke test. For Laravel/Flutter projects, evaluate Laravel Boost and Dart MCP according to the actual stack. Missing optional tools are `NOT_AVAILABLE`/`NOT_CONFIGURED`/`NOT_APPLICABLE`, never fake PASS.

If an isolated runtime is used, host integration must target that actual pinned runtime path or a project wrapper; merely copying the central plugin with stale root-relative commands is incomplete.

## CI policy

Default project policy remains manual project-isolated self-hosted CI:

- `workflow_dispatch` only;
- project-specific runner label;
- no GitHub-hosted fallback;
- no automatic push CI;
- at most one runner registration for the same project per physical device;
- macOS and/or Windows according to actual project needs.

Repository workflow validation proves structure only. Physical runner registration/availability requires direct evidence. Expensive full CI normally runs on the final corrected phase candidate after A2 audit/remediation; targeted checks remain in task/wave loops.

Structural CI should validate State OS and configured SEO contract/applicability, but the Amnesia Test belongs to a reconciled canonical State integration/acceptance gate because a clean checkout intentionally does not contain the local derived State checkpoint.

M0 may truthfully defer product-runtime suites that cannot exist yet. M1–M4 must reconcile currently detected runtimes and may not hide them as `NOT_IMPLEMENTED` simply to finish adoption.

## Production safety boundary

For M4, deep integration is a repository/control-plane migration unless separate explicit authority says otherwise. It MUST NOT by default deploy, mutate live data, run destructive production migrations, rotate secrets, change DNS/provider/store configuration, restart services, change search indexing directives in production or alter production feature flags.

Perform migration in a branch/staging context, preserve existing release/runbook/search controls, and activate the ExecutionKit control plane for **future work** only after independent integration audit. Urgent active incident/hotfix authority remains explicit and must not be silently blocked by a broad migration procedure.

State OS recovery does not grant production authority. It only reconstructs the context needed to decide what the already-authorized canonical action is.

## Adoption record

Non-trivial adoption SHOULD record `docs/executionkit/ADOPTION.md` containing:

- selected maturity profile and live-evidence rationale;
- selected adoption mode and rationale;
- baseline branch/HEAD;
- observed local-state limitations;
- prior and target ExecutionKit versions;
- managed runtime topology/path and denominator exclusion decision;
- TODO/native source and state mapping;
- current execution frontier and how the integration gate blocks it;
- `.agents` classification and preserved native resources;
- State OS authority/config, rehydration/Amnesia evidence and external-memory policy;
- SEO capability/profile/applicability/search-surface/specialized-mode decision and evidence boundary;
- tooling conflicts/backups/replacement decisions;
- projection adapter if any;
- seven capability-authority reconciliation decisions;
- quality/component/content/search/editor/MCP policy changes;
- validators/tests/runtime smoke checks actually executed and results;
- CI/runner evidence boundary;
- integration audit result;
- activation/release/production-safety state.

This record is metadata/evidence, not a second backlog.

## Product/stack/editor completion gates

Inspect the actual stack/editor/product contract rather than assuming generic files are enough. When a project explicitly requires premium UI, heavy SEO, rich managed content, offline behavior, AI, payments or stronger evidence, configure the relevant quality/domain contracts and specialist skills. Inventory relevant subjects/dimensions and map real canonical task IDs.

Configure Content depth according to actual content scope, SEO depth according to actual public search complexity, and specialist skill tags according to the real stack. Preserve official framework tooling.

## Adoption completion

Adoption/deep integration is complete only when:

- maturity profile and adoption mode are recorded from current truth;
- canonical task state/history is preserved or every intentional state change has evidence/rationale;
- no second backlog exists;
- current managed project-local tooling/runtime topology is installed/reconciled and excluded from product/search denominators;
- all seven enabled capability authorities are project-specific/coherent;
- State OS is project-specific, derived/non-authoritative, drift-aware and passes a zero-context Amnesia Test from a fresh reconciled checkpoint;
- SEO applicability/profile/search-surface contract is reconciled or evidence-backed `NOT_APPLICABLE`;
- external Memory MCP, if used, is `ADVISORY_ONLY` and live-revalidated;
- Agent manifest/resources/routes validate and retained native resources plus State rehydration/applicable SEO specialists are routable;
- lifecycle-aware scheduler sees audit/candidate/correction/resume/actionable-blocker lanes correctly;
- `PLANNED` is not auto-implemented and `IMPLEMENTED` is non-terminal;
- the deep-integration phase exists in canonical task authority, including State OS and SEO OS reconciliation;
- the maturity-correct current frontier cannot execute before integration activation;
- configured MCP/tool/editor/framework structural and runtime evidence is truthful;
- native + ExecutionKit validators pass;
- configured quality/editor/search structural gates pass without overclaiming runtime or external search outcomes;
- currently applicable product runtime tests/adapters are not hidden as N/A;
- manual self-hosted CI policy is preserved unless an explicitly approved stronger exception exists;
- the independent integration audit is accepted;
- project is reactivated only after the integration gate and profile-required local/runtime evidence pass;
- for M4, production truth/service/search continuity remains distinct from ExecutionKit control-plane state and no unauthorized live side effect occurred.

## Compatible current migration rule

Current distribution adoption uses `node bin/migrate-current.mjs --target <project>` as the router. On current v3 distributions it composes the v3 managed base migration with the SEO OS overlay. Dry-run remains the default; canonical TODO bytes are preserved during mechanical tooling migration; conflicting managed files require explicit reconciled replacement permission.

Compatible manifests may retain resource IDs/routing when valid while current migration updates supported standard/runtime semantics. Deep-integration task insertion/reconciliation — including project-specific `EK00-004S` State OS and `EK00-005S` SEO OS tasks or semantic native equivalents — is a deliberate canonical-authority operation performed after safe migration, not a hidden side effect.

Previously accepted aggregate-only/raw test or SEO reports may fail stricter current evidence boundaries. Regenerate current-candidate evidence; never weaken a native check or edit evidence into PASS merely to finish adoption.

## Automatic installation entrypoint

`node /path/to/AI-ExcutionKit/bin/executionkit.mjs install /path/to/project --auto` prepares a safe managed runtime and the canonical deep-integration chain. Omit `--auto` for an exact dry-run plan. The [installer contract](installer.md) defines planning-only/native-TODO intake, preserving code and terminal history, guarded upgrades, doctor, rollback, source fingerprints and CLI/MCP parity. Unknown native semantics remain explicit reconciliation requirements; core installation does not independently accept project study, host tools or activation.
