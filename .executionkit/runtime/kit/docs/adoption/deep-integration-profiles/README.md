# Deep-Integration Maturity Profiles

This directory is the mandatory maturity router for applying AI ExecutionKit deep integration to a repository. Read it together with `../universal-adoption.md`, `../deep-integration.md` and the pre-write [`../first-pass-integration-checklist.md`](../first-pass-integration-checklist.md).

## Core distinction

**Adoption mode and project maturity are different dimensions.**

Adoption mode answers **how existing authorities should be preserved/migrated**:

- `NATIVE_BOOTSTRAP`
- `NATIVE_RECONCILIATION`
- `CONTROLLED_MIGRATION`
- `COMPATIBILITY_ADOPTION`

Maturity profile answers **what implementation/runtime truth already exists and therefore what must be preserved, gated and evidenced**:

| Profile | Observable project state | Typical adoption modes |
| --- | --- | --- |
| `M0_PLANNING_ONLY` | approved plans/TODO/contracts exist, but no material product runtime/code exists | `NATIVE_BOOTSTRAP` for empty repos; usually `NATIVE_RECONCILIATION` for rich planned repos |
| `M1_EARLY_IMPLEMENTATION` | framework/runtime and some real product code exist, but implementation is still early and not release-like | `NATIVE_RECONCILIATION`, `COMPATIBILITY_ADOPTION`, or `CONTROLLED_MIGRATION` if native semantics are unsafe |
| `M2_ACTIVE_DEVELOPMENT` | substantial product code and partial/active execution history exist across multiple areas | usually `COMPATIBILITY_ADOPTION`; `CONTROLLED_MIGRATION` only where invariants are genuinely broken |
| `M3_NEAR_COMPLETE` | product is feature-heavy/release-hardening/RC-oriented, even if some canonical work remains | strongly prefer `COMPATIBILITY_ADOPTION`; controlled migration only when required |
| `M4_PRODUCTION` | a real deployed/live production system and operational history exist | `COMPATIBILITY_ADOPTION` by default; staged `CONTROLLED_MIGRATION` only for unsafe control-plane semantics |

Do not classify by a guessed percentage. Use repository/runtime/release evidence. A project described as “90% complete” is `M3` only when its observable work is release-hardening/acceptance oriented; otherwise it may still be `M2`.

## Deterministic classifier

Use this order before changing the target repository:

1. If current production deployment/operations evidence exists, select `M4_PRODUCTION`.
2. Else if the project has release-candidate, store/deployment/signing/go-live/hardening behavior and the main implementation denominator is materially present, select `M3_NEAR_COMPLETE`.
3. Else if substantial implementation exists across multiple product areas and there is active/partial execution history, select `M2_ACTIVE_DEVELOPMENT`.
4. Else if any real product runtime/manifest plus meaningful product implementation exists, select `M1_EARLY_IMPLEMENTATION`.
5. Else select `M0_PLANNING_ONLY`.

When classification is ambiguous, choose the **more preservation-heavy/evidence-heavy** profile. Never claim `M4_PRODUCTION` without observable production evidence.

Record the selected maturity profile and rationale in the project adoption record. Reclassify only when live project truth changes materially. Use [`ADOPTION_DECISION_TEMPLATE.md`](ADOPTION_DECISION_TEMPLATE.md) as a bounded evidence/decision record when useful; it is never a backlog.

Before the first migration write, complete the first-pass checklist. In particular, identify prior ExecutionKit/adoption history, select managed-runtime topology, plan staged retirement of old managed files, decide whether the Agent overlay needs a bootstrap-valid intermediate state, enumerate host-facing wrapper/plugin paths, define maturity transition triggers and check CI shell portability.

## Universal rules across all profiles

Regardless of maturity:

