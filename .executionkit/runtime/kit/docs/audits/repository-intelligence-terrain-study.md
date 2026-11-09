# Terrain / Litho Repository Intelligence Study

**Purpose:** Source-grounded design input for AI-ExecutionKit Repository Intelligence  
**ExecutionKit target:** provider-neutral adaptation, not Terrain embedding

## Repositories inspected

- `sopaco/terrain` — observed main `829d7b8cba8ba66f7d7341230e46372842bef41a`
- `sopaco/deepwiki-rs` — observed main `27dbd3ed74535213e7c40be8abcdcec4145bebf2`
- Repomix concepts/dependency used by Terrain
- CodeGraph integration concepts and Terrain drift guard
- RTK integration concepts and token-output policy

Key Terrain source surfaces reviewed include:

- `crates/terrain-core/src/freshness/*`
- `crates/terrain-core/src/assets/incremental.rs`
- `crates/terrain-core/src/assets/repomix.rs`
- `crates/terrain-core/src/git_policy.rs`
- `crates/terrain-agent/src/agent_context.rs`
- `crates/terrain-agent/src/workflows/init.rs`
- `crates/terrain-agent/src/workflows/quick_refresh.rs`
- `crates/terrain-agent/src/workflows/ask.rs`
- `crates/terrain-agent/src/workflows/sdd.rs`
- `env-catalog/*`
- `preset_skills/*`
- Terrain's own `AGENTS.md`

## Finding 1 — Terrain is a knowledge/environment layer, not an execution authority

Terrain's important architectural move is to turn a repository into an agent-ready environment through:

1. engineering knowledge;
2. shared agent contract;
3. deployed agent tooling.

Its scope is materially narrower than ExecutionKit's end-to-end lifecycle. This is why embedding Terrain as a ninth ExecutionKit OS would create duplicated authority rather than a clean integration.

## Finding 2 — Knowledge layering is stronger than a generated wiki

Terrain separates:

- compact agent context;
- private/domain knowledge;
- human Litho documentation;
- Repomix source pack;
- CodeGraph relationship queries.

The practical retrieval instruction is macro first, then relationship/domain context, then bounded source slices. The strongest transferable idea is the explicit descent from summarized knowledge to evidence rather than repeatedly scanning or trusting prose blindly.

## Finding 3 — Freshness is operational policy

Terrain's freshness implementation uses observable Git drift. Its current code accounts for commits behind baseline, changed-file ratio, age, dirty tree and unmeasurable baselines. A derived architecture context is deliberately discounted relative to the source pack it summarizes.

It also distinguishes thresholds that influence whether compact context can be preloaded or must be verified.

ExecutionKit should preserve the principle but generalize it to scope-aware trust states and current live-source authority.

## Finding 4 — Fail closed on unmeasurable drift

Terrain explicitly treats missing/unreachable baselines as distrust, not zero drift. Malformed or unknown timestamps are not interpreted as today.

This behavior is essential for autonomous agents because stale knowledge is more dangerous when it looks confidently current.

## Finding 5 — Incremental refresh is conservative and recoverable

Terrain plans updates from Git diff only when a prior artifact and reachable baseline exist and the touched scope is below a configured threshold.

Its incremental contract tells the model to preserve unaffected content. It rejects implausible output such as missing sections or excessive shrinkage and can fall back to full regeneration while preserving a valid prior artifact.

ExecutionKit should adopt this preservation-first design.

## Finding 6 — Generated knowledge has a different Git merge model

Terrain separates:

- human-maintained domain knowledge that merges normally;
- generated docs that should not be line-merged into hybrid narratives;
- large machine-local derivatives such as Repomix packs and indexes.

This distinction maps cleanly to ExecutionKit's existing preservation-first philosophy.

## Finding 7 — Agent Contract is a compiler problem

Terrain's environment catalog includes skills, dependencies, managed AGENTS fragments and tools. Managed fragment versions allow upgrade/reconciliation rather than one-time file copying.

ExecutionKit already has a typed Agent OS manifest and deterministic routing, so the better implementation is a managed contract compiler that preserves native AGENTS content and feeds the existing router.

## Finding 8 — Tool health needs independent evidence

Terrain documents an observed case where CodeGraph could report itself current while its index was stale relative to repository commits. Terrain therefore adds a Git-based drift cross-check.

