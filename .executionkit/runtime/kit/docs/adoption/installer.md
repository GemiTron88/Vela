# Unified project installer

**Status:** current 3.x implementation contract. Installation is mechanical preparation; project integration and independent acceptance remain canonical TODO work.

Normal project bootstrap does **not** use a shared local checkout as source authority. It fetches official GitHub `main`, resolves an exact SHA and materializes an immutable upstream snapshot at `.executionkit/source/AI-ExecutionKit/<sha>` inside the target project before installing `.executionkit/runtime/kit`. The commands below are lower-level recovery/development primitives for an explicitly trusted source checkout; they must not be substituted for the normal project bootstrap path.

```bash
# Inspect the exact proposed files, source fingerprint, native plans and Git state.
node /path/to/AI-ExcutionKit/bin/executionkit.mjs install /path/to/project

# Apply a safe first installation, including to a directory containing only plans.
node /path/to/AI-ExcutionKit/bin/executionkit.mjs install /path/to/project --auto

# Bind application to the reviewed plan and source fingerprint, when required.
node /path/to/AI-ExcutionKit/bin/executionkit.mjs install /path/to/project --apply --plan-id <planId> --expected-source <sourceHash>

# Inspect an installed project; no installation or host acceptance is inferred.
node /path/to/AI-ExcutionKit/bin/executionkit.mjs doctor /path/to/project

# Upgrade from a reviewed local source, preserving native project controls/history.
node /path/to/AI-ExcutionKit/bin/executionkit.mjs upgrade /path/to/project --source /path/to/new-checkout --auto

# Recover an interrupted installation, or revert a completed transaction.
node /path/to/AI-ExcutionKit/bin/executionkit.mjs rollback /path/to/project --transaction <transactionId>
```

`--auto` applies a conflict-free plan. A dirty Git worktree is rejected unless `--allow-dirty` is explicitly supplied. That option permits the reviewed managed writes while preserving unrelated work; it does not override file conflicts, stale hashes, unknown native semantics or unsafe paths. `--dry-run` is the default and does not write into the target. Plan construction may create and validate a disposable scaffold outside the target.

For the normal bootstrap path, the installer accepts a nested source only when it is the clean official GitHub snapshot at `.executionkit/source/AI-ExecutionKit/<sha>` whose directory name, detached HEAD and official origin agree. Any other nested source is rejected. The source fingerprint identifies the exact distribution bytes. It is not by itself a publisher signature or a physical-device certificate. Plan IDs bind the target inventory, observed Git state, source and proposed contents. Applications recheck the target and every planned destination before writing.

## Preservation and lifecycle behavior

| Target | Installer behavior |
| --- | --- |
| Empty or plans-only directory | Create project controls, an intake report and the canonical EK00 chain. Do not generate placeholder product tasks or accept integration work. |
| Unchecked native Markdown TODO | Preserve original text and use the `native-markdown` adapter. Native items and canonical integration blocks are read from the same TODO. |
| Existing canonical tasks and code | Preserve source and terminal task blocks. Add activation dependencies only to nonterminal work, including review/correction/resume states. |
| Existing integration history | Create a distinct integration phase derived from the new source fingerprint; preserve the prior phase and its terminal evidence. |
| Existing native Agent resources | Require an explicit, valid manifest with real routes. Preserve its configured authority and resource bytes. Unknown/unrouted resources block automatic adoption before target mutation. |
| Custom native completion syntax or projection | Refuse to infer acceptance/dependency semantics. Reconcile the existing projection explicitly; preserve native source. |
| Repeated installation from the same source | No changes when the installed controls already match. |
| Changed managed runtime | Detect local edits and require reconciliation; never force overwrite them. |

Maturity is separate from adoption mode. The scanner identifies planning-only scope or reports that code requires M1–M4 project study. It searches nested Laravel/Flutter manifests; it cannot infer production status from file presence. The canonical study tasks must inspect actual actors, surfaces, journeys, constraints, deployment state and evidence, then select the applicable [maturity profile](deep-integration-profiles/README.md).

