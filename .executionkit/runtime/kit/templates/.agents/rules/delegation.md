# Dependency-safe parallel delegation rule

ExecutionKit uses **dependency-safe parallelism with deterministic sequential fallback**. Parallelism is a throughput optimization; it never changes canonical authority, readiness, review, evidence or production-side-effect rules.

- `TODO.md` or the configured native TODO remains the sole mutable task/status authority. Do not create a private agent queue or concurrent status ledger.
- The orchestrator alone claims/releases canonical tasks and owns final integration. Every active canonical task has one unambiguous executor.
- By default, use parallel specialists inside one canonical task when their write scopes are disjoint and the orchestrator can integrate them safely.
- Multiple canonical tasks may run concurrently only when hard dependencies are satisfied **and** explicit parallel-safety/ownership metadata or an equivalent deterministic project contract proves independence.
- Different files do not prove independence. Shared domain invariants, schemas/migrations, generated outputs, API contracts, global configuration, authorization, design tokens, shared fixtures, CI/release manifests and `TODO.md` are hotspots.
- Use isolated branches/worktrees or host-native bounded subagent contexts for concurrent canonical task ownership. Subagents do not push/merge to the integration branch unless project policy explicitly assigns that role.
- Host-native spawn is an actual host tool call, not a prepared worktree. Only acknowledge after receiving the real worker ID: `executionkit agents delegated . --claim <id> --spawn-tool <tool> --worker-id <id>`. Do not invent tool receipts or claim false parallel work.
- If no real native spawn tool exists (including in Gemini Flash), immediately decline untouched prepared claims using `executionkit agents decline . --reason HOST_SPAWN_UNAVAILABLE` and continue the primary task sequentially. Do not reprepare the same batch or wait for nonexistent workers.
- The orchestrator stays productive during delegation: reconcile integration seams, inspect results, prepare targeted tests/evidence and resolve safe work rather than idling. During slow reconcile, Lighthouse or Visual OS steps, only independent read-only/preparation work may overlap; never concurrently mutate shared evidence.
- After integration or conflict resolution, rerun affected verification and refresh candidate-bound evidence before lifecycle promotion.
- Reviewer separation remains mandatory. Implementers cannot accept their own work, and parallel reviewers do not turn isolated-branch PASS into integrated acceptance.
- State OS checkpoints are continuity aids only. Claims/status still live in canonical task authority and stale claims must be recovered without deleting unique work.
- External/production side effects are never parallelized merely because implementation work is parallel-safe.
- On uncertain ownership, dependency ambiguity, hotspot overlap, resource pressure or failed isolation, fall back to sequential execution automatically.
- `/boost` means maximum **safe** concurrency under these rules. It may raise concurrency caps and specialist fan-out, but must not skip targeted verification, phase CI/audit, independent review, Launch gates or evidence freshness.
