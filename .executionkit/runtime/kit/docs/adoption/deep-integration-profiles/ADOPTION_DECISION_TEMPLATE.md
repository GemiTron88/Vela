# Deep-Integration Adoption Decision Record Template

Use this as a bounded **decision/evidence record**, not as a backlog. Canonical executable integration work still belongs in `TODO.md` / the configured native task authority.

## 1. Repository baseline

- Repository:
- Default/current branch:
- Evaluated HEAD:
- Observable worktree/upstream limitations:
- Existing ExecutionKit version/baseline:
- Existing adoption record:

## 2. Maturity classification

Select exactly one from current live evidence:

- [ ] `M0_PLANNING_ONLY`
- [ ] `M1_EARLY_IMPLEMENTATION`
- [ ] `M2_ACTIVE_DEVELOPMENT`
- [ ] `M3_NEAR_COMPLETE`
- [ ] `M4_PRODUCTION`

Evidence/rationale:

- runtime/package manifests observed:
- implemented surfaces observed:
- active/partial execution history observed:
- release/RC evidence observed:
- production deployment/operations evidence observed:
- facts that remain unobservable/unknown:

Do not use a remembered completion percentage as evidence.

## 3. Adoption mode

Select independently from maturity:

- [ ] `NATIVE_BOOTSTRAP`
- [ ] `NATIVE_RECONCILIATION`
- [ ] `CONTROLLED_MIGRATION`
- [ ] `COMPATIBILITY_ADOPTION`

Rationale and preservation boundary:

## 4. Canonical task authority

- canonical mutable source:
- native lifecycle/states:
- dependency semantics:
- archive/history source:
- current non-terminal frontier roots:
- current IN_PROGRESS / IMPLEMENTED / REVIEW / CORRECTION work to preserve:
- task adapter: `canonical-blocks` / `projection-json` / other supported adapter:
- source-hash/freshness rule where projected:

## 5. Integration frontier decision

- integration phase/native equivalent:
- integration audit gate:
- activation task/boundary:
- State OS task/native equivalent:
- SEO OS applicability/reconciliation task/native equivalent (`EK00-005S` by default):
- exact frontier roots that receive activation ancestry:
- historical terminal/released work intentionally left untouched:
- rationale proving the frontier matches the selected maturity profile:

## 6. Managed runtime topology

- [ ] root-distributed managed tooling
- [ ] isolated pinned runtime

If isolated:

- runtime path:
- exact version/commit:
- product discovery/UI/content/SEO/coverage exclusion:
- project wrapper paths:
- activation path adaptation:
- MCP path adaptation:
- editor/plugin/hook path adaptation:

A full embedded kit source tree must not become part of the product or search denominator.

## 7. Agent OS preservation

- `.agents` classification: missing / partial / mature
- native roles preserved:
- native skills preserved:
- native rules/workflows/contracts/templates preserved:
- deterministic manifest/routing strategy:
- State rehydration route proof:
- SEO specialist/gate route proof when applicable:
- reviewer/audit separation proof:
- representative specialist route checks:

## 8. Seven-capability + State reconciliation

For each capability authority, record native authority, ExecutionKit integration and evidence state. Record State OS separately because it is cross-cutting and not capability-leveled:

- Execution OS:
- Agent OS:
- Content OS:
- SEO OS:
  - capability level: `NONE|LITE|STANDARD|FULL`
  - applicability: `AUTO|ENABLED|DISABLED`
  - evidence-backed resolution: `APPLICABLE|NOT_APPLICABLE|BLOCKED|UNKNOWN`
  - public search surface/page-family source:
  - stronger native SEO controls preserved:
  - programmatic/facet/local/commerce/international modes applicable:
  - candidate/release gate requirement:
- Audit OS:
- Test OS:
- Launch OS:
- State OS #8:
  - checkpoint/rehydration policy:
  - Memory authority (`ADVISORY_ONLY` when used):
  - Amnesia Test evidence:

