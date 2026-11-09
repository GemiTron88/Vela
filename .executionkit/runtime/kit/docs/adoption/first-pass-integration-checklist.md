# First-Pass Deep Integration Checklist

Use this checklist **before the first write** in every new ExecutionKit adoption or material upgrade. It complements `deep-integration.md`, the selected maturity profile and `migration-policy.md`; it does not create another backlog or lifecycle.

The goal is simple: choose the correct integration shape from live repository truth on the first pass, so later EK00 work verifies/refines the plan instead of discovering avoidable topology/history/search mistakes halfway through migration.

## 1. Establish live truth first

Record before mutation:

- repository/default/current branch and exact HEAD;
- the user/repository work strategy: direct default-branch writes versus explicit feature-branch/PR flow; never invent a branch strategy that conflicts with the requested workflow;
- observable worktree/uncommitted/unpushed/interrupted state when a local worktree actually exists; remote-only/connector work must not invent local state;
- current ExecutionKit version/baseline, if any;
- canonical mutable task authority, syntax, states, dependencies and archives;
- current non-terminal frontier roots;
- historical terminal adoption/control-plane tasks and their evidence;
- existing `.agents` shape **by resource type**: roles, skills, rules, workflows, contracts, templates, manifest/routing and validators; never infer one from the presence of another;
- real product runtimes/manifests and current implementation denominator;
- supported/public/private/authenticated/native surfaces and whether any public web surface is intended for organic search;
- existing SEO/search authority and current robots/sitemap/canonical/redirect/hreflang/structured-data behavior where applicable;
- native tests/build/lint/analyze commands and known failures/skips/flakes;
- CI triggers, runner labels, allowed operating systems and physical-runner evidence;
- MCP/editor/framework integrations and what is merely configured versus actually observed;
- release/production evidence where maturity may be M3/M4.

Do not use chat memory, a remembered completion percentage or old adoption documentation as a substitute for this inventory.

## 2. Choose two independent classifications

Select both:

1. **maturity profile** (`M0`–`M4`) from observable implementation/release truth;
2. **adoption mode** from preservation/migration needs.

A rich planning-only repository can be `M0_PLANNING_ONLY + NATIVE_RECONCILIATION`; M0 does not imply empty repo or disposable planning history.

Separately classify SEO capability depth/applicability from the actual and approved surface model. A private/native-only project may resolve SEO to `NONE`/`NOT_APPLICABLE`; a public website/storefront/directory/marketplace/content surface must not be silently treated the same way.

## 3. Detect prior-adoption M0/upgrade history

If a planning-only repository already contains a previous ExecutionKit adoption:

- preserve valid historical terminal adoption tasks/evidence;
- do **not** replay old setup tasks merely because the standard version changed;
- place the new upgrade/integration phase at the **current non-terminal frontier**;
- gate that frontier through `EK00-ACTIVATE` (or native equivalent);
- return a major-version semantic upgrade to `BOOTSTRAP` without resetting product/planning history;
- document which old managed surfaces will be retired and when;
- preserve stronger prior SEO/search decisions and contracts instead of replacing them by template default.

This is distinct from a genuinely fresh M0 bootstrap.

### v1.3 Agent-resource shape check

Historical v1.3 projects do not all have the same Agent layer. Before selecting the migration shape, classify the actual resource graph instead of saying only “`.agents` exists”. Common cases include:

- **role-rich + resource-rich:** native roles, skills/rules/workflows/contracts and routing concepts already exist; preserve and compose them with managed lifecycle roles only where needed;
- **resource-rich but role-less:** domain skills/rules/workflows/contracts exist but lifecycle roles and/or machine-readable routing do not. Supply managed orchestrator/implementer/independent-reviewer roles, register every retained native resource, and compose native specialists phase/task-wise rather than inventing fake domain personas;
- **manifest-less:** files exist but there is no machine-readable manifest/routing. Registration is required, but `registered == integrated` remains forbidden;
- **minimal/generic:** the historical layer has little project-specific value; use the managed layer while preserving any stronger native controls that do exist.

A bootstrap-valid Agent overlay may be sufficient to execute EK00, but activation requires the complete retained specialist graph — including applicable SEO routing — to be deterministically reachable with independent review/audit separation.

