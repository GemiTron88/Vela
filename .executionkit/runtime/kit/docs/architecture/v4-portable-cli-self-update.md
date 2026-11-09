# ExecutionKit v4 — Portable CLI and Safe Self-Update Architecture

## Purpose

ExecutionKit v4 keeps one canonical JavaScript/Node engine while exposing one stable `executionkit` command across supported developer machines. Portable executables, pinned Node fallback, help/discovery, installer/update behavior and Antigravity routing are distribution surfaces over the same engine, never alternate implementations of the ten systems.

This architecture is implemented by canonical tasks `EK3-043` and `EK3-044`.

## Single command authority

One machine-readable CLI contract/registry must own:

- command families and subcommands;
- aliases and standard discovery flags;
- argument/option metadata;
- stable JSON output schemas;
- input/usage exit codes;
- version identity;
- executable/Node parity expectations.

The Node entrypoint, standalone executable entrypoint, `--help`, family help, Antigravity discovery and parity tests consume that same authority. A new registered command must not require a second manually maintained command list in a platform launcher.

Required non-destructive discovery behavior:

```
executionkit help
executionkit --help
executionkit -h
executionkit --version
executionkit -V
executionkit db --help
executionkit boundary --help
```

Unknown command/action input returns stable JSON and a usage-class non-zero exit code. Discovery must never execute the requested operational command.

## Distribution model

### Linux VPS project activation

The installed v4 runtime initially uses its Node CLI until an exact-source Linux SEA has been built and verified. From the project root run:

```bash
executionkit platform provision .
```

Run the exact `next` command printed by provisioning, then `./.executionkit/bin/executionkit help`. `platform provision` resolves the exact source SHA from `.executionkit/installation.json`, builds a Linux binary for the current architecture, checks its digest and runs it against the project before publishing it to `.executionkit/bin/`. The managed update rewrites the project boot instructions, Antigravity rule and runtime npm scripts to call the verified binary. For an offline development checkout, pass `--source <clean-exact-source>` to provisioning. Check `executionkit platform status .` for `executionRuntime.type === "STANDALONE_BINARY"`; a `PROJECT_LOCAL_CLI` result means the project is still running through Node. Repeat provisioning after updating the Kit to a new source commit, because binary identity is tied to the exact installed SHA. Linux provisioning installs the SHA-locked `postject` toolchain declared under `config/sea/` with `npm ci`; the first build on a VPS needs registry access or a populated npm cache. A failed SEA activation returns a blocker and rolls back the managed update; rerun `self-update apply .` once the build dependency is available.

Project-local binaries are derived artifacts and remain outside the project's tracked Git authority. Each VPS must provision its own matching binary after checkout or runtime update; a source repository alone is insufficient proof that the installed project is using the portable CLI.

Preferred execution order:

1. verified project-compatible standalone `executionkit` executable for the current OS/architecture;
2. verified project-local pinned Node runtime + canonical JS CLI fallback;
3. never a mutable user-global Node/runtime as project authority.

The executable is a packaging/launcher layer only. It must not reimplement lifecycle, DB Guard, Visual OS, Test OS, Audit OS, Docs OS, Agent OS or any other system logic.

Initial target matrix must be proved from the upstream Node SEA support available at implementation time. Unsupported or insufficiently tested platform/architecture combinations use the pinned project-local fallback rather than a fabricated native-binary support claim. In particular, macOS Intel/x64 must remain on the verified fallback until upstream/runtime evidence supports a maintained SEA target.

Every distributed artifact is bound to:

- exact ExecutionKit source SHA;
- platform and architecture;
- runtime/Node identity when applicable;
- SHA-256 digest;
- build metadata;
- signing/notarization status where applicable.

## Antigravity boot behavior

The project-root `AGENTS.md` remains the human/host entry authority. It does not duplicate the full CLI command catalog.

At session start or canonical lifecycle transition, Antigravity enters through the project-local ExecutionKit command and obeys the returned JSON envelope. Normal operation follows `nextCommand`; `--help` is discovery/recovery, not a mandatory preflight before every step.

Antigravity must never invent a command absent from the CLI registry.

## Automatic update discovery

Update discovery is project-local and performance-first.

The durable installation receipt records the exact installed ExecutionKit source SHA. Derived update-discovery state lives under `.executionkit/` and is not canonical project truth.

A normal cached `start|status|next` path performs only an O(1) read of cached update state. It must not:

