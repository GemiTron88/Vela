# Docs OS Capability — v4

**Status:** CANONICAL capability guidance.
**Mandatory:** Yes
**Purpose:** Build, validate, and search the source-grounded project knowledge base. Keeps generated documentation current without owning mutable task state.

## Source-grounded documentation

Docs OS (promoted from Documentation Fabric in v4) is the authority on generating and validating project knowledge. It ensures that system context, component diagrams, deployment topologies, and domain glossaries remain truthfully grounded in live repository state.

## Key responsibilities

Docs OS covers:
- Discovering engineering boundaries, system contexts, and tests from source code
- Generating the canonical `INDEX.md` and fingerprint-backed artifact documents
- Validating documentation coverage and freshness against live source
- Indexing documentation for search and retrieval
- Exposing derivation logic so agents understand the current system without guessing

## CLI Surface

```bash
executionkit docs status
executionkit docs refresh
executionkit docs build
executionkit docs validate
executionkit docs search <query>
```

## Trigger / cadence

- **Trigger**: `material-source-impact`, manual regeneration, validation gates
- **Cadence**: Ad-hoc during source exploration, and mechanically required at phase/wave boundaries to ensure documentation integrity.

## What it does NOT own

- Executable task lifecycle or planning (owned by Execution OS).
- Execution continuity or rehydration (owned by State OS).
- Audit validation or UI conformance (owned by Audit OS and Visual OS).

## Evidence / contracts

- Produces: `documentation-registry`, `INDEX.md`, fingerprinted markdown artifacts
- Reads: Live source code, configuration files, test files, and existing source structure
