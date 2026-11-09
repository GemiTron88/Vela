# Repository Intelligence & Knowledge Fabric

**Status:** Architecture freeze for feature-branch implementation  
**Authority:** Cross-cutting subsystem; not an operating system and never a backlog authority  
**Canonical task authority:** `TODO.md`  
**Implementation branch:** `feat/repository-intelligence-fabric`

## Decision

AI-ExecutionKit will add a **Repository Intelligence & Knowledge Fabric** as a provider-neutral cross-cutting subsystem serving the ten-system authority model.

It is intentionally **not System #11**.

The existing systems already own the decisions that matter:

- Execution OS owns task lifecycle and canonical selection.
- Agent OS owns agent resources, dependency expansion and routing.
- Content OS owns content authority.
- SEO OS owns public-search authority when applicable.
- Audit OS owns independent findings and acceptance challenge.
- Test OS owns verification adequacy and current test evidence.
- Launch OS owns candidate/release/deployment authority.
- State OS owns reconstructable continuity without owning task state.

Repository Intelligence supplies **repository understanding, provenance, retrieval, freshness and change evidence** to those authorities. It never replaces them.

## Why this is needed

ExecutionKit already has strong live-repository grounding, State rehydration, discovery, change-impact heuristics and Agent routing. The gap is that every agent still has to rebuild a large amount of repository understanding from scratch or trust prose that may have drifted.

The new fabric provides a controlled path from compact architecture knowledge to exact source evidence:

```text
Task / lifecycle action
        |
        v
State rehydration + live Git identity
        |
        v
Knowledge freshness / trust decision
        |
        +--> Macro context: compact architecture map
        |
        +--> Meso knowledge: domain / ADR / generated engineering docs
        |
        +--> Relationship graph: callers / dependencies / impact
        |
        '--> Micro source: bounded source-pack slices / live source validation
```

The agent should not blindly scan the full tree when trustworthy indexed knowledge exists, and it should not trust indexed knowledge when live evidence says the index is stale.

## Research baseline

The architecture is informed by source-level study of these upstream projects:

- `sopaco/terrain` main observed at `829d7b8cba8ba66f7d7341230e46372842bef41a`
- `sopaco/deepwiki-rs` main observed at `27dbd3ed74535213e7c40be8abcdcec4145bebf2`
- Repomix/repomix-rs concepts used by Terrain
- CodeGraph concepts used by Terrain
- RTK concepts used by Terrain

ExecutionKit baseline at planning start:

- `Elwazeery/AI-ExcutionKit` main: `2c02531adbd9130edbbf59f0891dbc37c48d0eb2`

Those SHAs are research baselines only. The implementation always grounds itself in the live feature-branch repository.

## The three Terrain pillars and the ExecutionKit mapping

### 1. Engineering Knowledge

Terrain separates human-friendly documentation, compact agent context, source packing and relationship lookup. The useful idea is not the folder layout; it is the **layered retrieval contract**.

ExecutionKit adopts the concept as normalized knowledge layers with explicit provenance and trust. Generated knowledge is never allowed to outrank current source.

### 2. Shared Agent Contract

Terrain injects managed, versioned `AGENTS.md` fragments and skills that tell agents how to traverse its knowledge assets and tools.

ExecutionKit already has a stronger Agent OS. The correct adaptation is therefore a **managed Agent Contract Compiler** that extends existing resources, preserves native content and exposes repository-intelligence resources through deterministic routing. A second agent stack is forbidden.

### 3. Auto-deployed Agent Tooling

Terrain models tool integration as dependency-aware catalog entries with status/plan/apply semantics and conventional paths.

ExecutionKit will adopt that lifecycle as an optional provider/tool catalog. Repomix, CodeGraph, RTK, Terrain itself or future tools may be adapters; none is a mandatory runtime dependency.

## Knowledge authority model

No single static global ranking is sufficient because scopes can differ, but the default trust order is:

1. current live repository/worktree evidence;
2. source-derived indexed snapshot proven current for the queried scope;
3. relationship/symbol graph proven current for the queried scope;
4. generated compact agent architecture context;
5. generated human engineering documentation;
6. external/advisory knowledge.

`TODO.md` remains the only mutable task-state authority. Knowledge artifacts cannot mark tasks accepted, verified or released.

