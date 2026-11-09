# Project Intake and Pre-Execution Coverage Contract

**Status:** CANONICAL adoption guidance derived from `STANDARD.md` + `STANDARD_V3.md`.  
**Purpose:** prevent hidden product, architecture, data, security, testing, content, SEO, Agent-routing and launch requirements from surfacing only after AI implementation has already started.

## 1. Principle

The purpose of intake is not to write a giant document for every project. The purpose is to force deliberate coverage of the questions that materially affect execution.

A question may be answered by:

- an approved specification;
- an architecture decision;
- a contract/reference;
- `NOT_APPLICABLE` with evidence-backed rationale;
- an explicit unresolved decision/blocker.

Do not duplicate answers that already exist in a canonical source. Link them. Unknowns that can change implementation must not be silently converted into agent guesses.

## 2. Intake outputs

Before execution starts, the project should be able to identify:

1. approved scope;
2. actors and permissions;
3. major domain boundaries;
4. data ownership/invariants;
5. supported surfaces/platforms;
6. public organic-search applicability and indexable/non-indexable surface boundaries;
7. integration contracts;
8. security/privacy constraints;
9. content scope if material;
10. test/quality strategy;
11. deployment/operations model;
12. release target;
13. unresolved decisions/blockers;
14. project ExecutionKit profile and **all seven capability levels** — Execution, Agent, Content, SEO, Audit, Test and Launch;
15. State OS continuity policy as cross-cutting system #8;
16. Agent OS routing/specialist/reviewer/dependency-safe parallel delegation policy and sequential-fallback constraints;
17. product-quality profile/policy where contractual;
18. phase/workstream decomposition;
19. canonical TODO/native task authority containing all known remaining executable work.

## 3. Product identity and scope

Establish:

- product/project name and one-sentence purpose;
- target users/customers and primary business outcome;
- explicit in-scope and out-of-scope capabilities;
- MVP/first-release boundary if applicable;
- later/future ideas that must not leak into current execution;
- project success criteria;
- countries/regions/languages/locales;
- deadlines and commercial/contractual commitments;
- existing/live system compatibility obligations.

Scope should be specific enough that an agent can classify discovered work as required, optional or out-of-scope.

## 4. Actors, roles and trust boundaries

Identify every meaningful actor, including anonymous visitors, registered users, customers, staff/operators, admins, tenant/org owners, sellers/providers/vendors, drivers/reps, support/auditors, API clients, scheduled workers, external services and machine/service accounts.

For each actor clarify authentication, authorization, ownership/tenant relationship, allowed/prohibited operations, support/impersonation behavior, lifecycle states, data visibility and privileged/high-risk actions.

## 5. Surfaces and deployment units

List separately:

- public website / public storefront / public directory / public marketplace / public editorial pages;
- authenticated web application and account surfaces;
- admin/owner/provider/operator panels;
- REST/GraphQL APIs;
- mobile apps;
- desktop apps;
- browser extensions;
- CLI tools;
- background workers/schedulers;
- realtime services;
- webhooks;
- data pipelines/importers;
- AI services;
- infrastructure services.

For each surface identify whether it is independently built/deployed/versioned/released, whether it is public or authenticated/private, and whether it is intentionally eligible for organic search indexing. This surface classification is the first SEO OS applicability input.

## 6. Domain model

Identify core entities/value objects and the invariants that matter:

- canonical nouns and forbidden/legacy aliases;
- relationship ownership;
- lifecycle states and valid/irreversible transitions;
- computed vs stored values;
- atomic operations;
- ID scope/ownership;
- archive/soft-delete/hard-delete policy;
- historical immutability requirements.

Ambiguous domain vocabulary is a common source of AI drift and should be resolved before large execution.

## 7. Data architecture

Clarify primary datastore(s); relational/document/key-value/search/analytics responsibilities; schema ownership; transaction boundaries; database indexes; consistency; caching/invalidation; internal-search indexing/source-of-truth relationship; analytics/event ownership; retention/archive/backup/restore; tenant isolation; encryption; import/export; and data residency.

For every duplicated/derived store, define the canonical source and reconciliation strategy. Internal application search indexing is distinct from external organic-search indexing governed by SEO OS.

## 8. State machines and workflows

For workflows such as orders, bookings, approvals, delivery, payments or lab results, define states, transitions, authority, preconditions, side effects, notifications, cancellation/rollback, timeout/expiry, retry/idempotency, audit trail and concurrency/conflict handling.