This validates a broader ExecutionKit rule: provider self-reported status is observational evidence, not sufficient proof of current repository binding.

## Finding 9 — Repomix should remain an adapter

Terrain uses `repomix-core` to build an architecture-oriented source pack and records metadata such as baseline and token-heavy files.

The useful contract is bounded search/read over a source-derived snapshot. ExecutionKit should own that contract and permit native or Repomix providers. The rest of the system must not depend on Repomix availability.

## Finding 10 — RTK is useful but should not become global shell authority

RTK's useful property is reduction of verbose shell output while preserving exit status and access to full logs. Terrain's own skill notes that native Read/Grep bypass shell hooks, so agents must deliberately choose RTK.

ExecutionKit should treat token-efficient output as an optional adapter/evidence optimization, never as a global wrapper that can hide diagnostic evidence.

## Finding 11 — Litho provides the deeper documentation pipeline

The Litho/deepwiki lineage supplies the human engineering-knowledge pipeline behind Terrain:

- preprocessing;
- C1/C2/C3/C4 research;
- domain/module analysis;
- workflows;
- boundary/interface analysis;
- database documentation;
- staged composition;
- Mermaid output/validation;
- persistent intermediate research for long runs.

ExecutionKit should make this an optional deep-research provider pipeline, separate from the compact agent context required for routine execution.

## Finding 12 — Terrain main is evolving quickly

The studied Terrain source is pre-1.0 and contains active packaging/tooling evolution. A public issue during the research window also showed a CodeGraph packaging/init failure and the maintainer described manual/bundled-tool recovery.

This does not make Terrain unsuitable as research input. It does mean ExecutionKit should avoid a hard runtime dependency and keep providers replaceable.

## Finding 13 — Auto-deployed tooling must be isolated and reversible

Terrain's deployed-tooling pillar is valuable, but ExecutionKit must not inherit global-environment fragility.

The ExecutionKit adaptation therefore keeps managed provider tooling project-local and explicit:

- exact package pins;
- no global package installation;
- no implicit RTK/global shell hooks;
- plan identity before mutation;
- isolated npm policy with lifecycle scripts disabled;
- staged install and version verification;
- receipt/package-lock integrity;
- atomic activation with last-known-good rollback;
- required/optional policy-aware failure behavior.

Where a provider's distribution contract cannot be proven against the studied source/CLI surface, ExecutionKit keeps it operator-managed rather than pretending that auto-install is safe. Terrain itself currently exercises this boundary because the observed source wrapper and registry version contracts diverge.

## Transfer matrix

| Terrain/Litho concept | ExecutionKit adaptation |
| --- | --- |
| `.terrain/agent/context.md` | compact provider-neutral macro context |
| `.terrain/knowledge/` | typed domain/human-maintained knowledge |
| Repomix pack | local micro/source provider |
| CodeGraph | optional relationship provider |
| freshness score | evidence-weighted trust + path-aware drift |
| quick refresh | conservative incremental refresh planner |
| managed AGENTS fragments | Agent OS contract compiler |
| env catalog | provider/tool catalog plus project-local exact-pinned plan/apply/doctor deployment |
| Terrain Ask CLI | ExecutionKit CLI/MCP normalized retrieval |
| SDD 4 phases | useful artifacts mapped into existing lifecycle, no second backlog |
| Litho human docs | optional deep engineering-documentation provider |
| Terrain registry | not required as authority; ExecutionKit project identity remains canonical |

## Concepts explicitly rejected

- Terrain as mandatory runtime dependency.
- `.terrain/` as ExecutionKit canonical storage.
- a ninth operating system.
- source pack as a replacement for live source.
- generated docs as task or implementation authority.
- CodeGraph status as sole freshness proof.
- automatic global RTK shell hooks.
- a second SDD/task queue.
- full semantic rescan on every State/fleet heartbeat.

## Design consequence

The target is not a Terrain clone.

The target is an ExecutionKit-owned fabric where repository knowledge is:

- bounded;
- source-grounded;
- provenance-carrying;
- freshness-aware;
- path-aware where possible;
- provider-neutral;
- auditable;
- safely degradable;
- integrated into the existing execution/evidence lifecycle.
