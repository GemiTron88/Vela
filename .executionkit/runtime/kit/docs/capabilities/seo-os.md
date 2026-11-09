# SEO Capability

**Status:** CANONICAL capability guidance.  
**Mandatory:** Conditional; required whenever organic discovery is a material goal for public indexable web surfaces.  
**Purpose:** Own organic-search discoverability, search architecture, crawl/index policy, search-intent mapping, semantic search signals and organic-search release readiness without creating a second backlog or promising rankings.

## Authority boundary

SEO OS owns:

- SEO applicability and depth classification;
- public/indexable search-surface inventory;
- search audience, journey, intent, topic and entity models;
- page-family and URL/search architecture;
- crawl, render and index policy;
- canonical, redirect, robots, sitemap, pagination and faceted-navigation policy;
- search-facing metadata and semantic/structured-data contracts;
- internal-discovery and orphan-prevention policy;
- specialized local, ecommerce, marketplace, directory, editorial, international, media and programmatic SEO policy;
- SEO gate criteria, SEO evidence requirements and post-launch organic-search observability.

SEO OS does **not** own mutable execution state, editorial prose, generic performance engineering, general accessibility, deployment authority, analytics product strategy or ranking outcomes.

Execution OS / canonical `TODO.md` remains the sole mutable backlog authority. Agent OS routes SEO resources. Content OS owns content inventory, provenance, localization and editorial quality. Test OS owns how checks execute and what executed evidence is sufficient. Audit OS independently challenges SEO and cross-domain quality. Launch OS owns the exact release candidate, production release and rollback. State OS may retain compact SEO continuity observations but never SEO task state.

Any executable SEO gap MUST map to canonical TODO/native task authority. `SEO_TODO.md`, mutable audit checklists, keyword spreadsheets used as task state and private remediation queues are forbidden shadow backlogs.

## Non-guarantee rule

SEO OS MUST NOT claim or imply guaranteed rankings, traffic, indexing, crawl frequency, rich results or revenue. It may prove technical eligibility, implemented search architecture, evidence-backed quality criteria, absence of known blockers and current production observations.

## Applicability

SEO applies to **public web surfaces intended to be discovered organically**. Authenticated panels, private portals, APIs and native Flutter screens do not receive artificial SEO requirements. Their performance/accessibility/distribution requirements belong to the appropriate systems.

Applicability is one of:

- `AUTO` — inspect actual project/public-web scope and activate only when organic discovery is materially applicable;
- `ENABLED` — project explicitly declares SEO applicable;
- `DISABLED` — project explicitly declares SEO not applicable and records the rationale.

Capability depth remains `NONE | LITE | STANDARD | FULL`. Applicability and depth are distinct: a project may distribute SEO tooling at STANDARD depth while `AUTO` resolves the current product to not applicable.

## Modes

A project may activate one or more modes according to actual product shape:

- `technical`
- `content`
- `local`
- `ecommerce`
- `marketplace`
- `directory`
- `editorial`
- `international`
- `media`
- `programmatic`

Modes specialize policy; they do not create independent systems or backlogs.

## SEO domains

A complete SEO model evaluates these domains as applicable:

1. **Discovery** — discover public route families, rendering model, locales, entities, taxonomies and current search controls.
2. **Search strategy** — map business goal -> audience -> search journey -> intent -> topic/entity -> page family -> query cluster. Keywords are evidence/input, not the architecture itself.
3. **Information architecture** — define hierarchy, page families, URL conventions, taxonomy relationships and search-entry journeys.
4. **Crawl and index control** — robots, status codes, canonicals, redirects, sitemap coverage, noindex policy, pagination, parameters, faceted navigation, soft-404 and duplicate handling.
5. **Page contracts** — declare why a family exists, the distinct intent it satisfies, required visible value, semantic requirements, empty/deleted behavior and index eligibility.
6. **Semantic and structured data** — maintain truthful entity relationships and an allowed/required/conditional/forbidden structured-data registry per page family.
7. **Internal discovery** — contextual links, breadcrumbs, hierarchy, orphan prevention, crawl depth and meaningful related entities/content.
8. **Specialized SEO** — local, commerce, marketplace, directory, editorial, international, media and programmatic controls.
9. **Search experience and quality** — useful production content, media, trust, mobile usability and search-facing performance; coordinate ownership rather than duplicating Content/Test/Audit.
10. **Operations** — release checks, production verification, monitoring, regression detection and recurring maintenance.

## Search architecture invariant