Do not let the agent infer a state machine from scattered UI labels.

## 9. Authentication and account lifecycle

Cover registration, login/logout, session/token model, OTP/password/passkey/social login, verification, reset/recovery, lockout/rate limit, device/session management, MFA, identity changes, suspension, deletion/anonymization, administrator recovery/support and service/API credentials.

## 10. Authorization

Define role/permission model, ownership checks, tenant boundary, field-level restrictions, privileged operations, server-side enforcement, UI visibility vs actual authorization, delegation/impersonation, policy precedence and audit requirements.

A hidden button is not authorization.

## 11. Security

Evaluate input validation, output encoding, injection, upload safety, SSRF/path traversal, CSRF/CORS/origin behavior, authentication abuse, authorization bypass, tenant isolation, rate limiting, secrets, encryption, sensitive logging, audit logging, dependency/supply-chain risk, webhook signatures, replay/idempotency, session security, mobile secure storage, offline-data protection and privileged-admin safeguards.

High-risk security requirements should receive requirement/test IDs and explicit TODO traceability.

## 12. Privacy and compliance

Where applicable establish personal/sensitive data categories, collection purpose, consent, minimization, retention/deletion, user export/access, processors, cross-border transfer, analytics privacy, child/minor considerations, health/financial/regulatory constraints, incident/breach procedures and terms/privacy requirements.

ExecutionKit does not replace legal review; it ensures resulting requirements are represented in execution.

## 13. APIs and integrations

For each integration capture provider/system, purpose, auth, sandbox/live environments, protocol/endpoints, schema authority, error model, timeouts, retries/backoff, idempotency, rate limits, callbacks/webhooks/signatures, reconciliation, degraded mode, observability, credential ownership and test doubles/sandboxes.

## 14. Payments and financial behavior

If money is involved define currency, price authority, tax, discounts, rounding, payment/order relationship, authorization/capture, refunds, partial payments/refunds, wallet/credit, ledger invariants, reconciliation, chargebacks/disputes, callbacks, duplicate protection, failure/retry, sandbox and financial evidence requirements.

Financial correctness should not be left to UI assumptions.

## 15. Offline-first and synchronization

If any surface works offline, define local authority, allowed offline operations, mutation journal/outbox, stable operation IDs, sync trigger/order/retry/idempotency, conflict classes/resolution, tombstones/deletes, clock assumptions, schema migration behavior, auth expiry, media sync, partial sync, crash/reinstall recovery and test matrix.

“Offline-first” is a cross-cutting architecture commitment, not a UI checkbox.

## 16. Realtime behavior

If realtime is used define transport, event authority, subscription authorization, reconnect/missed-event recovery, ordering/duplication, presence semantics, fallback/polling, scaling, observability and test strategy.

## 17. Frontend/web UX

Capture design system authority, breakpoints, navigation/shells, forms/validation, loading/skeleton, empty/error/offline/degraded states, optimistic updates, destructive confirmations, accessibility, RTL/LTR, keyboard behavior, browser support, contractual performance budgets and required analytics events.

For premium products identify approved visual references, semantic tokens, typography/icon/imagery language, density/elevation/motion principles and the product-specific component catalog. Premium must not mean a generic repeated dashboard template.

For public search surfaces, UI architecture must also allow semantic/search rendering without sacrificing the product's premium UX.

## 18. Mobile-specific concerns

Cover supported OS versions, framework/architecture, navigation/deep links, secure storage, permissions, camera/location/files/notifications, background work, offline behavior, lifecycle, push notifications, universal/app links, biometric auth, accessibility, crash reporting, signing, flavors/environments, store requirements and update policy.

Native-only mobile/desktop surfaces are not automatically SEO-applicable merely because a marketing site might exist separately.

## 19. Content and taxonomy

Determine whether Content capability is `NONE`, `LITE`, `STANDARD` or `FULL`.

For material content define content types/inventories, taxonomy/categories, attributes/metadata, editorial ownership, provenance/source/rights, localization, validation, moderation, duplicates, versioning, lifecycle/status, internal search indexing, import/export, media requirements, public-search consumption where applicable, legal/licensing constraints and completeness metrics/gates.

Content gaps requiring engineering/editorial execution map to TODO. Content OS owns actual content quality and provenance; SEO OS owns organic-search architecture and indexability rules.

