# Local Antigravity Bootstrap Contract

## Purpose

A project carries a tiny GitHub-live bootstrap entry while the complete AI ExecutionKit runtime is fetched from the official repository and installed/reconciled inside the project by Antigravity. Structural installation and actual host activation are different facts and MUST NOT be conflated.

This is the preferred local integration path for prepared projects. Direct `integrate-antigravity` and explicit `--source` installer primitives remain internal/recovery/development surfaces; they are not the normal project bootstrap source and are not substitutes for the live-verification host lifecycle.

## Source authority

Normal project bootstrap has one source authority:

- repository: `https://github.com/Elwazeery/AI-ExcutionKit.git`;
- ref: `refs/heads/main`;
- update policy: `latest-remote-head`.

The project entry MUST NOT carry a permanent static ExecutionKit commit/source fingerprint and MUST NOT accept a caller-supplied repository, local/sibling path, ref, commit or source override. Each bootstrap run fetches the current official remote `main`, resolves `FETCH_HEAD` to one exact 40-character SHA, checks out that SHA detached into the project's own immutable upstream snapshot at `.executionkit/source/AI-ExecutionKit/<sha>`, verifies the official origin and a clean worktree, and executes only that project-local resolved checkout. No shared user-local Kit checkout/cache may act as project source authority.

This separates **update discovery** from **execution identity**:

`OFFICIAL REMOTE MAIN → FETCH → EXACT SHA RESOLVED → PROJECT-LOCAL IMMUTABLE UPSTREAM SNAPSHOT → DISTRIBUTION FINGERPRINT → PROJECT RUNTIME`

The remote branch may advance before the next run; the current run never executes a moving branch. Reproducibility/evidence is bound to the resolved SHA and deterministic runtime manifest/source fingerprint recorded for that run.

## Required lifecycle

1. Inspect live project truth, `TODO.md`, `AGENTS.md` and `executionkit.bootstrap.json` before product mutation.
2. Verify bootstrap schema `executionkit-bootstrap/v2`, official repository, `refs/heads/main`, `latest-remote-head`, Antigravity host, and absence of static `commit` / `sourceHash` fields.
3. Reject all source/repository/ref/commit/path arguments to the project launcher.
4. Fetch current official `main` using Git credentials into a temporary resolver checkout.
5. Resolve `FETCH_HEAD` to an exact SHA, checkout detached, verify exact HEAD, official `origin`, and an empty `git status --porcelain=v1 --untracked-files=all`.
6. Materialize/reuse the SHA-keyed upstream snapshot only inside the target project at `.executionkit/source/AI-ExecutionKit/<sha>`. Its HEAD, official origin and clean worktree must match the resolved source. Shared home-directory caches and shared local Kit checkouts are forbidden for normal project bootstrap.
7. Inspect the real repository topology and preserve supported runtime placement:
   - new/default projects use the managed isolated runtime at `.executionkit/runtime/kit`;
   - legacy projects that already use the isolated `.executionkit/runtime/AI-ExecutionKit` topology may retain it only through an explicit compatibility/reconciliation path; new project bootstrap does not choose a local sibling source or create that topology as an alternative source authority.
8. Run the preservation-first installer from that immutable project-local GitHub-resolved snapshot. The installer may read this upstream snapshot but must never mutate it. Native project authorities, accepted history, code and unrelated work are preservation targets.
9. The installer computes the deterministic distribution/runtime fingerprint from `path + file-bytes SHA-256`; POSIX mode bits are write metadata and MUST NOT change source identity across Windows/macOS/Linux.
10. Persist the installed runtime manifest/source fingerprint and version in `.executionkit/installation.json`. Persist the fetched repository/ref/update policy/resolved SHA, project-local `sourceLocation`, immutable source policy, plus installed fingerprint/version as derived local source-resolution evidence in `.executionkit/bootstrap-source.json`. Canonical task evidence that needs cross-machine durability must copy/bind these values into the task's committed evidence bundle rather than treating derived local state as task authority.
11. Reconcile all eight systems, project Agent OS resources/routing, Antigravity plugin/skills/rules/hooks/MCP, State/Memory policy, tooling, adapters and applicable quality/CI contracts. File copying alone is not deep integration.
12. Before host acceptance, reverify every runtime-manifest byte from the receipt. Missing/tampered managed or compatible legacy runtime bytes are `STRUCTURAL_DRIFT`; the receipt string alone is never sufficient proof.
13. Fingerprint the installed ExecutionKit Antigravity host surface (plugin bundle including bundled skills/rules/MCP, workspace hook configuration and ExecutionKit entry rule) and persist `.executionkit/host-bootstrap.json` as `HOST_VERIFY_PENDING` when structural runtime/host surfaces changed.
14. Keep the current Antigravity session active when `HOST_VERIFY_PENDING` is emitted; product execution remains gated only until live host verification completes.
15. The ExecutionKit PreInvocation hook records a fresh observation for that exact boundary in the current session. Any invocation observed after the boundary is eligible; host verification does not depend on an invocation counter reset.
16. Call the `executionkit_host_accept` MCP tool from the ExecutionKit host MCP process loaded by Antigravity. That MCP process carries a random host-session identity and startup timestamp. The already-running MCP process may accept the new boundary once the current runtime manifest, host-surface fingerprint and fresh hook observation all match.
17. The MCP call is rejected unless the first-invocation hook observation is fresh, the MCP session is post-boundary, the installed runtime still matches the receipt runtime manifest/source fingerprint, and the exact host-surface fingerprint still matches.
18. Only `HOST_VERIFIED` may satisfy host activation evidence. File presence, an old receipt, a command-line doctor or remembered chat state never does. A same-session hook observation and MCP call count only when they bind to the current boundary and unchanged host/runtime fingerprints.
19. Continue canonical EK00/deep-integration work from `TODO.md`. Product work stays gated until the applicable independent integration audit/activation acceptance.