Allowed evidence states include `PASS`, `FAILED`, `NOT_RUN`, `NOT_AVAILABLE`, `NOT_APPLICABLE`, `NOT_IMPLEMENTED`, `BLOCKED` as appropriate. Never turn absence into PASS. `NOT_APPLICABLE` SEO requires an observed surface/intent rationale, not merely a missing contract.

## 9. Product/runtime applicability

- Laravel/PHP:
- Flutter/Dart/device:
- browser/accessibility/visual:
- organic SEO/search discoverability:
- Lighthouse/search-facing performance:
- public page families and intended index policies:
- component/design system:
- content/source/rights:
- security/data/migrations:
- offline/sync:
- money/transactions:
- AI/RAG:
- release/production:

For M0, every planned-only/N/A runtime item must identify its transition trigger. For M1–M4, detected real runtimes and public search surfaces may not be hidden as planning-only.

## 10. SEO surface and evidence boundary

Complete this whenever `capabilities.seo != NONE` or a public organic-search surface exists/plans to exist:

- public hosts/base URLs:
- default locale/locales:
- rendering model:
- indexable page families:
- explicitly noindex/private page families:
- canonical/redirect authority:
- robots/sitemap authority:
- hreflang/international policy:
- structured-data registry/eligibility:
- internal-link/breadcrumb policy:
- programmatic eligibility/coverage thresholds:
- representative verification samples:
- current Search Console/search-monitoring ownership when available:
- evidence that is repository/candidate-bound:
- evidence that is external/production/search-engine-only:
- known SEO blockers/findings mapped to canonical TODO:

Do not record ranking, indexing, rich results or organic traffic as guaranteed outcomes.

## 11. MCP/editor/framework evidence

- static files/config installed:
- dependencies resolvable:
- MCP starts:
- tools discoverable/callable, including SEO status/validation when configured:
- editor/plugin/framework sees integration:
- safe read-only smoke action result:
- blockers/unobservable host facts:

Static registration is not host runtime proof.

## 12. CI/Test evidence boundary

- workflow trigger policy:
- project runner label:
- OS/platform matrix:
- physical runner evidence observed/unobserved:
- targeted migration checks:
- SEO structural/contract checks:
- candidate-bound SEO release checks when applicable:
- final corrected candidate CI requirement:
- pre-existing failures/skips/flakes:

## 13. Discovery/audit findings

- current denominator reconstructed:
- current public-search denominator reconstructed:
- ExecutionKit runtime excluded:
- material pre-existing gaps:
- canonical TODO mappings:
- accepted non-action/risk dispositions:
- unresolved blockers:

No report/checklist/SEO audit becomes a second backlog.

## 14. Production safety — M4 only

- current production release/deployment evidence:
- incident/hotfix state:
- branch/staging migration boundary:
- production side effects explicitly **not authorized** by adoption:
- search-facing production changes explicitly **not authorized** by adoption:
- current robots/noindex/canonical/redirect/sitemap/hreflang/search-monitoring ownership:
- any separately authorized production action and authority:
- service/search continuity and rollback evidence:

ExecutionKit BOOTSTRAP is control-plane state; it is not a statement that production is offline or deindexed.

## 15. Activation decision

Activation may proceed only when:

- maturity classification is still current;
- canonical integration tasks are complete under native lifecycle;
- `EK00-005S` or the native SEO equivalent is inside integration-gate ancestry;
- independent integration audit is accepted;
- profile-required runtime/host/CI/SEO evidence is PASS or truthfully non-applicable;
- no blocking integration finding remains;
- the correct current/future frontier is gated;
- no historical work was rewritten merely for cosmetic ancestry;
- no search-engine outcome was fabricated from repository validation;
- for M4, no unauthorized production or search-facing side effect occurred.

Final evaluated SHA:
Independent reviewer:
Activation result:
Known evidence limitations:
