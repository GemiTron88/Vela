# Decision OS Capability Specification

## Purpose

Decision OS is the eleventh executable system in ExecutionKit (`5.1.0`). It provides a bundled, deterministic, schema-driven, and model/network-free policy and engineering-knowledge evaluation layer across task preflight, postflight, quality gates, wave/phase/release boundaries, release approval/publication, and production deployment.

## Core Principles

1. **Deterministic & Offline-Safe Execution**: Decision OS executes locally inside `lib/decision/` without model calls or live network dependencies in its evaluation path (`DECISION_NO_MODEL_IN_PATH`, `DECISION_BUNDLED_LOCAL`).
2. **Non-Bypassable Policy Authority**:
   - `MANDATORY_DENIAL`: Compiled denial rules (`DENY`) cannot be weakened or overridden by a KB rule, model recommendation, metadata flag, or manual declaration.
   - `REVIEW_ESCALATION`: Bundled canonical engineering knowledge (`GemiTron88/KB`) rules may escalate `ALLOW` to `REVIEW` when domain/surface/boundary conditions and risk signals match, but can never downgrade `DENY`.
   - `NO_AUTHORITY_GRANT`: A Decision `ALLOW` verdict never substitutes for missing test, audit, visual, content, SEO, or launch gate evidence.
3. **Plan-Alignment Guard (`inspectDecisionPlan`)**: Captures task scope and risks before implementation (`executionkit decision align . --task <id>`) and verifies that touched files remain within declared task ownership and planned scope at task closure.
4. **Cross-System Quality Signal Bridge**: Aggregates live signals from Surface Integrity, Database Integrity, Route Integrity, Visual OS V2, Visual Production V5, Assets Guard, Test OS, Audit OS, and Launch OS (`lib/decision/quality-signals.mjs`).

## Portable CLI Surface

```bash
executionkit decision status .
executionkit decision advise . --operation preflight --task <TASK_ID>
executionkit decision align . --task <TASK_ID>
executionkit decision refresh .
```

## Canonical Knowledge Synchronization (`KB_SYNC_V1`)

- Bundled catalog: `lib/decision/knowledge/catalog.json`
- Bundled manifest: `lib/decision/knowledge/manifest.json`
- Synchronization verifier: `verifyAndApplyCanonicalKbSnapshot()` in `lib/decision/kb-sync.mjs` validates schema v2, exact SHA-256 digest, fact/rule counts, and monotonic revision semantics before updating local knowledge snapshots.
