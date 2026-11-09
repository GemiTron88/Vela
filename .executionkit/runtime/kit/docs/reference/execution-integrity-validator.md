# Execution Integrity Validator — v2.x

`bin/validate-execution.mjs` validates a project's execution control plane. `bin/validate-agents.mjs` validates Agent OS. Both are required for v2 AI-executed projects.

## Execution checks

The generic validator covers:

- explicit config and valid profile/projectState;
- six capability levels and required capability authorities;
- root `AGENTS.md` binding to canonical TODO/native authority + `.agents`;
- Agent layer integration;
- task parsing/projection freshness;
- globally unique IDs across active/archive;
- valid states and archive terminality;
- dependency existence/cycles/readiness;
- blocker/cancellation/evidence requirements;
- contract file/anchor references;
- competing executable backlogs;
- ACTIVE bootstrap placeholders;
- configured quality/editor structural integrity.

A BOOTSTRAP structural PASS is not a release-ready PASS. Execution integrity is not product acceptance by itself.

## Agent checks

Agent validation rejects malformed/missing manifests/resources, duplicate IDs, dangling route references, unsupported predicates, skill cycles, broken allowed roles/conflicts/dependencies, unregistered managed resources and task-state/backlog markers under `.agents`.

Resolver selection remains read-only/deterministic. File presence does not prove an IDE/runtime executed the selected role/skill.

## Native projections

`projection-json` is accepted only when declared source SHA-256 hashes match current source bytes. Stale projection is an error.

## CI usage

Generated GitHub Actions is **manual self-hosted** (`workflow_dispatch`) by default. Do not turn validation into automatic push-triggered hosted CI merely because the command is cheap. Run targeted/local checks during work and deliberately dispatch project CI at required task/phase/release gates.

## Release readiness

`bin/release-readiness.mjs` additionally requires ACTIVE state, clean synchronized local branch/upstream reference, Agent/Execution/CI integrity, zero required non-terminal canonical tasks and configured product-quality evidence. It does not perform a fresh remote fetch, authenticate reviewer identity or run product suites itself.

## Standard-distribution validation

The ExecutionKit repository has additional distribution-only gates:

- `bin/run-tests.mjs` enforces the recorded minimum runtime regression floor and required test files;
- `bin/validate-canonical-docs.mjs` scans active canonical docs/contracts/templates for known stale capability/lifecycle semantics while excluding historical audits intentionally;
- `bin/validate-distribution.mjs` checks version/example/changelog surfaces, all required scripts/templates/schemas, all six OS template surfaces, bootstrap coverage, test baseline wiring and manual self-hosted workflow policy;
- the manual integrity workflow records/uploads exact-commit validation evidence after `npm run check` succeeds.

The canonical distribution command is `npm run check`. A prior committed validation log is historical evidence, not proof for a newer HEAD.