## State machine

`NOT_CONFIGURED → HOST_VERIFY_PENDING → HOST_VERIFIED`

`STALE` or `STRUCTURAL_DRIFT` invalidates readiness. Content drift is structural drift even when every expected file still exists. Runtime byte drift is also structural drift even when the receipt still claims the original source hash. Reinstall/reconcile from the current official GitHub source and establish a new live verification boundary instead of silently accepting drift.

The host state and bootstrap-source record are derived local state under `.executionkit/`; neither owns task/backlog status. `TODO.md` (or its explicitly preserved compatible native authority/projection) remains the sole mutable execution authority.

## Project bootstrap entry

Run `node bin/export-bootstrap.mjs <project>` from a complete ExecutionKit distribution. It writes:

- `executionkit.bootstrap.json` with official repository, canonical `main` ref and `latest-remote-head` policy;
- `scripts/executionkit-bootstrap.mjs`, a self-contained official-GitHub fetch/resolve/install launcher;
- an `AGENTS.md` bootstrap binding.

The exported launcher uses local Git credentials, resolves the newest official remote `main` to an exact SHA, materializes it inside the project at `.executionkit/source/AI-ExecutionKit/<sha>`, refuses a mismatched/dirty/wrong-origin snapshot, and then executes host bootstrap from that immutable project-local checkout. It accepts no local/sibling source or caller repository/ref/commit/path override. Project-specific changes must be written to the project's native authorities/overlays, never into the upstream snapshot or managed runtime. It does not infer product completion or modify product TODO state.

Useful distribution-side command for preparing a project:

```bash
npm run project:bootstrap:export -- /path/to/project
```

A prepared project normally needs only:

```bash
node scripts/executionkit-bootstrap.mjs
```

When that command returns `HOST_VERIFY_PENDING`, remain in the same Antigravity process. Trigger an ExecutionKit-aware action so the hook records the current boundary, then call `executionkit_host_accept`. Product work resumes only after `HOST_VERIFIED`.

Lower-level direct bootstrap/installer commands that accept an explicit source remain internal/recovery/development primitives. They do not redefine the normal project acquisition contract and must not be exposed in project bootstrap instructions as an alternate source authority.

## Native TODO compatibility

ExecutionKit does not require every project to rewrite a mature native TODO into canonical comment blocks.

Three task-authority shapes are supported:

1. canonical ExecutionKit task blocks;
2. a project-owned deterministic `projection-json` adapter;
3. native Markdown checklist authorities when their lifecycle semantics are deterministic.

Simple open-only native Markdown is preserved as the canonical authority and automatically exposed through the derived `projection-json` adapter so dependency readiness can change dynamically after EK00. A richer checklist such as `[ ]`, `[~]`, `[R]`, `[!]`, `[x]` is accepted automatically only when the canonical TODO contains an explicit, unambiguous `Status semantics` section and stable task IDs. ExecutionKit then creates a **derived** projection under `.executionkit/`; it does not replace the TODO or create another mutable backlog.

The native projector understands project task fields such as `Deliver`, `Deps`, `Refs`, `Accept`, `Evidence`, `Blocker`, `Priority`, `Phase` and `Tags`, including bounded same-prefix dependency ranges such as `P00-T003..P00-T009`. Open tasks become `READY` only when their declared dependencies are already accepted; otherwise they remain `PLANNED` in the derived projection. Partial/review/blocked/accepted markers are mapped only from the project's declared semantics. Unknown or contradictory marker meaning fails closed.

## Native Agent OS compatibility

Existing `.agents` resources are preserved rather than replaced. Pre-manifest native Agent layers may be preservation-registered automatically when they contain the semantic core: project-owned roles, skills, rules, workflows and contracts. Optional helper categories such as templates may be absent and are filled by the canonical scaffold. A stray or half-built `.agents` directory is not treated as a complete Agent OS and must be reconciled explicitly.

Bootstrap fallback reachability is temporary structural safety, not semantic acceptance. EK00 Agent OS reconciliation must still prove the project's real specialists are registered **and routable** before activation.

## Deep integration acceptance boundary

A successful GitHub fetch is not a successful install. A successful install is not a successful host activation. A successful static host configuration check is not a successful project integration.

The minimum truthful sequence is:

`OFFICIAL GITHUB MAIN FETCHED → EXACT SHA RESOLVED/DETACHED → PROJECT-LOCAL UPSTREAM SNAPSHOT MATERIALIZED → SOURCE/RUNTIME MANIFEST VERIFIED → RUNTIME INSTALLED → EIGHT-SYSTEM/AGENT/MCP/TOOLING RECONCILED → HOST SURFACE FINGERPRINTED → HOST_VERIFY_PENDING when changed → FRESH LIVE-BOUNDARY HOOK OBSERVATION → CURRENT MCP SESSION → MCP HOST ACCEPTANCE → HOST_VERIFIED → PROJECT STUDY/RECONCILIATION → INDEPENDENT INTEGRATION AUDIT → INTEGRATION ACTIVATE → PRODUCT EXECUTION`

After `HOST_VERIFIED`, both the runtime manifest and the same exact host-surface fingerprint remain part of readiness. If installed runtime bytes or plugin/rule/skill/MCP/hook content drift later, runtime verification becomes `STRUCTURAL_DRIFT`; an idempotent host-accept call cannot hide that change. The accepting MCP call also carries the active MCP session identity and startup timestamp so the evidence identifies the exact current session that accepted the boundary.

Never collapse these states into one `installed=true` flag. Never treat the branch name alone as source identity; bind evidence to the exact SHA resolved during that run.