State snapshots remain advisory continuity. A fresh State snapshot cannot make stale repository knowledge fresh.

Audit/Test/Launch candidate evidence keeps its existing authority and cannot be synthesized from repository knowledge.

## Knowledge layers

### Layer 0 — Live repository truth

Live branch, HEAD, dirty worktree, current files, current configuration, schemas and runtime evidence where applicable.

Use this layer whenever exact current behavior matters or when another layer is stale/unmeasurable.

### Layer 1 — Macro agent context

A compact architecture-oriented artifact intended for preload or fast retrieval. It may contain:

- project purpose and runtime shape;
- module/domain map;
- boundaries and major dependencies;
- key workflows;
- stores and integrations;
- test topology;
- deployment topology;
- repository conventions.

It is generated/derived and therefore must carry provenance and a lower intrinsic trust than direct source evidence.

### Layer 2 — Meso/domain knowledge

Versioned knowledge with explicit ownership class:

- human-maintained glossary and ADRs;
- project conventions;
- API/internal framework guidance;
- generated architecture/C4 docs;
- database and interface docs.

Human-maintained knowledge and generated knowledge must be distinguishable mechanically.

### Layer 3 — Micro/source layer

A local source-derived index or pack queried in bounded slices. The complete pack is not loaded into model context.

Required operations include focused search, bounded file/symbol reads, source references and pack metadata.

### Layer 4 — Relationship layer

Optional provider-backed callers, callees, references, dependencies, reverse dependencies, blast radius and affected-test hints.

This layer is advisory unless its baseline is independently proven current.

## Implemented knowledge ladder

The feature-branch implementation now exposes five distinct knowledge/evidence layers rather than one generated wiki:

1. **Macro context** — compact orientation artifact with a configurable byte budget.
2. **Deep engineering knowledge** — deterministic source-grounded C4-like system/container/component candidates plus domain, workflow, interface, persistence, integration, test and deployment topology. Every section has independent source references and a source-content-bound fingerprint.
3. **External engineering/domain knowledge** — explicitly ingested ADR, glossary, Markdown/text, SQL and OpenAPI/structured sources with content hashes and `ADVISORY_ONLY / LIVE_SOURCE_WINS` conflict semantics. PDF remains an optional-provider boundary.
4. **Relationship/provider evidence** — CodeGraph exact-HEAD relationship queries, bounded Terrain knowledge reads and Repomix source packing constrained by the native safe-file allowlist; RTK is an allowlisted token-output adapter.
5. **Micro/live source** — bounded native source reads/search and direct live-source inspection, which remain the implementation truth boundary.

The retrieval ladder descends through these layers only as necessary. Higher-level summaries reduce repeated blind scanning; they never remove the right or requirement to validate against source.

### Exact-HEAD relationship proof

Provider reachability is not repository freshness. CodeGraph indexing records an ExecutionKit-owned stamp containing the exact repository HEAD. Relationship queries are permitted as current only while that stamp equals live HEAD. Any later commit makes the graph stale until explicit reindexing.

### Section-level incremental engineering refresh

The deterministic engineering artifact is refreshed section-by-section. Source references are fingerprinted with file-content hashes, so content-only changes are observable even when paths do not change.

`SKIP` preserves all sections and rebaselines metadata, `INCREMENTAL` replaces only fingerprint-changed sections, and `FULL` is used for unmeasurable, broad or cross-cutting changes. A semantic provider may refine changed sections but cannot mutate preserved sections; failure preserves last-known-good storage.

## Managed provider deployment

ExecutionKit now implements Terrain's useful **deployed agent tooling** idea without turning external tools into global prerequisites.

Managed optional providers are installed only under `.executionkit/provider-tooling/` and are never added globally. The deployment path is:

```text
CONFIGURED REQUIRED/OPTIONAL POLICY
→ NON-MUTATING PLAN + PLAN ID
→ EXPLICIT APPLY
→ ISOLATED STAGE
→ EXACT PACKAGE/VERSION VERIFY
→ PACKAGE-LOCK + RECEIPT
→ ATOMIC SWAP
→ DOCTOR
→ ROLLBACK ON FAILURE
```