## 4. Choose runtime topology before copying tools

Choose exactly one managed topology deliberately:

### Root-distributed tooling

Use when the supported migration/bootstrap copies managed `bin/`, `lib/`, schemas/templates/plugins into the target root and path-sensitive commands are designed for that layout.

### Isolated pinned runtime

Use when the complete kit is embedded under an excluded control-plane path such as `.executionkit/runtime/AI-ExecutionKit`.

For isolated runtime projects, verify **wrapper parity** before activation. Host-facing/plugin-generated commands may expect project-root compatibility entrypoints even when implementation lives inside the runtime.

Do not treat a short remembered wrapper list as proof of parity. Before writing or accepting wrappers, mechanically enumerate every project-root-relative command declared by the selected host/editor integration, including commands found in:

- plugin `mcp_config.json` and equivalent host configuration;
- plugin hooks and generated hook files;
- plugin rules/instructions;
- plugin skills/workflows, including documented fallback commands;
- generated host entry rules/aliases;
- project CI or host smoke scripts that invoke managed `bin/*` entrypoints.

Normalize the discovered root-relative command set (for example `bin/*.mjs`). For **every** discovered command, prove one of exactly three outcomes before activation:

1. the target project intentionally owns a compatible native root entrypoint;
2. a project-root wrapper delegates deterministically to the isolated pinned runtime;
3. the command is explicitly inapplicable to the selected host/project with a bounded reason.

An unresolved declared command is a static integration defect even if MCP may usually hide that fallback path. Re-run this enumeration whenever the pinned plugin/host bundle changes.

At minimum inspect applicability for:

- `next-execution`;
- `next-readiness` / task-context resolution;
- `resolve-task-context`;
- `runtime-status` / recovery controls;
- `coordinate-agents`;
- `setup-tooling`;
- `mcp-server`;
- `validate-seo` / SEO status when SEO is configured;
- `antigravity-hook` and editor hooks;
- discovery/reconciliation fallbacks;
- activation/deep-integration/audit/release-readiness commands;
- any other command referenced by plugin skills/rules/configuration.

Plugin/assets used by a runtime command MUST resolve from the **executing ExecutionKit runtime**, not be assumed to exist in the target project root.

## 5. Retire old managed runtime in stages

Never delete an old managed `bin/lib/schemas/plugins` surface first and hope the project still works.

Staged upgrade order:

1. install/pin the new runtime topology;
2. add compatibility wrappers/adapters;
3. migrate project-specific validators/imports to the new authority;
4. reconcile config/Agent/SEO/tooling/CI paths;
5. prove no required project/native tool depends on stale managed internals;
6. only then delete or archive the superseded managed runtime files;
7. run structural validation again after removal.

Native project validators or stronger domain/search controls are preservation targets, not collateral cleanup.

## 6. Agent OS: bootstrap-valid versus activation-complete

A material upgrade may need a minimal **bootstrap-valid** Agent overlay so EK00 can execute the task that completes Agent migration. This is allowed only inside the canonical integration phase.

Before activation, require **activation-complete routing**:

- every retained executable specialist is registered;
- every required specialist is reachable by deterministic route/supplement/task context;
- State rehydration is mechanically reachable through normal execution context;
- applicable SEO discovery/planning/technical/specialized/gate behavior is routable;
- implementation, correction/resume, review, audit and blocker lanes resolve correctly;
- reviewer/auditor separation is preserved;
- native stronger specialists are composed rather than replaced by generic managed roles;
- `.agents` owns no mutable task queue/state.

For role-less historical Agent layers, managed lifecycle roles are the default bridge; do not fabricate project personas merely to fill a roles directory.

`registered == integrated` is forbidden as an acceptance shortcut.

## 7. M0 transition contracts are mandatory

For a genuine planning-only repository, these may truthfully start empty/unimplemented:

- product discovery denominator;
- component catalog;
- design-token source list;
- Laravel/Flutter/browser/device test adapters;
- implemented SEO runtime evidence when no public page has been built yet;
- build/signing/release artifacts.

But every exception must name an observable **transition trigger**. Examples:

- first `composer.json`/Laravel application scaffold → Laravel tests/security/data adapters become applicable;
- first Flutter `pubspec.yaml`/app scaffold → Dart analyze/test/device/build controls become applicable;
- first rendered UI component/screen → component catalog/design token/rendered premium review becomes applicable;
- approved public organic-search surface intent → SEO information architecture/page-family/index-policy planning becomes applicable before implementation;
- first real public web surface → browser/accessibility/SEO/performance/content runtime evidence becomes applicable;
- first scalable/programmatic public route family → fail-closed index eligibility/coverage/value checks become applicable;
- first release artifact/environment → candidate/build/signing/release evidence becomes applicable.

Once the trigger exists, stale empty catalogs/adapters/contracts are blocking integration defects; do not continue calling them M0 N/A.

## 8. Preserve canonical task bytes/history where possible

Before large task-authority rewrites, compare counts/IDs/states/dependencies and use a diff as a preservation check. Upgrade edits should be intentionally narrow:

- add/reconcile integration tasks, including `EK00-005S` or the native SEO equivalent;
- gate the current frontier;
- preserve historical terminal evidence;
- avoid rewording unrelated product tasks;
- avoid resetting partial/review/correction/blocker state.

For native task models that cannot be edited safely, use deterministic projection rather than destructive normalization.

## 9. Seven-capability + State reconciliation must be project-specific

Do not accept generic templates as completion. Reconcile:

- Execution OS — lifecycle/readiness/frontier/recovery/audit cadence;
- Agent OS — native specialists + deterministic routing;
- Content OS — actual/planned content, localization, rights and runtime transition;
- SEO OS — capability depth, evidence-backed applicability, page-family/search intent architecture, technical/index/canonical policy, specialized modes and candidate/release gates;
- Audit OS — A1/A2/A3, premium/rendered review, component/design/system/search drift and domain risks;
- Test OS — native tests/evidence, applicability, exact-candidate and cost-aware cadence;
- Launch OS — actual release path, candidate identity, rollback, external authority and maturity-correct evidence;
- State OS #8 — cross-session reconstruction, checkpoints, Memory advisory boundary and Amnesia Test.

SEO reports/contracts and State snapshots remain non-authoritative; executable work discovered there maps to canonical TODO.

## 10. CI portability check

If `allowedRunnerOS` includes Windows and macOS, required workflow steps must be portable across both or explicitly scoped to the compatible OS. Do not make a universal gate depend on Bash-only shell syntax merely because the migration was authored on macOS/Linux.

Prefer cross-platform Node/Python validators for structural gates. Use platform-specific shells only where the job's OS contract guarantees them.

Workflow structure proves configuration, not physical runner registration/availability or successful execution.

## 11. Host/MCP/editor evidence check

Separate these states explicitly:

1. files/config registered;
2. dependencies installed/resolvable;
3. process starts;
4. tools are discovered/callable, including configured SEO status/validation surfaces;
5. host/editor/plugin sees the integration;
6. safe read-only smoke reaches the target project's current authority.

Static configuration is never runtime PASS. If the host cannot be observed, record `NOT_RUN`, `NOT_AVAILABLE`, `NOT_APPLICABLE` or an external blocker.

## 12. Pre-activation first-pass exit criteria

The initial integration design is sound only when:

- maturity + adoption mode are evidence-backed;
- repository work/branch strategy is explicit and respected;
- prior adoption/history preservation is explicit;
- the historical Agent-resource shape is classified by resource type, not inferred from `.agents` existence;
- runtime topology and product/search denominator exclusion are explicit;
- old managed-runtime retirement is staged;
- canonical EK00/frontier ancestry is correct, including SEO reconciliation ancestry;
- Agent overlay can bootstrap and has a defined final-routing gate;
- seven capability authorities plus State OS #8 are reconciled at the project's actual maturity depth;
- SEO applicability is explicit rather than inferred from missing files;
- M0/M1 applicability transitions are explicit;
- host-facing wrapper/plugin paths match the chosen topology;
- the complete enumerated host/plugin command set has no unresolved root-relative entrypoint;
- CI steps match all allowed runner operating systems;
- structural evidence is not confused with runtime/search-engine evidence;
- no product task can bypass the independent integration audit + activation gate.

After this checklist, execute the canonical EK00 tasks sequentially. Findings discovered during execution still map to `TODO.md`; the checklist itself never becomes a shadow backlog.
