# Prior-Adoption Upgrade Example

This example documents a **generic** planning-only upgrade shape. It is illustrative guidance, not a project-specific authority and not a backlog.

## Starting truth

Assume a repository has:

- no material product runtime yet (`M0_PLANNING_ONLY`);
- a rich canonical TODO;
- historical terminal tasks that adopted an older ExecutionKit/control plane;
- a mature project-native `.agents` layer;
- a current non-terminal product/planning frontier task `P-FRONTIER`.

## Wrong migration

Do **not**:

- reopen the historical adoption tasks;
- reset their terminal evidence to PLANNED/READY;
- replace mature native specialists with generic managed roles;
- delete old managed runtime files before project validators/imports move;
- let `P-FRONTIER` stay executable while the new major-version control plane is still BOOTSTRAP.

That rewrites history and creates avoidable execution drift.

## Correct migration shape

Preserve the old terminal tasks exactly. Add/reconcile the canonical material-upgrade phase at the current frontier:

```text
historical terminal adoption tasks
          │
          └──> EK00-001 -> ... -> EK00-AUDIT -> EK00-ACTIVATE -> P-FRONTIER
```

`P-FRONTIER` may move from READY to a truthful non-executable state when the newly added unsatisfied upgrade prerequisite exists. This is a new prerequisite, not loss of prior implementation/progress.

The deep-integration validator may verify the gate through **transitive dependency ancestry**; the frontier does not need a cosmetic direct dependency on the audit task if activation already depends on the accepted audit.

## Agent migration shape

A temporary bootstrap-valid overlay may route EK00 itself. Before activation, final validation must prove every retained specialist needed by canonical work is reachable through deterministic routing and reviewer/auditor separation remains intact.

## Runtime migration shape

For an isolated pinned runtime:

```text
.executionkit/runtime/AI-ExecutionKit   # managed source, excluded from product denominator
bin/...                                  # target-project compatibility/host wrappers as needed
.agents/...                              # managed + preserved native Agent composition
```

Migrate imports/wrappers/config/tooling first. Retire superseded managed root internals only after no retained project tool depends on them.

## M0 transition shape

Empty product/component/design/test denominators are acceptable only while product runtime is genuinely absent. The first real framework/UI surface triggers registration of its applicable tests, components, design tokens, discovery and rendered quality evidence.

The purpose of this pattern is to make a previously adopted M0 repository integrate correctly **on the first upgrade pass** without replaying history or inventing runtime progress.
