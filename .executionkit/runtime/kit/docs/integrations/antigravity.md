# Antigravity integration — current 3.x

Reference checked 2026-09-12. Verify the installed editor version on each Mac or Windows device; this repository cannot observe a user's IDE process remotely.

## Four different checks

1. **Agent OS registration/routing** — manifest paths/resources/routing resolve, including State rehydration and applicable SEO specialists.
2. **Workspace plugin discovery** — ExecutionKit plugin/skills/rules/hooks/MCP files are installed in supported workspace locations, including the `ek-seo` host skill for current bundles.
3. **Runtime activation** — the installed editor exposes the plugin/resources and MCP/hook integration to a live same-session verification boundary.
4. **Product execution evidence** — browser/device/framework/search-facing tool actions actually ran against the intended candidate/environment.

Repository validators can prove 1 and the file contract for 2. They cannot manufacture 3 or 4. Record direct runtime evidence when those claims matter.

`doctor` also runs execution integrity. Invalid task state or other integrity failures make its `ok` false and suppress its next-task suggestion. `doctor` is diagnosis, not product or SEO acceptance, and it cannot replace live-verification host acceptance.

## Preferred live-verification local bootstrap

For a prepared/adopted project, the canonical operator path is the pinned local bootstrap contract in [`docs/executionkit/local-antigravity-bootstrap.md`](../executionkit/local-antigravity-bootstrap.md), not direct plugin installation. The launcher resolves official GitHub `main` into an immutable project-local `.executionkit/source/AI-ExecutionKit/<sha>` snapshot and materializes the runtime in the same project. Shared local Kit checkouts/caches are forbidden as project source authority and project agents must never modify them.

A prepared project normally starts with:

```bash
node scripts/executionkit-bootstrap.mjs
```

From a trusted standalone ExecutionKit checkout, the equivalent distribution-side paths are:

```bash
npm run project:bootstrap:export -- /path/to/project
npm run project:bootstrap -- /path/to/project --source /path/to/AI-ExcutionKit --apply
```

The required lifecycle is:

```text
PINNED SOURCE VERIFIED
→ RUNTIME MANIFEST VERIFIED
→ RUNTIME INSTALLED
→ ANTIGRAVITY CONFIGURED
→ HOST SURFACE FINGERPRINTED
→ HOST_VERIFY_PENDING
→ continue in the current Antigravity session
→ fresh live-boundary PreInvocation hook observation
→ post-boundary ExecutionKit host MCP process/session
→ executionkit_host_accept over that MCP session
→ HOST_VERIFIED
→ EK00 deep integration
→ independent EK00 audit
→ EK00-ACTIVATE
→ product execution
```

When bootstrap returns `HOST_VERIFY_PENDING`, keep the current Antigravity process and complete live host verification before product execution. File installation, a command-line validator, an old host pulse or remembered chat state MUST NOT promote the host to `HOST_VERIFIED`.

The generated PreInvocation hook must record a fresh observation for the same boundary in the current session. The invocation counter does not need to reset; any fresh hook observation recorded after the active boundary may satisfy the live verification boundary. The ExecutionKit host MCP process that services `executionkit_host_accept` carries its random session identity and startup timestamp as evidence, but it may remain the already-running current session.

The installation receipt carries the deterministic runtime manifest used to identify the source distribution. Before host acceptance, managed and pinned runtimes are reverified byte-for-byte against that manifest. Runtime byte drift is `STRUCTURAL_DRIFT` even when the receipt still contains the original source hash; a receipt string alone is not runtime proof.

The boundary stores a deterministic host-surface fingerprint covering the ExecutionKit plugin bundle (including its skills/rules/MCP configuration), generated Antigravity adapter roles/skills, the workspace hook configuration and the ExecutionKit entry rule. Missing files, content changes, symlink substitution, source-receipt drift or a mismatched fingerprint invalidates acceptance. Content drift remains `STRUCTURAL_DRIFT` even when every expected file still exists. A previously accepted/idempotent MCP call cannot hide later drift; reconciliation must establish a new live verification boundary when host surfaces changed.

The bootstrap preserves the selected runtime topology. New/default projects normally use `.executionkit/runtime/kit`; existing pinned-submodule projects may keep `.executionkit/runtime/AI-ExecutionKit`. A clean Git worktree may reconcile an uninitialized/stale pinned submodule to the exact trusted source commit. A non-Git packaged project is never silently converted into Git topology and must prove its populated runtime bytes instead.