## 20. Internal product search

Define searchable entities, canonical source, indexing pipeline, filters/facets, ranking/sorting, typo/fuzzy behavior, locale/Arabic handling, permissions/tenant filtering, stale-index tolerance, rebuild/reindex, failure fallback and latency expectations.

Do not confuse internal product search (OpenSearch/Meilisearch/database search/etc.) with external organic search SEO.

## 21. Files, media and storage

Cover file types/sizes, validation, malware scanning where required, metadata, transformations, provider, public/private access, signed URLs, retention/deletion, CDN/cache, backup, retry/resume, offline behavior and legal/moderation concerns.

For public media, SEO OS may additionally define image/video discoverability semantics where applicable.

## 22. Notifications

For each channel define trigger events, recipients, templates/content authority, localization, deduplication, preferences/opt-out, retries, delivery status, provider, sandbox/testing, abuse controls and production-send authority.

## 23. Background jobs and scheduling

Identify queues, job ownership, idempotency, retries/backoff, dead-letter/failure handling, uniqueness/locking, schedules/time zones, long-running jobs, observability, deployment compatibility and consistency implications.

## 24. AI/ML features

If the product includes AI define user-visible purpose, model/provider, local vs remote execution, allowed data, prompt/system policy authority, tools/functions and authorization, retrieval/grounding sources, citations where needed, moderation/safety, hallucination/failure handling, deterministic fallback, latency/cost, evaluation suite, privacy/retention and model/version policy.

AI-generated output should not bypass authorization, transactional invariants, Content provenance or SEO quality/indexability gates.

## 25. Localization and internationalization

Define locales, source language, RTL/LTR, translation ownership, pluralization, dates/times/time zones, numbers/currency, internal-search normalization, locale assets/content, fallback language and testing.

When public multilingual search exists, separately define SEO locale URL strategy, canonical/hreflang relationships and cross-locale duplication policy.

## 26. Accessibility

Set appropriate keyboard/focus, semantics/labels, contrast, screen reader, text scaling, touch targets, motion, error messaging, mobile accessibility and automated/manual checks.

Accessibility findings that require implementation map into TODO.

## 27. Performance and capacity

Clarify material budgets for page/app startup, API latency, background throughput, DB/query performance, internal search latency, concurrency, large datasets, uploads/media, memory/CPU, mobile battery/network, caching, capacity and load testing.

For public search surfaces separately identify search-facing mobile rendering/Core Web Vitals or equivalent budgets when they materially affect SEO. Do not invent precise requirements when the product does not need them; when budgets are contractual, define measurement environment/aggregation and retain raw evidence.

## 28. Observability

Define structured logging, correlation IDs, error tracking, metrics/traces, business/health metrics, alerting, dashboards, privacy/redaction, retention, production smoke/health and operational ownership.

Where SEO operations monitoring is enabled, declare signals such as sitemap, robots, canonical/noindex drift, status/redirect errors, structured-data regressions, orphan growth and relevant external search-console/crawl observations.

## 29. Testing and product-quality strategy

Determine required layers: unit, component/widget, feature, integration, API contract, database, E2E, visual/golden, accessibility, security, performance/load, migration, offline/sync, chaos/recovery, SEO contract/search rendering and release smoke.

Also define fixtures/test data, external mocks/sandboxes, CI environment, flaky/skip policy, useful coverage expectations, task/wave/phase/RC cadence, browser/device/platform matrix, candidate/build/environment binding, evidence freshness, quality profile and coverage-denominator reconciliation.

A green generic validator or zero exit code cannot by itself prove test adequacy, premium quality, SEO external outcomes or complete scope.

## 30. Development, repository and Agent execution conventions

Capture only rules needed by the agent:

- repository structure and primary stacks/versions;
- package managers and build/test/lint/static/type/codegen/format/migration commands;
- branch/commit policy;
- generated/vendor paths not to edit;
- local bootstrap;
- canonical TODO/native task source and archives;
- `.agents` manifest and preserved native resources;
- specialist task tags/skills, including SEO specialists when applicable;
- reviewer-separation policy;
- blocker actionability convention;
- dependency-safe parallel ExecutionKit orchestration policy, explicit ownership/isolation/hotspot constraints, `/boost` ceiling, deterministic integration owner and sequential fallback conditions;
- editor/IDE integrations such as Antigravity, distinguishing file registration from runtime loading;
- expensive build/browser/device resource constraints.