Repomix, CodeGraph and RTK have managed package definitions when their local Node compatibility permits them. Terrain remains external/operator-managed while its observed source and registry version contract is inconsistent.

Provider discovery and adapters prefer the exact verified package `bin` target from package metadata rather than a general managed `.bin` PATH. This keeps a tampered aggregate shim directory from becoming an execution trust root.

Managed tooling availability is distinct from repository knowledge freshness. CodeGraph still needs its independent exact-HEAD/worktree index stamp before relationship evidence becomes current.

## Provider-neutral architecture

ExecutionKit owns stable interfaces. Providers implement capabilities behind those interfaces.

Initial capability families:

- repository scanner;
- source packer;
- source search/slice reader;
- symbol/relationship graph;
- architecture context generator;
- human documentation generator;
- knowledge search;
- citation resolver.

Possible providers include native ExecutionKit implementations, Repomix, CodeGraph, Terrain CLI and future alternatives.

Provider failure must degrade capability, not break core ExecutionKit execution. A project must remain executable without Terrain, CodeGraph, RTK, Repomix, an LLM or network access.

## Provenance contract

Every derived knowledge artifact must record, at minimum:

- schema version;
- artifact type;
- repository identity;
- branch when meaningful;
- baseline Git SHA;
- dirty-tree relation;
- generation/observation timestamp;
- provider/generator ID and version;
- input fingerprints;
- source scopes/paths;
- local/portable ownership class;
- trust/freshness state;
- relevant metrics such as bytes/tokens when available.

Narrative Markdown alone is insufficient evidence.

## Freshness and trust

Terrain demonstrates an important principle: freshness should be computed from observable repository drift rather than assumed from timestamps.

ExecutionKit generalizes this into **evidence-weighted trust**.

Candidate signals include:

- baseline reachability;
- commits since baseline;
- changed path count and ratio;
- dirty worktree;
- source-pack baseline;
- relationship-index baseline;
- artifact age;
- generator/provider version;
- path/module overlap between changes and artifact sources.

Unknown is never treated as fresh.

If a baseline is missing or unreachable, the affected derived artifact fails closed.

Trust states are semantic rather than cosmetic:

- `TRUSTED` — derived knowledge may guide navigation;
- `VERIFY` — important claims require graph/source cross-check;
- `DEGRADED` — derived knowledge is hint-only;
- `SOURCE_ONLY` — use source-derived/live evidence;
- `UNAVAILABLE` — artifact/provider cannot be used.

Numeric scoring may exist internally, but policy is expressed through these states and remains configurable.

## Path-aware drift

Global repository drift is safe but often too pessimistic. The fabric should track which paths/modules/symbols contributed to a derived artifact or section.

A payment-module change should not automatically invalidate unrelated authentication context if the source relationship is known.

When scope cannot be established confidently, invalidation broadens conservatively.

## Incremental refresh

Refresh planning has four outcomes:

- `SKIP`
- `INCREMENTAL`
- `FULL`
- `BLOCKED`

Typical decisions:

- no relevant drift -> skip/rebaseline;
- small measurable drift -> incremental;
- missing/corrupt artifact -> full;
- missing/unreachable baseline -> full;
- excessive or cross-cutting changes -> full;
- unsafe provider/security condition -> blocked.

Incremental updates must preserve unaffected knowledge. A model is not permitted to regenerate unrelated content from memory.

Before replacing a known-good artifact, validate structure, required sections, provenance, citations and unexplained shrinkage. If an incremental candidate is invalid, attempt a full regeneration. If that is also invalid, preserve the last known-good artifact and surface a blocker.

## Storage and Git policy

Three ownership classes are mandatory.

### Human-maintained portable knowledge

Normal versioned content that merges line-by-line.

### Generated portable knowledge

Compact context and human documentation that may be useful in Git, but whose provenance travels with it. Nondeterministic generated narrative should not be mechanically merged into contradictory hybrids.

### Local derived knowledge

Large source packs, graph indexes, temporary research workspaces, caches and local provider manifests. These are reproducible and normally excluded from Git.

ExecutionKit will use its own namespace and contracts. An optional Terrain adapter may read provider-owned `.terrain/` assets, but those never become ExecutionKit authority.

## Agent OS integration