Before a scalable indexable page family is implemented or accepted, establish the chain:

```text
business goal
-> search audience
-> search journey
-> intent
-> topic/entity
-> page family
-> route/URL policy
-> visible value/content requirements
-> internal relationships
-> index policy
```

A route existing in code or a database entity existing in storage does **not** imply that an indexable landing page should exist.

## Search Surface Contract

Use `executionkit.seo.json` for machine-readable project SEO policy where SEO applies. A `surfaceFamilies[]` entry is a contract for a route/page family, not a mutable task.

Each indexable family should identify, as applicable:

- stable ID and route pattern;
- surface/page type;
- primary and secondary intents;
- represented topics/entities and relationships;
- index eligibility and canonical policy;
- required visible sections/value;
- metadata/heading requirements;
- structured-data policy;
- internal-link/breadcrumb requirements;
- pagination/facet/parameter policy;
- empty, low-inventory, deleted and retired behavior;
- locale/hreflang behavior;
- representative verification samples;
- programmatic quality thresholds where pages are generated at scale.

The contract defines the denominator and policy. Missing implementation discovered from it becomes canonical TODO work.

## Programmatic SEO safety gate

Before indexing generated combinations, prove useful distinct value. Challenge at minimum:

- distinct search intent;
- sufficient real entity/content coverage;
- meaningful difference from sibling pages;
- stable canonical/URL behavior;
- maintainability and freshness;
- low-inventory and empty-state behavior;
- crawl-space impact;
- duplicate/thin/doorway risk;
- internal discoverability.

Generated URL count, database cardinality and template uniqueness are not value evidence. Default to non-indexable when eligibility is unproven.

Programmatic index eligibility MUST fail closed: only proven distinct intent,
visible value and declared coverage permit indexing. This is the PROVEN_ONLY
policy; it does not infer eligibility from route or database existence.

## Technical SEO contract

Validate applicable behavior for:

- crawlable/rendered HTML and no-JavaScript discoverability where required;
- status codes and soft-404 behavior;
- `robots.txt`, meta robots and `X-Robots-Tag`;
- canonical URLs and URL normalization;
- redirects, chains and loops;
- XML sitemaps/sitemap indexes;
- pagination and faceted navigation;
- query parameters and duplicate URL spaces;
- internal links, breadcrumbs and orphan pages;
- localized alternates/hreflang;
- search-facing metadata and social metadata where declared;
- structured data matching visible truthful content;
- media discovery where applicable;
- deleted, expired, unavailable and empty entities;
- representative source HTML and rendered DOM.

Mechanical validity is not semantic correctness. A syntactically valid canonical or schema object may still point at the wrong entity/page and must be contextually reviewed.

## Local mode

Local SEO models physical locations, service areas and geographic hierarchy explicitly (country/region/city/district/neighborhood as applicable). It defines branch/service-area page eligibility, entity-location relationships, duplicate-location prevention, real location content, contact consistency and applicable structured data. Do not manufacture location pages that contain no distinct local value.

## Ecommerce / marketplace mode

Define category/brand/product/listing/seller page eligibility, product variants, stock/unavailable/discontinued behavior, filters/sorts/facets, pagination, review/offer/availability schema eligibility, duplicate listing policy and category/product internal discovery. A product/listing record does not automatically deserve an indexed URL.

## International mode

Define locale/region URL architecture, canonical + hreflang consistency, `x-default` where appropriate, localized metadata and intent, language fallback, RTL/LTR considerations and cross-locale linking. Translation completeness belongs to Content OS; SEO OS verifies search architecture and search-facing correctness.

## Structured-data registry

For each page family classify schema types/properties as `required`, `conditional`, `allowed` or `forbidden`. Structured data MUST describe content that is truthful and visible to users where the search-engine contract requires visibility. Do not invent ratings, offers, authorship, FAQs or business facts to satisfy validators.

## Internal discovery

SEO OS treats internal linking as architecture, not a random link-count target. Verify important indexable families are reachable through meaningful navigation/context, orphan pages are detected, breadcrumbs reflect the declared hierarchy and generated related links are relevant rather than mechanically cross-linked.

## SEO gates

SEO uses domain-specific gates coordinated with Test/Audit/Launch:

### S0 — task SEO check

Run the narrowest applicable checks for changed public/indexable behavior. Do not full-crawl the project after every task.

### S1 — wave SEO gate

Inspect affected page families and integration seams. Map material findings to canonical TODO before they compound.

### S2 — phase SEO gate