Put stable, high-value navigation rules in `AGENTS.md`; do not copy every plan into it. Agent OS routing never owns mutable task state.

## 31. Infrastructure and environments

Identify local/dev, CI, staging, production, provider/account/region, networking, DB/cache/queues/internal search/object storage/CDN/secrets, domains/TLS, workers/schedulers, scaling, IaC authority and environment promotion.

Public web environment/domain/canonical-host differences must also be captured for SEO when applicable.

## 32. Deployment and launch

Define deployment mechanism, candidate identity, artifact provenance, migrations, downtime, backups/restore, config/secrets, domain/TLS, queues/workers, cache invalidation, internal search reindex, external integrations, monitoring, smoke tests, rollback/roll-forward, store/package release, flags, phased rollout and post-launch verification.

For public organic-search surfaces include release-critical robots/sitemap/status/redirect/canonical/rendered HTML/structured-data checks where declared by SEO OS. External indexing/ranking remains post-deploy evidence, not a guaranteed deploy result.

## 33. Migration from an existing system

If replacing/migrating a live system define source authority, data mapping, compatibility period, backfill, reconciliation, dual read/write if any, cutover, downtime, rollback, historical data, accounts, integrations and decommission criteria.

For existing public sites also preserve or explicitly migrate important URL/redirect/canonical/search-equity behavior rather than silently replacing it.

## 34. Failure and recovery model

Identify meaningful failure modes such as database/queue/cache/internal-search outage, third-party timeout, duplicate webhook, network partition, mobile offline, partial payment, job crash, deploy/migration failure, bad config/secret, corrupted import, storage failure, rollback, AI/agent interruption, reviewer rejection and external blockers that must not starve unrelated READY work.

For public search surfaces include accidental `noindex`, robots/sitemap breakage, redirect/canonical drift and mass low-value/indexable URL generation where material.

## 35. Business continuity

For critical products define RPO/RTO or qualitative recovery, backup frequency, restore procedure/testing, failover, dependency outage behavior, manual fallback, incident ownership and rollback boundaries.

## 36. Analytics and telemetry

Clarify business KPIs, event taxonomy, source of truth, identity/tenant dimensions, privacy/consent, attribution, retention, dashboards, validation and event-loss/duplicate tolerance.

Analytics/business attribution is not a substitute for SEO Search Console/crawl/index evidence where external search operations are separately monitored.

## 37. SEO and public discoverability

First decide whether SEO capability is `NONE`, `LITE`, `STANDARD` or `FULL`, and whether project applicability is `AUTO`, explicitly `ENABLED`, or evidence-backed `DISABLED`/`NOT_APPLICABLE`.

If applicable define:

- actual public search surface/page-family inventory and route patterns;
- user/search intent and entity/topic purpose for each family;
- index/noindex/conditional eligibility;
- canonical policy;
- URL normalization, redirects and status behavior;
- robots and sitemap membership;
- pagination/filter/facet URL strategy;
- internal-link graph and orphan prevention;
- rendered HTML/search accessibility for the real stack;
- title/meta/heading/breadcrumb/media semantic policy where relevant;
- structured-data eligibility/registry and validation without rich-result guarantees;
- locales, URL localization, canonical/hreflang coordination;
- local SEO when real locations/service areas matter;
- ecommerce/product/variant/category rules when commerce is real;
- marketplace/directory listing/category/location rules when applicable;
- editorial/media search rules where applicable;
- programmatic policy with distinct intent, distinct visible value, coverage threshold and empty/thin-page fail-closed behavior;
- mobile/search-facing performance budgets;
- content ownership boundary with Content OS;
- task/wave/phase/release/production/operations SEO gates;
- candidate-bound release evidence;
- post-launch monitoring/search-console/crawl evidence where required;
- measurement/build/environment/evidence freshness.

Do not create pages merely because keyword permutations exist. Search architecture should prevent thin/duplicate/programmatic spam as strongly as it enables useful discoverability.

## 38. Legal and policy artifacts

Identify terms, privacy policy, cookie/consent behavior, licenses/attributions, refund/cancellation terms, regulated disclosures, moderation/community rules and age restrictions.

Legal text authority should be explicit; an AI implementation agent should not invent binding policy when none is approved.

## 39. Support and operations

