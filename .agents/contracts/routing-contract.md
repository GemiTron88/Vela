# Routing Contract

Agent OS resolves execution context; it never becomes a task backlog.

## Inputs

- canonical task identity and semantic state,
- requested lifecycle action,
- phase, priority, risk and tags when available,
- live repository/configuration state.

## Deterministic resolution

1. Match routes by declared predicates only.
2. Sort matching routes by ascending `priority`, then route ID.
3. Select the first route for `priority-first-match`.
4. Expand transitive skill dependencies.
5. Load only the selected roles, skills, rules, and contracts.
6. A fallback route may constrain investigation, but may not invent task state.

## Authority boundary

`TODO.md` (or its configured native projection source) owns mutable task state. `.agents` may contain routing metadata, not task queues, status ledgers, progress lists or shadow work.