Reconstruct the phase SEO denominator; validate architecture, representative rendered/runtime behavior and specialized-mode requirements; map/remediate findings; then participate in the normal phase Test/Audit gate.

### S3 — release-candidate SEO gate

Validate the exact release candidate against the approved SEO contract and current evidence. Candidate changes invalidate affected evidence.

### S4 — production SEO verification

Verify production status/redirect/canonical/robots/sitemap/rendering/structured-data behavior and representative URLs after deployment. This is observation, not a ranking guarantee.

### S5 — operational SEO monitoring

Track declared recurring signals such as sitemap failures, canonical/noindex drift, unexpected 4xx/5xx/soft-404 growth, structured-data regressions, orphan growth, crawl/index anomalies and field search-facing performance when real data exists. Monitoring findings that require code/content work map to TODO.

## Finding taxonomy

Recommended SEO finding categories:

- `SEO-APPLICABILITY`
- `SEO-DENOMINATOR`
- `SEO-INTENT`
- `SEO-ARCHITECTURE`
- `SEO-CRAWL`
- `SEO-INDEX`
- `SEO-CANONICAL`
- `SEO-URL`
- `SEO-REDIRECT`
- `SEO-SITEMAP`
- `SEO-INTERNAL-LINK`
- `SEO-ORPHAN`
- `SEO-THIN`
- `SEO-DUPLICATE`
- `SEO-SEMANTIC`
- `SEO-STRUCTURED-DATA`
- `SEO-LOCAL`
- `SEO-INTERNATIONAL`
- `SEO-ECOMMERCE`
- `SEO-PROGRAMMATIC`
- `SEO-RENDER`
- `SEO-MEDIA`
- `SEO-PERFORMANCE`
- `SEO-OBSERVABILITY`

Audit OS maps impact to the project P0/P1/P2/P3 release policy. Mechanical warnings are review signals unless the configured contract makes them deterministic failures.

## Evidence contract

SEO evidence should bind, as applicable, to:

- candidate SHA/artifact identity;
- environment/base URL;
- SEO contract version/hash;
- page-family/surface ID;
- representative URL/sample;
- check/tool/version;
- observation timestamp;
- raw report/artifact reference;
- result and explicit limitations.

SEO evidence does not replace stronger runtime/manual evidence. Laboratory Lighthouse results are not field Core Web Vitals, source inspection is not rendered behavior, and a schema validator is not proof that the visible facts are true.

## Cross-system ownership

### Execution OS

Owns all mutable SEO implementation/remediation task state and dependency lifecycle.

### Agent OS

Routes SEO planning, implementation, specialist review and gate skills. Registered-but-unroutable SEO resources are not integrated.

### Content OS

Owns actual content inventory, taxonomy completeness, provenance/rights, localization and editorial/factual quality. SEO declares search intent and required search-facing value; Content produces/validates the real content.

### Test OS

Owns execution strategy, environments and adequacy of SEO test evidence. SEO defines domain requirements; Test proves them using the appropriate checks.

### Audit OS

Independently challenges SEO denominator, contract quality, implementation and evidence. SEO self-checks do not replace independent phase/release audit.

### Launch OS

Owns release/deployment. SEO contributes S3/S4 gate results and production search-readiness observations.

### State OS

May checkpoint compact SEO context such as active gate, contract fingerprint and evidence references. It MUST NOT persist authoritative SEO backlog state.

## Performance boundary

SEO OS owns **search-facing performance requirements only where they affect public-search experience and declared page contracts**. Generic web performance, authenticated performance and Flutter/native performance remain Quality/Test/Audit responsibilities. `validate-seo-performance.mjs` is a Lighthouse adapter and MUST NOT be treated as a complete SEO validator.

## Depth profiles

### NONE

No material organic-search surface. Record/derive non-applicability; do not manufacture SEO work.

### LITE

Small public site: basic search-surface inventory, crawl/index controls, metadata, sitemap/canonical/redirect checks, essential structured data and release verification.

### STANDARD

Adds intent/page-family architecture, surface contracts, internal-discovery policy, specialized modes as applicable, rendered verification, S1/S2/S3 gates and recurring operational checks.

### FULL

For search-critical, large, international, local, ecommerce, directory, editorial or programmatic products: complete denominator, entity/topic/search-journey model, scalable programmatic safeguards, specialized-mode matrices, formal evidence, adversarial phase/release review and production monitoring.

FULL means deeper risk-based evidence, not more generated pages or paperwork.
