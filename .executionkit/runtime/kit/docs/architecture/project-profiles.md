# Project Profiles — current 3.x

Profiles choose control depth across the **seven capability authorities**. They do not create separate task systems, and State OS remains cross-cutting system #8 rather than a capability level.

| Capability authority | LITE profile | STANDARD profile | FULL profile |
| --- | --- | --- | --- |
| Execution | LITE | STANDARD | FULL |
| Agent | LITE | STANDARD | FULL |
| Content | NONE | NONE | FULL |
| SEO | LITE | STANDARD | FULL |
| Audit | LITE | STANDARD | FULL |
| Test | LITE | STANDARD | FULL |
| Launch | LITE | STANDARD | FULL |

The profile bindings above are the current bootstrap defaults. Project truth may justify an explicit override — most importantly `SEO NONE` when there is no public organic-search authority — but enabled SEO depth must stay aligned with `executionkit.seo.json` and must require candidate-bound release validation.

Execution, Agent, Audit and Test cannot be `NONE` under the current core rules. Content, SEO and Launch vary only where the product/release contract and applicability evidence allow it. `SEO NONE` / evidence-backed `NOT_APPLICABLE` must not be used to hide a real public organic-search surface.

Use `CUSTOM` for asymmetric risk. It must declare all seven capability-authority levels plus a rationale. State OS is configured separately as a current 3.x continuity/integrity system and is not part of the capability-level matrix.

Select profile by consequence and complexity: security/privacy, payments, medical/regulatory impact, data criticality, offline/sync, external integrations, content/localization, public-search surface complexity, number of surfaces, operational complexity, deployment topology, product lifetime and evidence/review rigor. Risk outranks repository size.

ExecutionKit orchestration uses the same `DEPENDENCY_SAFE_PARALLEL` contract across profiles: only dependency-ready, explicitly parallel-safe, ownership-disjoint and isolated implementation/resume work may run concurrently, under one orchestrator with sequential fallback. Higher capability depth may increase specialist routing, evidence, review and gate rigor; no profile authorizes a second scheduler or competing task authority.

## SEO depth

SEO depth reflects real organic-search complexity, not a desire to maximize checklists:

- **NONE** — no public organic-search authority after real surface inspection.
- **LITE** — bounded public search surface with simple page-family/index/canonical needs.
- **STANDARD** — production public web requiring deliberate search architecture, Search Surface Contracts, structured semantics, internal discovery and candidate-bound gates.
- **FULL** — complex/high-scale search estates such as local, ecommerce, marketplace/directory, international, editorial/media or programmatic surfaces requiring stronger denominator/evidence/operational controls.

Programmatic/generated indexability remains fail-closed at every depth. Route/database existence never implies index eligibility, and no profile guarantees indexing/rankings/traffic/rich results.

## Separate product-quality choice

Product-quality policy (`standard`/`premium` or stronger native equivalent) is a separate acceptance choice from ExecutionKit LITE/STANDARD/FULL control depth. Premium UI/UX, content richness, generic performance and SEO remain separately owned concerns:

- Content OS owns content quality/provenance/editorial lifecycle;
- SEO OS owns organic-search architecture and S0–S5 search criteria;
- Test OS owns executed checks/evidence adequacy;
- Audit OS independently challenges implementation/evidence;
- Launch OS owns candidate/deployment/rollback authorization.

A project that requires premium UI/UX, rich responsive product surfaces, heavy SEO or stronger evidence should declare those requirements explicitly rather than assume `STANDARD` implies premium product acceptance.