# Context Model — v2.x

Agent OS resolves the **minimum deterministic context envelope** for a lifecycle action.

Inputs may include task ID, semantic state/action, phase, tags, risk and project-native metadata. Routing selects roles, skills, rules, workflow and contracts. Skill dependencies are expanded transitively; irrelevant resources should not be loaded merely because they exist.

The task context resolver is read-only. It does not create a queue or copy mutable task state into `.agents`.

Every role must still inspect relevant live code/tests/schema/history/evidence before mutation. A handoff is contextual evidence only and must be revalidated against canonical task/repository truth when resumed.

Routing semantics:

- `first-match` honors declaration order;
- `priority-first-match` sorts by priority and stable ID comparison;
- matching supplements add context in stable order without replacing the lifecycle role;
- selected skill conflicts, forbidden roles and missing dependencies are errors;
- unsupported predicates fail validation instead of matching implicitly;
- risk/tags/state come from canonical metadata/native projection, not private agent memory.

Editor/exported skill files are discovery adapters for canonical resources. Their presence does not prove the editor loaded them or that a delegated subagent actually ran.