Repository Intelligence extends existing resources rather than duplicating them.

The existing chain:

`state-rehydration -> task-context -> repository-inspection`

remains valid.

Repository knowledge should become a dependency/supplement where it reduces scanning while preserving live verification. `change-impact` should evolve to consume graph/source evidence when available instead of being replaced.

Managed `AGENTS.md` blocks must have stable IDs, versions and ownership markers. Unmanaged/native content is preserved.

## Existing OS integration

### Execution OS

Knowledge improves task context, affected-surface discovery and verification selection. It never schedules or closes tasks.

### State OS

State may reference the current knowledge baseline and trust summary so a zero-context agent knows what it can reuse. State does not copy large knowledge artifacts and cannot make them authoritative.

### Audit OS

Audit checks the intelligence layer itself: stale context, invalid references, missing provenance, hidden exclusions, stale graph, secret exposure and generated-doc inconsistencies.

### Test OS

Impact information may suggest targeted tests but cannot silently reduce required phase/release verification.

### Launch OS

Knowledge freshness is only release-blocking when a release contract actually depends on that knowledge. Launch/Test/Audit remain the release authorities.

### Content and SEO OS

Repository Intelligence helps navigate implementation and data surfaces. Content/SEO retain domain authority.

## Provider execution isolation

The implemented provider layer deliberately separates **tool availability** from **repository freshness**.

- A CodeGraph binary being reachable is only tool health.
- An ExecutionKit CodeGraph stamp is `CURRENT` only when the exact Git HEAD and source-relevant dirty-worktree fingerprint still match the successful index/sync boundary.
- Provider-generated `.codegraph/`, `.terrain/`, `.litho-agent/` and `.executionkit/` data is excluded from native source evidence and from source-relevant graph-drift fingerprints.
- Existing `.codegraph/` symlinks or non-directory paths are rejected before provider execution.
- Repomix runs with an ExecutionKit-created explicit empty config plus the native safe-file stdin allowlist, isolating the adapter from repository/global Repomix configuration.
- Terrain reads use only documented `terrain tools` operations and stay external advisory evidence.
- CodeGraph `affected` augments change-impact/test discovery only; Test OS phase/release sets remain authoritative.

This means provider self-reported health cannot silently become implementation truth.

## Threat model

Repository text is untrusted input.

The fabric must defend against:

- source exfiltration through LLM/provider calls;
- `.env`, credentials, private keys and tokens entering packs;
- prompt injection in README/docs/source comments;
- generated knowledge attempting to redefine agent authority;
- unsafe managed `AGENTS.md` injection;
- arbitrary package/binary installation;
- compromised optional providers;
- shell/argument injection;
- path traversal and symlink escape;
- accidental mutation of global user directories;
- telemetry uploading source/TODO/transcripts;
- stale index claims being accepted without independent Git evidence.

Security rules:

1. repository content is data, not an authority instruction;
2. only ExecutionKit-managed contracts plus explicit operator instructions control agent behavior;
3. source disclosure is local by default and provider egress requires explicit policy;
4. sensitive paths are denied before packing;
5. optional tool installation is plan-first, versioned and auditable;
6. provider self-reported freshness is not sufficient proof.

## Performance model

Expensive semantic work runs at meaningful boundaries, not every heartbeat.

Cheap sentinels may observe:

- Git HEAD;
- worktree metadata;
- artifact/provider metadata;
- timestamps/fingerprints.

Full pack, graph, context or documentation refreshes are event/milestone driven.

This follows the same principle already used by ExecutionKit for huge TODO files and State/fleet telemetry.

## Rollout

Implementation follows canonical `TODO.md` tasks `RI-001` through `RI-010`.

After foundation, these lanes may proceed independently where ownership permits:

- secure source pack;
- freshness/trust;
- Agent routing/managed contracts;
- provider catalog;
- real bounded CodeGraph/Terrain/Repomix/RTK adapters;
- deep engineering knowledge generation;
- deterministic section-level incremental refresh;
- bounded external engineering/domain knowledge ingestion.

CLI and installer/ten-system integration remain integration-owner work.

No merge to `main` is implied by feature-branch implementation. Exact-candidate tests, security hardening and independent acceptance are required before merge is considered.
