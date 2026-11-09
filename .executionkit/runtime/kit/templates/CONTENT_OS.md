# Content OS

**Status:** CANONICAL for project content controls.  
**Capability level:** `[NONE|LITE|STANDARD|FULL]`

If `NONE`, this file is normally unnecessary.

Content OS owns content scope/quality/provenance/localization criteria. Agent OS may load content specialist skills; Execution/TODO owns all executable work state. This file must never become a second content backlog.

## 1. Content scope

- Content domains/types: `[LIST]`
- Languages/locales: `[LIST]`
- Primary sources/ownership: `[LIST]`
- Update/freshness cadence: `[POLICY]`

## 2. Inventory

Define required content categories and a coverage denominator by domain/taxonomy/audience/locale/format where material. Reconcile the declared inventory against actual product routes/taxonomy/content sources and approved specifications; an internally complete list is not proof nothing is missing.

## 3. Schemas and required metadata

For each content type define mandatory fields, validation, relationships and fallback behavior.

## 4. Taxonomy / relationships

Define category integrity, deduplication, canonical identifiers and referential rules where applicable.

## 5. Localization

- source locale;
- required locales;
- fallback;
- RTL/LTR;
- untranslated-content policy;
- format/date/number/unit rules;
- long/sparse copy behavior where UI is affected.

## 6. Provenance / rights / factual quality

Define source, licensing, attribution, factual-review, moderation and freshness requirements where relevant. AI-generated content does not bypass provenance/factual/legal review requirements.

## 7. Content QA gates

- C0 task/item;
- C1 section/category;
- C2 domain/phase;
- C3 pre-release.

Gate failures requiring implementation/editorial work map to canonical TODO/native task IDs.

## 8. Findings

Every actionable independent gap uses a finding ID and maps to TODO:

| Finding | Severity | Evidence | TODO | Disposition |
| --- | --- | --- | --- | --- |

Use `ACCEPTED_RISK` only for an authorized unresolved content risk; do not confuse it with task `ACCEPTED`.

## Richness and production evidence

Verify usefulness, completeness, provenance, relationships, asset integrity and freshness. Link gaps to TODO and quality requirements where configured. Test/demo/placeholder content and scripts awaiting external media production do not count as production assets.

Agent/content plans may guide generation, but content inventories and quality reports do not own mutable task state.

## Documentation Fabric boundary

Content OS does **not** by itself document the project. Project architecture/domain/workflow/interface/data/integration/security/testing/deployment/operations knowledge is maintained by the executable Documentation & Knowledge Fabric.

When enabled:

```bash
node bin/documentation-fabric.mjs build .
node bin/documentation-fabric.mjs validate .
```

Generated project knowledge is derived/source-grounded and may support Content OS, Agent OS, Audit/Test and Launch. It never becomes mutable task authority and never overrides live source/runtime evidence.
