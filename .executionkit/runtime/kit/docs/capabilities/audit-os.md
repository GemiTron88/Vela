# Audit Capability

**Status:** CANONICAL capability guidance.  
**Mandatory:** Yes for real software; depth varies by risk.  
**Purpose:** Independently challenge whether the current implementation actually satisfies requirements, evidence and product-quality expectations.

## Audit is not another backlog

Audit produces findings, evidence and acceptance decisions. Findings that require executable work map to canonical `TODO.md`/native tasks. Audit reports, screenshots, quality reports and review notes MUST NOT own mutable task state or become a private remediation queue.

Agent OS routes reviewer context; Audit owns assessment criteria/evidence quality; Execution owns task lifecycle and boundary-gate state. SEO OS separately owns organic-search applicability, intent/page-family architecture, crawl/index/canonical policy and S0–S5 SEO semantics. Audit independently challenges whether that SEO authority matches live product/candidate truth; it does not replace SEO OS or create an audit-owned search policy.

## Evidence-first truth discipline

An audit starts from the **live repository/candidate**, not from chat memory, summaries, plans or task labels. Reconstruct current truth from code, configuration, schema, tests, Git/candidate identity, runtime behavior and current artifacts.

Audit output MUST distinguish:

- **VERIFIED CURRENT** — directly observed in current code/runtime/evidence;
- **DOCUMENTED/PLANNED** — required/described but not proven implemented;
- **UNVERIFIED** — plausible but not inspected strongly enough;
- **MISSING/BROKEN** — evidence demonstrates a gap.

A checked task, a phase marked complete, a reviewer label or the adjective `premium` is not implementation evidence. Likewise, route existence, sitemap/schema syntax, Lighthouse scores or a repository SEO validator do not prove third-party indexing, ranking, rich results or traffic.

Requests such as `deep audit`, `honest audit`, `full audit`, `comprehensive audit`, `premium audit` and equivalent wording mean **increase evidence depth and adversarial coverage**. They are not requests for harsher prose, and they never authorize invented defects or ungrounded certainty.

## Reconstruct the denominator before judging completeness

Do not audit only what documentation happens to list. Reconcile applicable sources such as:

- product requirements/specifications and native authorities;
- canonical TODO/native tasks and phase contracts;
- routes, navigation, screens/pages and role-specific surfaces;
- APIs, models/schema, queues/jobs and integrations;
- reusable component/widget/custom-element inventory;
- design tokens, brand assets, content/localization and media;
- `executionkit.seo.json`, public/indexable route families and current SEO evidence where SEO applies;
- declared quality subjects/requirements and tests;
- production/release operational surfaces.

A missing inventory item is itself a finding; do not silently shrink scope until the project appears complete.

For public organic-search products, reconstruct the searchable denominator by intent/entity/page family/index policy. A database entity or route family does not automatically deserve indexing, and a programmatic URL generator does not establish useful unique pages merely because it can produce URLs.

## Audit domains

Select according to project profile/risk, but a FULL production audit normally challenges all applicable domains:

- requirement and scope coverage;
- architecture boundaries and integration ownership;
- security/authentication/authorization;
- privacy/data handling;
- data integrity, persistence and migrations;
- business-rule correctness and state transitions;
- UX consistency and product-specific art direction;
- **component-system conformance and actual reuse**;
- accessibility;
- responsive/adaptive/platform behavior;
- loading/empty/error/offline/recovery/interruption states;
- performance/capacity;
- internationalization/localization/RTL/LTR;
- content quality/provenance and placeholder/demo residue;
- SEO applicability, intent/page-family architecture, crawl/index/canonical/redirect/sitemap/internal-link/structured-data behavior and specialized local/commerce/international/programmatic safeguards where applicable;
- mobile/platform behavior;
- observability/operations;
- integration failure handling;
- dependency/supply-chain concerns;
- test adequacy and skipped/mock-only coverage;
- evidence freshness/candidate binding;
- release/launch readiness.

SEO audit findings follow the same authority rule as every other domain: Audit states the observed failure/evidence, executable remediation maps to canonical TODO, and any changed search policy/contract is reconciled through SEO OS. No `SEO_TODO.md`, crawl report or audit document may become a second backlog.

## Severity

Recommended:

- `P0` — ship blocker: data loss, security-critical, major correctness failure, unrecoverable operational risk.
- `P1` — required before normal release/boundary closure: material requirement, integration or product-quality failure.
- `P2` — important improvement scheduled according to release policy.
- `P3` — optional polish/advisory.

Mechanical adapters may emit `CRITICAL`, `HIGH`, `REVIEW` or informational signals. Map them to the project's Finding Contract severity policy; a `REVIEW` signal means independent inspection is required, not that the product has automatically failed aesthetically or in search.

## Finding disposition

Every finding resolves to one of:

- `OPEN` — not yet triaged; should be transient;
- `MAPPED` — canonical TODO/native task ID exists;
- `DUPLICATE` — maps to another finding/task;
- `FIXED` — original failure/reproduction is proven closed with current evidence;
- `ACCEPTED_RISK` — unresolved risk consciously accepted by authorized decision with rationale/scope/expiry as applicable;
- `INVALID` — finding disproved/stale with evidence;
- `DEFERRED` — still mapped to a canonical future task and explicitly permitted by gate policy.

`ACCEPTED_RISK` is intentionally distinct from task state `ACCEPTED`. No material finding may disappear because an audit file was archived or a task was implemented. `FIXED` requires evidence tied to the original failure condition.

## Cadence and boundary gates

### A0 — implementation self-check

Implementer checks the task contract and obvious local quality using targeted verification. This is not independent acceptance and is **not** the place for expensive project-wide CI. A task changing an applicable public-search surface should run the smallest relevant S0 SEO check without turning A0 into a full-site crawl.

### A1 — workstream / wave audit

At the end of each bounded execution wave, independently inspect the wave's changed surfaces plus affected integration seams. Run targeted tests, component/design checks and rendered checks relevant to that wave.

When SEO applies, A1 also challenges affected public page families, index/canonical decisions, internal-link seams, structured-data visibility/truthfulness and the declared S1 evidence. Audit does not accept `registered/configured == integrated` for search behavior any more than it does for Agent/component behavior.

A wave audit exists to stop defects and UI/UX/search drift from compounding. Material findings map to canonical tasks and block dependent next-wave work until corrected or validly dispositioned. Do not launch the full expensive self-hosted CI merely because a wave ended unless native project policy explicitly requires it.

### A2 — phase audit

Before phase closure, run a fresh-context **full phase audit** across the phase denominator and cross-task journeys. Required order:

```text
phase implementation/reviews converge
-> reconstruct phase denominator
-> mechanical audit/component/design adapters
-> applicable SEO S2 denominator/search-contract challenge
-> independent rendered/runtime audit
-> map findings to canonical TODO
-> remediate + reproduce original failures
-> reconcile findings/tasks/evidence
-> run required manual self-hosted CI on the final corrected phase candidate
-> close phase gate only if all required gates pass
```

If audit remediation changes the candidate after CI, rerun the affected final gate. Phase closure is false merely because implementation tasks are checked/accepted if the boundary audit/CI gate has not passed. Applicable SEO evidence is also stale when the corrected candidate or SEO contract materially changes.

### A3 — release-candidate audit

Broad adversarial review on the **exact** release candidate/artifacts. Repeat applicable phase checks when the candidate changed; do not inherit a stale visual/security/data/search verdict merely because an earlier phase passed.

When SEO applies, independently challenge candidate-bound S3, the current SEO contract/control hash, representative page-family evidence, programmatic safeguards and release blockers. Search-facing evidence must prove only its declared observations; Audit must reject claims that a local PASS guarantees external search-engine outcomes.

### A4 — launch verification

Production behavior, monitoring, rollback/recovery and release-specific controls where authorized. When SEO applies, A4 challenges whether S4 actually observed the deployed target and whether required S5 monitoring/ownership exists. Search-facing production changes such as robots/noindex/canonical/redirect/sitemap/hreflang changes are operational state and need target/rollback evidence, not incidental cleanup.

## Canonical audit task routing

When a boundary requires executable state, represent it once in canonical TODO/native task authority using:

```text
Action: audit
Audit Boundary: ad-hoc|wave|phase|release
```

A valid dependency-ready audit gate routes to the independent Audit reviewer workflow. Unsupported declared actions and invalid/missing audit boundaries fail closed instead of becoming implementation work.

If the gate discovers executable remediation, map those tasks into canonical authority, keep the gate non-terminal, add the remediation dependencies and let normal execution resolve those dependencies before the gate is selected again.

## Premium UI/UX audit — mandatory matrix

When the project/surface has a premium quality contract, independently inspect actual rendered output with real or production-shaped data. Source-only review and a happy-path screenshot are insufficient.

Review at minimum:

| Area | What the audit must challenge |
| --- | --- |
| Product identity | Approved brand/art direction, semantic tokens, typography, icon/media language, elevation/motion and absence of framework-default visual identity |
| Surface purpose | Information architecture, hierarchy, density and actions fit the actual role/job; admin/owner/field/consumer surfaces are not lazily cloned layouts |
| Component reuse | Canonical component/widget/custom-element families are actually consumed; variants/states are reused instead of rebuilt per screen |
| Functional richness | Useful context/actions/filtering/sorting/workflows exist where required; “premium” is not decorative card count |
| Interaction | Focus, keyboard/touch, navigation, feedback, overlays, destructive confirmation, back behavior and interruption handling |
| States | loading/skeleton, empty, error, success, disabled, permission, offline/reconnect/conflict/retry as applicable |
| Responsive/adaptive | narrow/mobile, tablet, wide, orientation/safe-area/keyboard behavior, RTL/LTR, long Arabic/Latin copy and text scaling |
| Accessibility | semantics/labels, contrast, focus order, screen reader, reduced motion and target sizes |
| Content/assets | real copy/data/assets, localization, helpful state copy, no lorem/demo/placeholder/fake metrics |
| Performance | production build/device/browser budgets, frame/scroll/image/network behavior as applicable |
| Platform-native behavior | Browser/Livewire lifecycle, custom-element host contracts, Android/iOS Flutter behavior and native navigation/input conventions |

For public search-facing pages, visual richness never substitutes for intent-matched visible value, crawlable semantics, truthful structured data, sane canonical/index policy or useful internal discovery.

## Detecting AI-generic / poor / simple / basic UI

The audit MUST actively look for generic or under-designed outcomes. Common signals include:

- framework/starter-template appearance with little product-specific identity;
- the same rounded-card/shadow/grid/dashboard recipe applied to unrelated jobs;
- cloned hero/dashboard/card structures across operational and consumer surfaces;
- gratuitous cards, gradients, badges, charts or animation that do not improve hierarchy, decisions or actions;
- raw buttons/inputs/dialogs/cards recreated inside screens when the product component system already owns that semantic role;
- duplicated variants and one-off styling instead of reusable semantic components/tokens;
- sparse/basic screens that omit required context, actions, filters, feedback or recovery states;
- screenshot-first polish masking non-functional interactions, missing states or broken responsive behavior;
- generic empty/error/call-to-action copy, placeholder imagery, demo/mock residue or fake metrics;
- inconsistent typography, iconography, spacing, elevation, motion or interaction grammar;
- a mechanically green screen that still fails the native visual direction/reference;
- AI-generated/programmatic search landing pages that differ mainly by keyword/location substitution and lack distinct visible user value.

These are **review signals**, not universal aesthetic prohibitions. For example, cards or gradients can be valid product choices. Automated heuristics may identify suspicious repetition, but only rendered/contextual review can issue the final generic-vs-premium verdict.

## Component-system conformance across our primary UI stacks

### Livewire / Blade / Tailwind / Alpine

Inspect native Blade/Livewire component catalogs and semantic tokens before reviewing screens. Reject repeated one-off form, action, modal/drawer, feedback or state markup when reusable product components already cover it. Exercise actual Livewire morph/navigation and Alpine ownership in browser; server-only component tests do not prove UI behavior.

### Web Components

Inspect registered custom elements and host integration. Verify applicable surfaces consume canonical elements rather than rebuilding equivalent controls. Review attributes/properties/events, slots/parts, lifecycle cleanup, focus/form behavior, SSR/hydration/fallback and integration with the host framework.

### Flutter

Inspect the native reusable widget/component system and semantic Theme/extension tokens. Reject screen-level rebuilding of controls already owned by the product library. Verify relevant states, safe areas, text scale, keyboard, back/navigation, lifecycle, permissions/offline behavior and Android/iOS native behavior on the required named emulator/device/build.

Cross-platform parity means shared semantics/behavioral contracts where required; it does **not** mean forcing Blade, custom elements and Dart widgets into identical implementations.

## Mechanical UI conformance adapter

The portable project-local command distributed by bootstrap/migration is:

```bash
node bin/validate-component-system.mjs . --audit --boundary=wave
node bin/validate-component-system.mjs . --audit --boundary=phase
node bin/validate-component-system.mjs . --audit --boundary=release
```

The central distribution also exposes `bin/audit-project.mjs` and `npm run audit:*` convenience wrappers. The portable adapter checks source-level signals such as:

- premium UI with an empty component catalog;
- explicit component replacement contracts bypassed by raw primitives;
- surfaces with suspicious raw-primitive density and no detected canonical component use;
- common repeated generic-layout signals that require rendered review;
- known placeholder assets/lorem residue.

`executionkit.components.json` may declare optional `replaces` semantic roles and platform `usage` tokens. When a component explicitly claims a role and a surface bypasses it, Audit can make a stronger mechanical finding. Without that explicit mapping, the adapter raises review targets rather than guessing semantic equivalence.

The adapter is intentionally not an aesthetic oracle. It cannot prove hierarchy, usefulness, art direction, accessibility quality, native feel or whether a design is genuinely premium from source alone.

## Audit depth profiles

### Lite

Compact highest-risk checklist, boundary findings, canonical task mapping and independent acceptance where required. Premium surfaces still receive rendered review; LITE does not permit fake visual certainty. Applicable public-search surfaces still require bounded independent SEO challenge at their owning gate.

### Standard

Dedicated audit plan, severity/disposition policy, wave/workstream checks, A2 phase audits, finding mappings, component/design conformance, SEO boundary challenge where applicable, evidence rules and release-candidate audit.

### Full

Risk-based matrix, denominator reconciliation, fresh independent contexts, adversarial security/data/search checks, complete premium/product-quality evidence, formal wave/phase gates, repeated release-candidate review and accepted-risk records.

`FULL` describes depth, not a second task system and not permission to audit every file blindly when risk-scoped evidence is stronger.

## Audit quality and independence

Inspect current real code/runtime/tests/artifacts whenever applicable. Document-only review is insufficient when stronger evidence exists. A reviewer string is metadata, not authenticated identity; high-risk projects SHOULD preserve distinct reviewer session/process evidence.

Fresh implementation normally reaches task `ACCEPTED` only after its current contract/evidence passes required independent task review. Boundary audits are additional cross-task assurance; they do not replace task-level acceptance.

A screenshot diff detects change, not design quality. A green validator proves only what its declared inputs/checks cover. Audit must challenge whether the configured denominator, commands, fixtures and rendered evidence are themselves adequate. SEO mechanical outputs are subject to the same rule: schema/crawl/performance tooling cannot independently prove useful intent, correct denominator selection or third-party search outcomes.

## CI relationship

Audit and CI are complementary, not duplicates:

- task loop: targeted verification, including bounded S0 search checks when applicable;
- wave boundary: focused audit + targeted integration/regression checks + applicable S1 SEO challenge;
- phase boundary: full A2 audit/remediation + applicable S2 SEO challenge, then the project's manual self-hosted CI on the final candidate;
- release: exact-candidate A3 + applicable SEO S3 + release gates;
- production: A4 + applicable SEO S4/S5 evidence under Launch/operations authority.

Do not run expensive full CI after every task merely to simulate rigor. Conversely, do not defer all independent audit until the end of a long project; that allows architecture/UI/product/search debt to compound.

## Report review boundary

The v2.2.2 release gate validates collected artifact hashes and completed test records. Audit still verifies whether commands/tests cover the approved denominator and whether rendered output meets native quality references. Discovery uses supported source patterns and excludes dependency/generated trees; dynamic routes, indirect framework registration, semantic component equivalence and native device behavior require native inventory/observation.

For SEO, Audit additionally verifies that search evidence covers the approved current page-family/index-policy denominator and candidate/SEO-contract identity. Search-engine indexing/ranking/rich-result state remains external evidence and is never inferred from repository validation.