Clarify support channels, admin/support tools, auditability, user lookup/impersonation controls, retry/reprocess tools, manual corrections, escalation, dashboards, runbooks and access controls.

## 40. Decisions and unknowns

Every material unknown should become one of:

- resolved decision with authority/reference;
- pre-execution blocker;
- task whose purpose is to obtain/validate the decision before dependent implementation;
- explicitly deferred/out-of-scope item.

Do not leave `[TBD]` embedded in a READY task contract.

## 41. Traceability conversion

After intake, convert requirements into execution traceability:

```text
Requirement / invariant
  -> one or more EX task IDs
  -> implementation paths/commits
  -> tests/evidence
  -> independent ACCEPTED decision where required
  -> applicable SEO/Audit/Test/Launch phase or release gate
```

Not every minor statement needs an ID. IDs are most useful for high-impact, cross-cutting, externally committed or regression-sensitive requirements.

## 42. Phase construction

Phases should represent dependency/verification boundaries, not arbitrary calendar chunks. Useful boundaries include repository/foundation, identity/security, domain core, major workflow families, integration/offline/content/search pipelines, operational/admin surfaces, hardening, release candidate and launch.

A phase should be independently gateable. Phase closure requires mandatory canonical tasks `ACCEPTED`/`RELEASED` and applicable gates; an empty READY lane is not closure.

## 43. TODO construction gate

Before calling the project execution-ready, verify:

- every known required implementation outcome has a canonical task or is already proven accepted under current evidence;
- every independent SEO/Audit/Test/Content/Launch finding requiring execution maps to TODO;
- every Agent/control/integration gap requiring repository changes also maps to TODO rather than `.agents` shadow state;
- deep integration includes State OS reconciliation and SEO OS `EK00-005S` or semantic native equivalent;
- task dependencies are coherent and acyclic;
- first eligible lifecycle actions satisfy prerequisites;
- task contracts/references and expected verification/reviewer evidence exist;
- unresolved product/search decisions block dependent tasks instead of being guessed;
- candidate/review/correction/blocked work is not hidden by open-task-only planning;
- no obsolete plan/capability doc claims conflicting execution authority;
- Agent + Execution + State + applicable SEO + CI validators pass.

## 44. Profile selection

Choose **Execution, Agent, Content, SEO, Audit, Test and Launch** levels based on risk/complexity, not on a desire to minimize documentation.

Use `CUSTOM` when capability needs are asymmetric and record a short rationale. Execution, Agent, Audit and Test cannot be `NONE` under current core rules. SEO can be `NONE` only when the project truth supports no organic-search authority; a public website should not silently inherit `NONE` without review.

Choose product-quality policy separately. A project that contractually requires premium UI/UX, rich responsive states, heavy SEO, rich managed content or stronger evidence SHOULD explicitly require the corresponding premium/native quality controls rather than rely on someone remembering later.

Examples:

```text
Small internal utility:
Execution LITE
Agent LITE
Content NONE
SEO NONE
Audit LITE
Test LITE
Launch LITE
Quality standard/native as required
```

```text
Normal production SaaS with public marketing/docs:
Execution STANDARD
Agent STANDARD
Content LITE or STANDARD
SEO STANDARD for the public surface
Audit STANDARD
Test STANDARD
Launch STANDARD
Quality standard or premium by product contract
```

```text
Public directory/marketplace/ecommerce platform:
Execution FULL
Agent FULL
Content FULL when content/catalog is core
SEO FULL
Audit FULL
Test FULL
Launch FULL
Quality premium or stronger native contract
```

```text
Offline native medical/financial app with no public website:
Execution FULL
Agent FULL
Content as required
SEO NONE / NOT_APPLICABLE after surface inspection
Audit FULL
Test FULL
Launch FULL
Quality premium or stronger native contract
```

Profile depth does not itself prove product quality; it selects control rigor.

## 45. Final intake rule

Intake is complete when the remaining uncertainty is intentional and visible. It is not complete merely because many Markdown files exist.

The desired endpoint is:

```text
approved intent
+ explicit architecture/invariants
+ known risks/unknowns
+ seven-capability execution control
+ evidence-backed SEO applicability
+ cross-cutting State continuity
+ complete remaining-work map
+ executable verification/acceptance path
= execution-ready project
```

Once this gate passes, execution should move forward. Do not keep expanding planning indefinitely unless implementation exposes a real missing decision, requirement, coverage gap or safety boundary.