- inspect live repository/task/runtime truth before mutation;
- preserve one canonical mutable task authority;
- preserve stronger native Execution/Agent/Content/SEO/Audit/Test/Launch controls;
- preserve task IDs, blockers, review/correction state and historical terminal evidence;
- preserve valid prior adoption/control-plane history instead of replaying it during an upgrade;
- never manufacture progress or runtime evidence;
- reconcile `.agents` resources into deterministic **reachable** routing rather than merely copying/registering files;
- use one canonical integration wave/phase (`EK00` or native equivalent) for adoption work;
- reconcile `EK00-005S` or a semantically equivalent SEO task so public-search applicability is an explicit evidence-backed decision before the integration audit;
- classify actual public/indexable web surfaces separately from private/authenticated panels, APIs and native apps; `NOT_APPLICABLE` is valid only when supported by the observed surface model;
- preserve stronger existing SEO architecture, redirects, canonicalization, structured data, sitemap/robots and search-monitoring rules instead of overwriting them with generic defaults;
- use fail-closed programmatic indexability: generated routes are not indexable merely because they exist;
- gate the correct **current execution frontier**, not historical completed work;
- stage old managed-runtime retirement after wrappers/imports/config/tooling have migrated;
- distinguish structural installation from observed host/runtime/search-engine evidence;
- ensure path-sensitive host/plugin entrypoints match the chosen runtime topology;
- map independent findings back into canonical task authority, never into an audit/SEO/report shadow backlog;
- activate only after the independent integration audit and profile-appropriate evidence pass.

## Runtime placement rule

A managed ExecutionKit source tree must never pollute product discovery, UI audit, content discovery, SEO surface discovery or coverage denominators.

Two supported topologies exist:

1. **Root-distributed managed tooling** — the normal bootstrap/migration layout where supported `bin/`, `lib/`, schemas and templates are intentionally copied into the project and validators understand those managed paths.
2. **Isolated pinned runtime** — when a project deliberately embeds the complete kit as a submodule/vendor runtime, place it under an ExecutionKit-excluded control path such as `.executionkit/runtime/AI-ExecutionKit`, or prove an equivalent complete discovery exclusion.

Do **not** place a full ExecutionKit source checkout under an ordinary product path such as `tools/AI-ExecutionKit` unless every discovery/audit/SEO denominator explicitly excludes the complete tree.

If an isolated runtime is used, project wrappers/adapters MUST translate all path-sensitive commands. In particular, activation, scheduler/task-context helpers, runtime status/recovery, MCP, editor hooks/plugins and host adapters must not assume the kit's `bin/` lives at the project root. Plugin assets used by a runtime command must resolve from the runtime executing the command rather than being assumed to exist in the target project root.

## Host/editor/MCP evidence rule

Static plugin/config files prove **wiring only**. Acceptance of a required host integration requires profile-appropriate direct evidence that:

- dependencies are installed/resolvable;
- the MCP process starts when applicable;
- expected tools are discovered/callable, including applicable SEO status/validation surfaces;
- the editor/framework/plugin actually sees the configured integration;
- a safe read-only smoke action reaches the current project authority.

If the host cannot be observed, record `NOT_RUN`, `NOT_AVAILABLE`, `NOT_APPLICABLE` or a blocker. Never convert static files into PASS.

## CI portability rule

If an integration workflow can target multiple operating systems, every universal required step must be portable across those OSes or explicitly scoped. A Windows/macOS self-hosted gate must not accidentally depend on Bash-only syntax. Workflow structure still does not prove a physical runner exists or ran.

## Profile-specific playbooks

- [`M0_PLANNING_ONLY.md`](M0_PLANNING_ONLY.md)
- [`M1_EARLY_IMPLEMENTATION.md`](M1_EARLY_IMPLEMENTATION.md)
- [`M2_ACTIVE_DEVELOPMENT.md`](M2_ACTIVE_DEVELOPMENT.md)
- [`M3_NEAR_COMPLETE.md`](M3_NEAR_COMPLETE.md)
- [`M4_PRODUCTION.md`](M4_PRODUCTION.md)

The profile playbook changes **intake, preservation boundaries, frontier gating, applicability, evidence and activation strategy**. It does not create another OS or backlog; the current model remains seven capability authorities plus cross-cutting State OS as system #8.
