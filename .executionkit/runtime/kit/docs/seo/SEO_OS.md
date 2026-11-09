# SEO OS

SEO OS is the project-facing organic-search control layer for AI ExecutionKit. The canonical authority and ownership boundaries are defined in [`docs/capabilities/seo-os.md`](../capabilities/seo-os.md).

## Project files

When the capability applies, an adopted project uses:

- `docs/seo/SEO_OS.md` — project-specific policy and rationale;
- `executionkit.seo.json` — machine-readable SEO contract;
- `schemas/seo-contract.schema.json` — contract schema;
- `TODO.md` — the only mutable implementation/remediation backlog;
- `.executionkit/evidence/raw/seo-*.json` — derived observations/evidence, never task authority.

## Operating sequence

```text
live repository discovery
-> SEO applicability
-> search audience/journey/intent/entity model
-> page-family/search architecture
-> SEO Surface Contracts
-> canonical TODO implementation
-> S0 task checks
-> S1 wave gate
-> S2 phase gate + independent Audit
-> S3 exact-candidate release gate
-> Launch OS deployment
-> S4 production verification
-> S5 operational observations
```

SEO OS must fail closed when a declared release-critical contract/evidence requirement is missing. It must return `NOT_APPLICABLE`, not fake PASS, when the project has no applicable public organic-search surface.

## Key invariants

1. Route/database existence never implies index eligibility.
2. Generated page count never proves search value.
3. Mechanical validity never proves semantic correctness.
4. Structured data must represent truthful applicable visible facts.
5. Keywords are research evidence, not a substitute for intent/entity/page architecture.
6. SEO findings become canonical TODO work; no SEO shadow backlog.
7. Public web search performance may be an SEO requirement, but generic web/native performance remains Quality/Test/Audit territory.
8. SEO gates contribute to release readiness; they do not deploy or authorize production.
9. Search ranking/indexing/rich-result outcomes are never guaranteed.
