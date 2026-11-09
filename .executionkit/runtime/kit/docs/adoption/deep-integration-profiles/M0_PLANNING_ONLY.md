# M0_PLANNING_ONLY — Rich plans, no material product runtime

Use this profile when the repository is primarily plans/specifications/contracts/TODO/Agent resources and no meaningful Laravel/Flutter/web/mobile/product runtime has been implemented yet.

This is common for heavily planned AI-first projects. It is **not** the same as an empty repository, and it is not proof that previous control-plane/adoption history is disposable.

Read [`../first-pass-integration-checklist.md`](../first-pass-integration-checklist.md) before the first migration write.

## Primary objective

Build or upgrade a complete execution control plane **before the first/current product implementation frontier** without fabricating product/runtime/search evidence or replaying valid historical adoption work.

## M0 subcases — classify before writing

### Fresh/bootstrap M0

The repository has no meaningful prior ExecutionKit adoption/control-plane history. `NATIVE_BOOTSTRAP` may be appropriate for an effectively empty repository; rich native planning usually still prefers `NATIVE_RECONCILIATION`.

### Prior-adoption/upgrade M0

The repository is still product-runtime planning-only but already contains historical ExecutionKit/control-plane adoption, terminal setup tasks, validators or a mature native `.agents` layer.

For this subcase:

- preserve valid historical terminal adoption tasks/evidence;
- do not replay old setup tasks merely because the kit version changed;
- return a major semantic upgrade to `BOOTSTRAP` without resetting historical task truth;
- insert/reconcile `EK00` at the **current non-terminal frontier**;
- gate the current product/planning frontier through `EK00-ACTIVATE`;
- migrate/retire old managed runtime surfaces in stages rather than deleting them first;
- preserve stronger native validators, SEO/search decisions and mature specialist resources.

This distinction is mandatory. A repository can be `M0_PLANNING_ONLY` and still have years of planning/control-plane history worth preserving.

## Default preservation strategy

- Empty/effectively empty repository: `NATIVE_BOOTSTRAP` may be appropriate.
- Rich plans/native TODO/strong `.agents`: prefer `NATIVE_RECONCILIATION`.
- Preserve approved product plans, task IDs, dependencies, lifecycle semantics and stronger domain contracts exactly unless a real contradiction is found.
- Preserve historical terminal adoption/control-plane evidence during upgrades.
- Do not turn planning readiness into implementation or acceptance.
- Use task-authority diff/count/ID checks when inserting EK00 into a large existing TODO so unrelated plans are not silently rewritten.

## Integration frontier

Create/reconcile `EK00` before the first/current product execution frontier. In a planning-only project it is normally valid to gate **all non-terminal product work transitively** through `EK00-ACTIVATE`, because no product implementation history is being invalidated.

For prior-adoption M0, completed historical setup/planning tasks stay terminal; gate the current frontier rather than rewriting history to make every old task depend on the new audit.

Historical planning metadata is not product implementation history. Do not mark existing product tasks `ACCEPTED` merely because their plans are detailed.

## Runtime/tool applicability

Before a product runtime exists:

- Laravel/PHP runtime adapters: `NOT_APPLICABLE` unless an actual Laravel runtime exists.
- Flutter/Dart/device adapters: `NOT_APPLICABLE` unless an actual Flutter runtime exists.
- browser/Lighthouse/UI runtime evidence: `NOT_APPLICABLE` unless rendered product surfaces exist.
- SEO runtime evidence: `NOT_APPLICABLE` until a real public organic-search surface exists, but SEO **planning applicability** must still be decided from approved product intent; a planned public site/storefront/directory is enough to require search architecture before implementation.
- product CI runtime state may be explicitly `NOT_IMPLEMENTED`.
- MCP/editor control-plane integration may still be applicable because it concerns the execution host, not product runtime.

The first appearance of a real runtime manifest/surface MUST trigger the configured transition rule and make the corresponding Test/quality/framework/search controls applicable before that implementation can be accepted.

Recommended triggers include:

- Laravel/composer application scaffold → Laravel tests/security/data/migration adapters;
- Flutter `pubspec.yaml`/application scaffold → Dart analyze/test/device/build adapters;
- first rendered screen/component → component catalog/design token/rendered premium audit;
- approved public web intent → `EK00-005S` must define planned information architecture, index-policy boundaries and page-family contracts without fabricating runtime proof;
- first real public web surface → browser/accessibility/SEO/performance/content discovery plus representative render/crawl evidence;
- first scalable/programmatic route family → fail-closed search eligibility until distinct intent, visible value and coverage thresholds are proven;
- first release artifact/environment → candidate/build/signing/release evidence.

## Discovery, scope, component, design and SEO contracts

Planning-only projects must be truthful rather than artificially “complete”:

- an empty implemented-surface denominator is allowed only when the repository genuinely has no product runtime;
- component catalogs may be empty only with an explicit state such as `PLANNED_NOT_IMPLEMENTED` and a transition rule requiring registration of real components when implementation begins;
- design token files may be empty only with an equivalent transition rule;
- discovery `required[]` may be temporarily empty only when bound to the planning-only state and unable to satisfy release readiness;
- SEO `surfaceFamilies[]` may be empty only when no approved public-search page family exists yet; if public-search surfaces are already part of approved intent, declare the planned families and keep runtime evidence `NOT_RUN`/`NOT_IMPLEMENTED` rather than erasing the requirement;
- quality requirements SHOULD already describe approved premium/domain/search acceptance expectations when those expectations are known.

Once the corresponding runtime/UI/search trigger exists, a stale empty denominator/catalog/token/SEO surface model is a blocking integration defect, not a continuing M0 exemption.

Do not invent component names/paths/token files/search URLs just to make a validator configured.

## Managed runtime placement and staged retirement

If the full ExecutionKit is embedded as a pinned submodule/runtime, use an isolated control-plane path such as:

```text
.executionkit/runtime/AI-ExecutionKit
```

The runtime source must be excluded from product discovery/audit/SEO denominators.

For a prior-version upgrade, retire stale managed runtime surfaces in this order:

1. pin/install the new runtime;
2. create required project compatibility wrappers/adapters;
3. migrate project-specific imports/validators/config paths;
4. prove host/editor/MCP/CI paths target the new runtime;
5. only then remove superseded managed `bin/lib/schemas/plugins` files;
6. revalidate after removal.

Do not delete a mature project's custom validators merely because they lived beside older managed files.

## Isolated-runtime host wrapper parity

Path-sensitive host/plugin commands must work from the target project root even when implementation lives in the isolated runtime. Inspect at minimum `next-execution`, readiness/task-context, `resolve-task-context`, runtime status/recovery, coordinator, tooling setup, MCP server, SEO status/validation, Antigravity hook, activation, audit and release-readiness entrypoints.

Plugin assets are sourced from the **executing ExecutionKit runtime**. A runtime command must not assume its own plugin bundle exists in the target project's ordinary product root.

## Agent migration: bootstrap-valid versus activation-complete

A prior-adoption M0 project may temporarily need a minimal **bootstrap-valid** Agent overlay so EK00 itself can execute the task that completes routing. This prevents a circular adoption deadlock.

Activation still requires **activation-complete routing**:

- every retained executable specialist is registered;
- every required specialist is reachable by deterministic route/supplement/context;
- applicable SEO discovery/planning/gate skills are routable from the SEO integration task and later search-facing tasks;
- implementation/correction/review/audit/blocker lanes are sound;
- reviewer separation is preserved;
- native stronger specialists are composed rather than replaced by generic roles.

`registered == integrated` is not an acceptance rule.

## CI portability

If the project permits both macOS and Windows self-hosted runners, universal structural gates must be cross-platform or explicitly scoped by job OS. Avoid Bash-only mandatory checks on a job that can run on Windows; prefer Node/Python structural validators where practical.

Workflow configuration proves policy structure only. Physical runner registration/availability and actual execution remain separate evidence.

## Mandatory M0 evidence

At minimum prove:

- exact repository and ExecutionKit baseline identity;
- fresh-vs-prior-adoption M0 subcase and preservation rationale;
- canonical task authority and preserved task count/IDs/states/history;
- faithful native lifecycle/dependency projection when native syntax is retained;
- complete seven-capability authority reconciliation at planning depth plus State OS continuity;
- explicit SEO applicability decision and `EK00-005S` ancestry before the integration audit;
- complete/routable Agent manifest with independent reviewer route;
- bootstrap-valid versus final-routing boundary when an upgrade requires it;
- project-specific quality/content/scope/SEO/adapter transition contracts;
- selected runtime topology, denominator exclusion and staged old-runtime retirement;
- manual self-hosted CI policy structure and OS portability;
- MCP/editor wiring and host smoke evidence when available/required;
- product tasks cannot bypass `EK00-ACTIVATE`;
- independent `EK00-AUDIT` acceptance before activation.

## Acceptance traps to avoid

The most dangerous M0 failures are:

1. **fake runtime completeness** — absent code/tests/devices/browser/search surfaces reported PASS;
2. **history replay** — valid prior adoption/terminal planning tasks reset or reimplemented for version aesthetics;
3. **registered-only Agent OS** — specialists retained in files/manifest but unreachable from execution routing;
4. **premature cleanup** — old managed runtime deleted before native/project references migrate;
5. **topology mismatch** — isolated runtime chosen but host/plugin commands still assume root-distributed assets;
6. **permanent M0 exemption** — empty component/design/test/SEO contracts remain empty after the applicable product/search implementation starts;
7. **route-equals-indexable thinking** — planned/generated routes are treated as search-eligible without distinct intent/value/coverage proof.

After `EK00-ACTIVATE`, the scheduler chooses the first dependency-ready product action from current canonical authority. Do not hard-code a remembered first task.