- fetch/clone the Kit;
- walk project source;
- run DB/Visual/Docs/Test/Audit;
- recompute the runtime manifest;
- query GitHub on every task transition.

When the configured discovery TTL expires, at most one bounded check resolves the official canonical `Elwazeery/AI-ExcutionKit` `main` remote HEAD. A short network timeout is mandatory.

Discovery outcomes are explicit:

- `CURRENT`: remote exact SHA equals installed exact SHA;
- `UPDATE_AVAILABLE`: remote exact SHA differs from installed exact SHA;
- `OFFLINE_OR_UNKNOWN`: the bounded lookup failed or timed out;
- `BASELINE_REQUIRED`: a legacy installed receipt lacks exact source-SHA identity.

Offline/unknown discovery alone does not invalidate the already installed local runtime and does not block ordinary project work. It records retry-after metadata and retries later. A known update, however, preempts ordinary project mutation and returns the canonical self-update command.

## Self-update handoff

A running old Kit must not use old migration logic to interpret an arbitrarily newer installer format.

The safe self-update transaction is:

1. resolve the official main HEAD to an exact SHA;
2. acquire that exact SHA into the same project's immutable source store;
3. verify origin, exact HEAD, cleanliness and required v4 source files;
4. invoke the **incoming source's** CLI/installer implementation to plan/apply the migration;
5. preserve project-owned bytes and canonical TODO/history;
6. refuse unsafe dirty/colliding/tampered mutation instead of stashing or discarding owner work;
7. apply transactionally with rollback;
8. run the newly installed doctor;
9. run mandatory invariant-aware upgrade revalidation;
10. only then resume ordinary product execution.

No restart/reopen requirement is permitted.

## Update policy

The project configuration owns a bounded update policy with, at minimum:

- official channel/ref: canonical `main` only for automatic acquisition;
- check-on-start enabled/disabled;
- discovery TTL;
- remote lookup timeout;
- offline retry interval;
- automatic apply policy;
- fail-open-offline behavior;
- dirty-worktree refusal;
- incoming-updater requirement.

Automatic update may never:

- use a shared mutable Kit checkout as authority;
- use a mutable global runtime as authority;
- silently stash/reset/discard owner work;
- auto-push commits;
- open/merge PRs;
- dispatch CI;
- weaken invariant revalidation;
- bypass exact-SHA verification.

## Concurrency and interruption

Update discovery and mutation must be safe under multiple project sessions.

The implementation must use a project-local bounded lock/transaction identity so two simultaneous starts cannot both apply an update. A stale lock must be diagnosable and recoverable without deleting owner work.

An interrupted self-update must leave either:

- the previous verified runtime restored, or
- a doctor-detectable blocked transaction with deterministic rollback/recovery.

It must never leave a mixed old/new runtime claimed as installed.

## Performance requirements

Performance and speed are hard acceptance criteria.

The certified no-update hot path:

- performs no network call while discovery TTL is fresh;
- does not import/load the heavy updater solely to read update status;
- does not scan repository files;
- does not hash the entire runtime;
- reads only compact project-local metadata required by the kernel.

The stale-discovery path performs one bounded remote-head lookup only. Full fetch/materialization occurs only after a known update or an explicit update command.

Executable startup and pinned-Node fallback startup are benchmarked independently. Neither may introduce per-task repository/network work.

## Verification matrix

The implementation must include executable regressions for:

- all current CLI commands and future registry-added commands;
- Node/executable command/argument/output/exit-code parity;
- top-level and family help/version aliases;
- unknown command/action structured failures;
- current exact SHA / no update;
- update available;
- legacy receipt without source SHA;
- offline DNS/network failure;
- timeout;
- cached fresh result avoiding network;
- TTL expiry causing one bounded lookup;
- dirty worktree;
- managed-path collision;
- tampered source snapshot;
- concurrent self-update attempts;
- interrupted transaction and rollback;
- incoming updater handoff;
- doctor after update;
- invariant revalidation after update;
- executable/pinned-runtime version skew;
- supported platform/architecture artifacts and fallback selection;
- hot-path performance regression.

## Authority boundaries

`TODO.md` remains the only mutable backlog authority. Update-discovery cache, installer journals, executable metadata and State are operational evidence/state only and never become a shadow backlog.

The project-root `AGENTS.md` tells Antigravity how to enter ExecutionKit and obey the envelope. Detailed command truth belongs to the executable CLI contract, not duplicated prose.
