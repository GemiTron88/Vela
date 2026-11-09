# SEO, content depth and performance

This document contains cross-capability implementation and measurement guidance. **Canonical SEO authority now lives in `docs/capabilities/seo-os.md` and the project `executionkit.seo.json` contract.** Content OS still owns content inventory/provenance/localization/editorial quality; Test OS owns executed-check strategy/evidence adequacy; Audit OS owns independent challenge; Launch OS owns the exact release/deployment gate. This file must not become a second SEO authority or backlog.

Apply SEO only to public web surfaces intended for organic discovery. Authenticated panels, APIs and native Flutter screens need their applicable performance/accessibility/product-quality controls, not an artificial SEO score. `bin/validate-seo-performance.mjs` is a Lighthouse/performance adapter; `bin/validate-seo.mjs` is the SEO OS contract/release validator. Neither alone proves rankings or complete runtime SEO quality.

## Search architecture

Inventory search intent and valuable landing-page types through the canonical SEO Surface Contracts. Define crawlable HTML, canonical URLs, status codes, redirects, robots/indexing rules, XML sitemaps, pagination/faceted navigation, internal links, breadcrumbs, language alternates, social metadata and applicable structured data. Validate rendered and source HTML, not just a metadata helper. Structured data must describe visible truthful content where applicable.

Prevent duplicate/filter URL explosions, orphan pages and soft 404s. Test deep links, no-JavaScript discoverability where required and empty/deleted content behavior. Route/database existence never proves index eligibility; generated combinations follow the SEO OS programmatic fail-closed policy.

For heavy SEO, map business goals and audiences through journeys/intents/entities/topics to useful page families with unique value, examples, evidence, media, related content and meaningful calls to action. Do not multiply thin pages, fake testimonials, keyword stuffing, doorway-like combinations or fabricated expertise. Define editorial refresh and index monitoring as canonical recurring operational work, with executable remediation mapped to `TODO.md`.

## Rich content coverage

Content OS must declare the denominator: domains, taxonomy, audiences/ages, regions, locales, formats and required fields. Distinguish UI copy, product/catalog data, editorial/educational media, help/support, onboarding/notifications and marketing pages. Each domain has a source of truth, provenance/rights, update cadence, owner/reviewer, deduplication and import validation.

SEO OS may declare the search intent and visible-value requirements a page family needs, but it does not silently generate or approve the underlying content. Content OS defines project-specific minimum coverage and quality criteria. Counts alone do not prove usefulness. Check empty/thin categories, missing relationships, broken assets, translation fallbacks, search results and factual samples. Content deliverables must be real production assets; test fixtures and demo records are explicitly separated. Map missing executable work to TODO.

For manually produced video/audio, track approved script -> production handoff -> actual assets -> rights and editorial QA -> publication evidence under Content and Launch; the kit cannot claim an external production step occurred without returned files/evidence.

## Performance budgets

The following are recommended starting budgets for the premium web profile, not promises or universal defaults. A product adopts concrete requirements after measuring representative public routes and authenticated critical journeys.

| Measurement | Suggested starting gate |
| --- | --- |
| Lighthouse mobile production performance | Median >=95 of 3 equivalent cold runs |
| Lighthouse accessibility, best practices, SEO where applicable | Target 100; inspect each failed audit and manual exclusions |
| Field Core Web Vitals | p75 LCP <=2.5s, INP <=200ms, CLS <=0.1 |
| Assets and server work | Explicit route JS/CSS/image/font bytes, query count and response-time budgets |
| Flutter | Profile/release trace on named devices; set frame, startup, memory, image and scroll budgets |

Record tool/version, build, device/CPU, network, cache, route, fixture size and raw reports. Keep mobile and desktop results distinct. Laboratory Lighthouse runs and field user measurements answer different questions; TBT is not INP. A new site with no field data reports NOT_AVAILABLE, not an invented field PASS. Target high scores while retaining real features and accessible interactions; do not disable functionality, hide UI or remove required assets solely to inflate a score.

Prefer appropriately sized modern images, explicit dimensions, useful lazy loading, font subsetting/loading choices, restrained client JavaScript, query/index/cache budgets and profiling. Fix the measured bottleneck. SEO scores do not guarantee rankings; content quantity does not guarantee quality.

Sources checked 2026-09-09: [Core Web Vitals](https://web.dev/articles/vitals), [Lighthouse scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring), [Google people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).
