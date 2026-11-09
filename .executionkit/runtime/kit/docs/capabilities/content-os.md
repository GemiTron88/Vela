# Content Capability

**Status:** CANONICAL capability guidance.  
**Mandatory:** Conditional.  
**Purpose:** Ensure product content is inventoried, complete, correct, localized, attributable and maintainable where content is a material product asset.

## Authority boundary

Content OS owns content inventory, taxonomy/content relationships, provenance, localization, editorial/factual quality, media/content lifecycle and content-gate policy. **SEO OS owns organic-search applicability, search audience/journey/intent, page-family/search architecture, crawl/index policy, internal search discovery, structured-data search contracts and SEO release/production gates for applicable public search surfaces.**

The two systems coordinate without duplicating ownership: SEO OS may declare what visible value/search intent a page family requires; Content OS proves that the real content/data/assets are complete, useful, localized and trustworthy. Agent OS routes the applicable content/editorial/SEO specialists but owns neither content nor SEO findings as executable state. Any actionable content or SEO gap maps to Execution OS/canonical TODO. Inventories, contracts and generated coverage reports are criteria/evidence, not a second backlog.

## When Content is NONE

Use `NONE` when the project has no meaningful managed content beyond incidental UI copy that can be handled within normal feature tasks.

Examples:

- small internal CRUD utility;
- single-purpose developer tool;
- backend service with no content catalog.

Do not create a Content OS merely because every UI contains strings. Conversely, SEO applicability does not automatically imply Content FULL; choose each capability from the real denominator.

## Lite

Use when content exists but is bounded.

Typical controls:

- required pages/sections inventory;
- UI copy completeness;
- legal/static pages;
- basic localization checklist;
- content ownership/source notes;
- broken/missing asset check.

## Standard

Use when content is a meaningful product surface.

Add:

- content type inventory;
- taxonomy/category coverage;
- required metadata/content fields;
- localization matrix;
- editorial quality rules;
- source/provenance rules;
- asset requirements;
- content validation workflow;
- empty/error/no-data copy;
- search-facing content requirements supplied by SEO OS where applicable;
- update lifecycle.

## Full

Use for content-heavy products such as large directories, education libraries, medication/product catalogs, recipes, media collections, knowledge bases or heavily localized experiences.

May include:

- domain-by-domain coverage ledger;
- taxonomy integrity;
- schema/content-field completeness;
- provenance/licensing/source policy;
- deduplication rules;
- versioning and update cadence;
- content QA sampling strategy;
- localization fallback and RTL/LTR rules;
- moderation/trust policy;
- age/region eligibility;
- import validation;
- content search/indexing usefulness in coordination with SEO OS;
- editorial and factual-review workflows;
- content retirement/deprecation policy;
- generated coverage reports.

## Project executable content contracts

Content-heavy products may add a tracked `executionkit.content.json` contract so Content OS can invoke product/domain-specific validators in addition to the generic placeholder/depth checks.

The v4 contract shape is:

```json
{
  "schemaVersion": "executionkit-content-contract/v1",
  "profile": "FULL",
  "validators": [
    {
      "id": "catalog-domain",
      "runner": "node",
      "path": "scripts/validate-domain-content.mjs",
      "args": ["--json"],
      "required": true,
      "runOnValidate": true,
      "boundaries": ["wave", "phase", "release"]
    }
  ]
}
```

Project validators execute shell-free through the current Node runtime, must live inside the project root, receive `EXECUTIONKIT_CONTENT_BOUNDARY` and `EXECUTIONKIT_PROJECT_ROOT`, and must emit deterministic JSON with `status`, optional `findings`, `counts`, `scope` and `summary`.

A required validator that is missing, unsafe, non-JSON, crashes, exits unsuccessfully without a FAIL result, or returns an unknown status fails Content OS closed. Findings are merged into the canonical Content OS result and therefore participate automatically in wave/phase/release reconciliation, system gap tasking and release blocking.

This is the preferred extension point for domain-specific catalog/content rules such as licensing/provenance, required locales, taxonomy coverage, media bindings, age/region eligibility, offline manifests or content relationships. It is an executable Content OS extension, not a project-side shadow gate.

## Backlog rule

Content may maintain inventories and coverage criteria, but executable gaps MUST map to TODO.

Allowed:

```text
CNT-MEDS-042 — missing dosage metadata
Execution: EX-0331
Status of finding: OPEN
```

Not allowed:

```text
Content TODO:
[ ] Fix dosage metadata
[ ] Fix 17 categories
```

unless every checkbox is merely a report view generated from canonical TODO task IDs.

## Content evidence

Examples:

- coverage report;
- schema/content-field validation;
- localization completeness check;
- broken-link/asset scan;
- content import report;
- representative QA sample;
- factual/editorial review evidence;
- search-facing content/value sample when required by an SEO Surface Contract.

A crawl/index/schema PASS from SEO OS does not prove underlying content quality, and a Content OS completeness PASS does not prove index/canonical/search architecture correctness.

## Content gate cadence

- C0 item/task validation;
- C1 section/category coverage;
- C2 domain/phase coverage;
- C3 pre-release inventory and quality gate.

Content gates should block launch only for criteria declared release-critical. SEO uses its own S0-S5 cadence and contributes its release result independently.

## Content depth in v2.1+

For content-heavy or search-critical products, do not inherit NONE merely from a generic preset. Inventory the actual domains, taxonomy, audience, locales and formats. Declare useful coverage and editorial/source criteria, including real relationships; data volume alone is not a quality gate. SEO OS separately declares search architecture/index eligibility. Map executable requirements from either system to TODO and attach actual output evidence.

See `docs/capabilities/seo-os.md` and `docs/quality/seo-content-performance.md`. Scripts/prompts are planned media inputs; published video/audio requires returned assets and editorial acceptance.