The installer copies tooling before the project study tasks become eligible. The enforced initial order is runtime preparation (002), tooling bootstrap (002T), project study (002S), then system reconciliation (003 onward). The intake links native Markdown plans and lists detected framework manifests/native Agent paths. It is an observation report, not a parallel backlog. Study/reconciliation must cover Execution, Agent, Content, SEO, Audit, Test, Launch and cross-cutting State OS, including real Agent routes, framework adapters, SEO applicability, Premium design/component authorities, discovery, CI and host tool evidence.

Every product lifecycle action waits for `projectState=ACTIVE`, accepted integration audit and activation, and activation dependency ancestry. This includes review, correction, resumption, actionable blocker inspection and readiness promotion. Historical terminal work is exempt from new ancestry. Activation may set ACTIVE after audit acceptance, but product work remains blocked until independent acceptance of the activation task itself.

Source upgrades create a fresh integration chain and pause the current frontier before replacing runtime files. An interrupted transaction leaves a lock that blocks task loading until recovery. Production deployment state is not changed.

## Native Markdown tasks

The optional `native-markdown` adapter reads checkboxes outside canonical task blocks, ignoring fenced code. It uses explicit task IDs where present; otherwise an ID is derived from the title. Duplicate IDs and unknown markers fail closed. Prefer explicit stable IDs before renaming a task.

Fresh first adoption accepts unchecked planning items only. It never interprets existing completion marks automatically. After adoption the declared marker vocabulary is: `[ ]` PLANNED, `[~]` IMPLEMENTED, `[R]` REVIEW_REQUIRED, `[!]` CORRECTION_REQUIRED, `[B]` BLOCKED and `[x]` ACCEPTED. Metadata such as Contract, Verification, Depends, Evidence and Blocker is read from the lines beneath each item. Acceptance still requires actual evidence and independent review under the project contract. `Status:` metadata does not override the checkbox. No projection file stores mutable status.

## Runtime, host tooling and recovery

The immutable fetched upstream snapshot lives under `.executionkit/source/AI-ExecutionKit/<sha>/`; executable managed distribution files live under `.executionkit/runtime/kit/`. The receipt `.executionkit/installation.json` records version/source/file hashes only. The upstream Git snapshot stays project-local derived state and is intentionally not tracked by the parent project Git; the narrowly defined ignore exceptions keep the managed runtime and receipt trackable while journals, State snapshots, tooling dependencies and transaction backups remain local derived data. Product discovery excludes the complete `.executionkit` tree. Derived writes cannot target the upstream snapshot, installed runtime or receipt.

Project commands and generated Antigravity entry/hook/MCP files reference the real runtime path. From the project directory, the canonical tooling task can run:

```bash
executionkit install . --apply
executionkit activation apply .
# MCP server removed in v4 — Kit is now CLI-first
```

Dependency installation and host MCP handshake/tool calls remain distinct from core installation. Missing dependencies or an unavailable host are not PASS. The installer does not start a per-project daemon, deploy a product, run production migrations, infer SEO indexability or accept Premium UI from file presence. Agent installation remains once per physical device.

The MCP tools `executionkit_install_plan`, `executionkit_install_apply` and `executionkit_install_doctor` call the same engine as the CLI. Apply requires the reviewed plan ID and trusted source path. A host smoke test is still required to prove the MCP server loaded and actual tools worked.

Transactions journal prior bytes/modes before modification, use atomic file replacement, and retain recovery information under `.executionkit/installer/`. Rollback first checks every affected destination. It refuses to overwrite later user edits or another active transaction. Recovery removes created files and restores prior files; empty directories may remain. Retained transaction records are recovery evidence and never task state.

Installer doctor resolves fleet/project tooling against the installed runtime, refuses to execute drifted managed files and uses SEO `--no-write` inspection. Normal SEO validation may explicitly write derived evidence; doctor does not. Native file permissions are retained when project controls are updated.
