# SEO OS

**Capability level:** `[NONE|LITE|STANDARD|FULL]`  
**Applicability:** `[AUTO|ENABLED|DISABLED]`

This project follows the canonical SEO capability in `docs/capabilities/seo-os.md` as distributed by AI ExecutionKit. This file records project-specific search policy only; it is not a backlog.

## Authority

- Canonical mutable work: `TODO.md` only.
- SEO contract: `executionkit.seo.json`.
- SEO OS owns organic-search architecture and search-readiness policy for applicable public/indexable web surfaces.
- Content OS owns real content, provenance, localization and editorial quality.
- Test OS owns executed-check strategy/evidence adequacy.
- Audit OS owns independent assessment and finding disposition.
- Launch OS owns the exact release candidate, deployment and production health.
- State OS may checkpoint SEO context/evidence references but never SEO task state.

## Project applicability

Record why SEO applies or does not apply, based on the actual product/public-web denominator. Do not score authenticated panels, APIs or native applications as SEO surfaces.

## Search model

Document only project-specific decisions that are not already machine-readable in `executionkit.seo.json`:

- target search audiences/journeys;
- important entities/topics/taxonomies;
- locale/region strategy;
- specialized mode decisions;
- project-specific exclusions or risk decisions.

## Page-family contracts

Define indexable/non-indexable page families in `executionkit.seo.json`. Every scalable indexable family must have a distinct intent, useful visible value, index/canonical policy, internal-discovery requirements and representative verification samples.

## Gates

Use the canonical S0-S5 model:

- S0 task SEO check;
- S1 wave SEO gate;
- S2 phase SEO gate;
- S3 release-candidate SEO gate;
- S4 production SEO verification;
- S5 operational monitoring.

Executable findings from any gate map to canonical TODO tasks; this file MUST NOT grow remediation checkboxes.

## Evidence

Bind release evidence to the exact candidate and SEO contract. Production-dependent observations require actual production evidence. Never report rankings, indexing, field CWV or rich-result eligibility as guaranteed outcomes.