Native TODO authorities are preserved. Canonical ExecutionKit blocks, deterministic project-owned projections and deterministic native Markdown checklist semantics can all remain the sole mutable task authority. Custom checklist markers are never guessed. Existing native Agent OS resources are also preservation targets and must become registered **and routable** before EK00 activation.

## Direct workspace integration — internal/recovery primitive

The lower-level integration command remains available for implementation, diagnostics and explicit recovery:

```bash
node bin/integrate-antigravity.mjs .
node bin/integrate-antigravity.mjs . --apply
node bin/validate-v30-project.mjs .
node bin/validate-seo.mjs .
node bin/validate-execution.mjs .
```

It installs/reconciles the ExecutionKit workspace plugin under `.agents/plugins/executionkit/` and preserves existing native project resources. It must not install an ExecutionKit `agents/` fan-out bundle. TODO bytes remain unchanged.

**Direct integration is not host acceptance.** If it changes plugin/rule/skill/hook/MCP surfaces, the host lifecycle must establish a new `HOST_VERIFY_PENDING`, fingerprint the resulting host surface, continue in the current Antigravity session, observe a fresh live-boundary invocation and complete `executionkit_host_accept` through the current host MCP process before any `HOST_VERIFIED` claim.

The current plugin entry rule treats a TODO-first owner instruction as sufficient entry to the applicable **eight-system** lifecycle: Execution, Agent, Content, SEO, Audit, Test, Launch and cross-cutting State OS. SEO is still conditional; API/private/native-only products may resolve it truthfully to `NOT_APPLICABLE` rather than receiving artificial search work.

New host integration should prefer skills/plugin/MCP entrypoints. ExecutionKit workflow documents remain internal lifecycle procedures/contracts; they are not a second task authority or assumed to be IDE slash-command truth. The workflow-to-skills exporter exists for hosts moving execution entrypoints toward skills.

## Dependency-safe parallel runtime contract

ExecutionKit may select a bounded batch of canonical implementation/resume actions only when its dependency-safe planner proves that dependencies are satisfied, explicit parallel-safety metadata permits it, write/domain ownership is disjoint, shared hotspots do not overlap and isolated execution contexts are available. One orchestrator owns claims and deterministic integration. Any ambiguity falls back to a single sequential action.

Antigravity may execute that safe batch through supported host-native agents/tools. Every delegate receives its canonical task ID/action, resolved resources, owned scope and acceptance/evidence requirements. Delegates MUST NOT create a private task queue, mutate canonical status independently or treat isolated-branch PASS as integrated acceptance.

`/boost` asks for the maximum **currently safe** concurrency under the same guards. It does not bypass reviewer separation, targeted verification, State checkpointing, phase/release Audit/Test/Launch gates, change-impact revalidation or production-side-effect authority.

Reviewer/audit/acceptance/correction and sensitive release/production boundaries remain serialized unless an explicit audited contract proves otherwise. A user pause/cancellation, ambiguous workspace, missing authority or failed policy gate stops autonomous continuation. Recovery reconciles current repository truth and the State/runtime checkpoint rather than recreating previous work from chat memory.

## TODO-first + State + SEO startup

After `HOST_VERIFIED` and once the canonical integration gate permits execution, the integrated host should internally perform the applicable sequence without another owner bootstrap prompt:

```text
TODO-FIRST
→ load AGENTS/config
→ validate/rehydrate State
→ inspect SEO applicability/contract when configured
→ resolve canonical lifecycle action/bounded safe batch
→ resolve Agent OS context/specialists/ownership
→ execute safe action/batch with orchestrator-owned integration
→ targeted verification
→ reconcile canonical TODO/evidence
→ checkpoint State
→ continue from live truth
```

Before `HOST_VERIFIED`, live host acceptance takes precedence over this normal product execution loop. Before `EK00-ACTIVATE`, product work remains dependency-gated even when the host itself is verified.

When MCP is available, prefer `executionkit_seo_status` for read-only SEO inspection and `executionkit_seo_validate` for explicit validation. CLI fallback is `node bin/validate-seo.mjs .`. At release, SEO S3 remains candidate-bound through `release-readiness` / `validate-seo --release`; a host must not substitute a Lighthouse score for that authority.

## Hooks

The generated hook integration injects bounded canonical context and emits a localhost-only activity pulse when the per-device Agent is available. During live-verification host bootstrap it records the host observation for the current boundary. Any fresh hook invocation recorded after the active live boundary is eligible for host acceptance; same-session activity is valid when it binds to the current boundary. The hook must not:

- create task state or a private queue;
- grant permission for unrelated implementation;
- alter repository permissions;
- force continuation after a user stop;
- claim product/browser/device/search-engine execution from file registration;
- infer indexing/ranking/traffic from route or repository structure;
- self-accept `HOST_VERIFIED` without the separate MCP acceptance step.

Ambiguous multiple workspaces should produce no automatic task injection. No automatic full CI dispatch is added.

## MCP

ExecutionKit ships its own stdio MCP server exposing controlled project operations such as status, discovery/reconciliation, candidate creation/validation, evidence collection/graphing, SEO status/validation and release-readiness checks.

The live-verification host bootstrap also installs the host MCP surface used by `executionkit_host_accept`. On process startup that host MCP creates a random session identity and records its own startup timestamp in memory. The acceptance tool is intentionally fail-closed: it accepts only a fresh live-boundary hook observation for the active boundary while the runtime manifest/source receipt and exact host-surface fingerprint still match. An already-running MCP process is valid when it serves the current verified runtime and host-surface fingerprint. If a previously verified runtime or host surface drifts, even an idempotent host-accept call must reject readiness rather than return stale success.

MCP configuration is an interface to existing ExecutionKit authorities, not another authority. Tool calls must preserve the same candidate/task/runtime/SEO/State invariants as direct CLI usage.

## Laravel

When a project has Laravel Boost, the adapter can detect and expose the project-native Boost MCP integration. Preserve version-specific Boost guidance and actual composer/project configuration. Use live route/schema/log/documentation tools as evidence sources where applicable; do not infer their execution from installation alone.

## Flutter / Dart

When a Flutter project is detected, the Dart/Flutter adapter records the expected MCP/toolchain integration and the Flutter quality adapter can run analyzer/test/integration commands according to project policy. Keep device/emulator evidence distinct from web previews. Native-only Flutter surfaces do not become SEO surfaces merely because an SEO capability exists elsewhere in the project. Do not auto-install SDKs/packages or overwrite unrelated global MCP settings.

## Browser, accessibility, SEO and performance

Playwright/axe/Lighthouse are evidence adapters, not the SEO authority. Their absence reports `NOT_AVAILABLE` or `NOT_CONFIGURED`, never PASS. When configured, raw results belong to the candidate-bound evidence chain and should be interpreted through project-specific acceptance thresholds.

SEO OS separately owns search applicability, page-family intent/value, crawl/index/canonical policy, specialized local/commerce/directory/international/programmatic rules and S0–S5 gates. The host routes search work through the registered SEO specialists. No repository or browser check guarantees indexing, ranking, rich results or traffic.

## Derived state

Runtime checkpoints, State snapshots, host-bootstrap state, SEO evidence, discovery inventories, candidate envelopes and evidence artifacts live under `.executionkit/` by default where appropriate. They are derived, locally ignored state and must never become a second TODO/backlog.

## Runtime proof checklist

For a host/runtime claim, capture the relevant proof rather than relying on installed files:

- exact pinned ExecutionKit source commit and verified distribution fingerprint;
- selected runtime topology, install receipt and deterministic runtime manifest;
- current byte-for-byte runtime-manifest verification for the managed or pinned runtime;
- deterministic host-surface fingerprint for the current boundary;
- `HOST_VERIFY_PENDING` boundary identity when host surfaces changed;
- fresh live-boundary hook observation for that boundary;
- active ExecutionKit host MCP session identity/startup time identifying the accepting current session;
- successful `executionkit_host_accept` result and resulting `HOST_VERIFIED` state;
- unchanged runtime manifest and host-surface fingerprint after acceptance;
- plugin/skill visibility in the installed editor when relevant, including `ek-seo` when SEO is enabled;
- MCP handshake/tool result when MCP behavior is claimed;
- actual selected task/action identity;
- actual SEO status/validation result when SEO host integration is claimed;
- actual browser/device/framework output when product behavior is claimed;
- candidate/environment identity for acceptance/release evidence;
- pause/recovery behavior when continuity is being validated.

Official references should be rechecked against the installed host/tool versions before changing integration assumptions.

## Unified installer layouts

The [installer](../adoption/installer.md) records the real runtime path. Exported Antigravity rules, context hooks and bundled MCP arguments use that path, while root-distributed projects remain compatible. Runtime validators, activation and MCP executable calls resolve their sibling scripts from the executing distribution. Export success remains distinct from host discovery/handshake/tool smoke evidence.
