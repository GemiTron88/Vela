# Agent OS — AI ExecutionKit repository

**Capability level:** `STANDARD`

The repository-local Agent OS authority is `.agents/manifest.json` plus its registered project-local resources. The distribution repository MUST NOT route its own work through `examples/*/.agents`; examples are conformance fixtures only.

Every resource used for execution must be both registered and reachable through deterministic routing. `registered == integrated` is forbidden. Implementation and correction route through the implementer; review/audit use independent reviewer routing; State rehydration is inherited through routed task-context dependencies.

Host/model memory is advisory. Agent OS resolves context and specialists but never owns task state; `TODO.md` remains authoritative.

## Current dependency-safe runtime

Current 3.x Agent OS uses `DEPENDENCY_SAFE_PARALLEL` for implementation/resume work only when canonical dependencies, explicit parallel-safety metadata, ownership boundaries, hotspot checks and isolated work contexts prove independence. One `role.orchestrator` owns claims and final integration. `/boost` raises only the proven-safe concurrency ceiling, while reviewer separation, Test/Audit/Launch gates, evidence freshness and TODO authority remain unchanged. Uncertain or conflicting work falls back to sequential execution automatically.
