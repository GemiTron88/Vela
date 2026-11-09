# M4_PRODUCTION — Live production / stable maintenance system

Use this profile only when observable evidence shows that a real production deployment exists and the repository has operational/release history.

`M4` is the most preservation-heavy profile. The first obligation is to avoid turning control-plane adoption into a production incident or an organic-search outage.

## Primary objective

Add or upgrade ExecutionKit as a **change-control layer for future work** while preserving the currently serving product, deployment model, data, operations, search behavior and historical evidence.

## Critical semantic distinction

ExecutionKit `projectState=BOOTSTRAP` means **normal ExecutionKit-controlled product execution is paused pending reconciliation**. It does **not** mean the deployed production service is offline, invalid or “back to bootstrap.”

Adoption must never modify production runtime or search-engine-facing state merely to make the control-plane state look consistent.

## Preferred adoption behavior

Use `COMPATIBILITY_ADOPTION` by default. Existing healthy release tooling, CI, tests, runbooks, agents, task systems, deployment topology, SEO/search controls and domain controls are preservation authorities.

Use `CONTROLLED_MIGRATION` only for specific unsafe/incompatible control-plane semantics, and stage it transactionally in a branch/staging environment before relying on it for future production changes.

Do not perform a template rewrite of a healthy production repository.

## Production intake before mutation

Capture read-only evidence for:

- current production release/version/SHA/artifact when observable;
- deployment environments and promotion path;
- current branch/worktree and release branch/tag policy;
- active incidents/hotfixes/maintenance work;
- canonical task/change authority for current/future work;
- CI/CD/self-hosted runner topology;
- migrations/backups/restore/rollback procedures;
- secrets/config ownership boundaries without exposing secret values;
- observability/health/alerts/logging ownership;
- current tests, smoke checks and known failures;
- runtime dependencies/platforms;
- current security/privacy/compliance obligations;
- current Agent/editor/MCP tooling;
- public production hosts, indexable page families and current search architecture;
- current robots/noindex/canonical/redirect/sitemap/hreflang/structured-data behavior where applicable;
- current Search Console/analytics/search-monitoring ownership and available evidence without treating third-party observations as task authority.

Remote repository files alone do not prove production health, indexing, ranking or traffic. Record unknown production/search facts as unknown/external evidence requirements.

## Mutation boundary

Deep integration is a repository/control-plane change unless explicit authority says otherwise. By default it MUST NOT:

- deploy to production;
- run destructive migrations;
- modify live data;
- rotate secrets;
- change DNS/provider/store configuration;
- change production robots/noindex/canonical/hreflang/sitemap/redirect rules;
- enable risky feature flags;
- restart production services;
- alter external production state.

Any such side effect needs separate explicit environment authority and normal Launch/operations controls. Search-facing configuration changes are production changes because they can remove or duplicate discoverability at scale.

## Frontier-gating rule

Preserve historical terminal/released work. Gate the **next current/future change frontier**: maintenance tasks, hotfixes, next release work, backlog roots or active non-terminal candidates that could otherwise execute.

Do not attempt to reconstruct every historical release task into a new TODO. Historical Git/releases/incidents/search telemetry remain evidence/history; canonical TODO owns current/future executable work.

If an urgent production incident is already active, do not let a broad integration migration block the emergency response path. Use the project's explicit incident/hotfix authority, then reconcile the resulting state before normal autonomous execution resumes.

`EK00-005S` or a semantically equivalent SEO reconciliation task must still sit inside the current integration-audit ancestry. It reconciles existing production search truth without rewriting historical releases.

## Integration execution strategy

Prefer this order:

1. read-only intake/discovery and baseline record;
2. branch/staging control-plane migration;
3. preserve/adapt native task and Agent systems;
4. configure seven capability authorities plus cross-cutting State OS around current production reality;
5. reconcile SEO applicability and preserve the current production search-surface contract before changing any search-facing behavior;
6. run non-destructive validators and existing tests;
7. install/smoke-test MCP/editor/tooling locally/staging;
8. map findings to canonical current/future TODO;
9. independent deep integration audit;
10. activate ExecutionKit control plane for normal future work;
11. use the existing release process for any later product deployment.

## Production SEO preservation and monitoring

When SEO is applicable, adoption must treat the current search footprint as production state:

- preserve stronger native URL/canonical/redirect/robots/sitemap/hreflang/structured-data policy unless a canonical change task explicitly owns a modification;
- inventory major indexable page families and known generated/facet/location combinations before changing routing or rendering;
- distinguish current Search Console/index observations from repository intent and from guaranteed future outcomes;
- map accidental noindex, canonical drift, redirect loops/chains, sitemap loss, orphaning, malformed hreflang, structured-data regressions and newly indexable low-value generated URLs as findings;
- preserve or explicitly replace search-monitoring ownership; do not silently remove Search Console/analytics/alerting integrations during adoption;
- ensure candidate S3 validation precedes any release and production S4/S5 checks observe the deployed result where authorized;
- use rollback/roll-forward authority for material search regressions just like other production regressions;
- never claim ranking/index inclusion/rich results/traffic as guaranteed by ExecutionKit.

## Test/Audit/Launch requirements

Production adoption requires the strongest evidence boundaries where applicable:

- baseline existing product tests before migration and post-migration regressions;
- security/authorization/data-safety checks appropriate to the change;
- exact candidate identity, including applicable SEO contract hash, for release claims;
- candidate-bound SEO S3 evidence and authorized production S4/S5 verification for search-sensitive releases;
- staging/canary/smoke evidence where the native release process requires it;
- rollback/restore verification;
- observability/health/search-monitoring ownership;
- independent Audit and Launch authority separation.

ExecutionKit must preserve stronger native production gates rather than replacing them with generic checks.

## Runtime placement and host integration

If the complete kit is embedded inside the repository, keep its source tree outside product discovery/audit/content/SEO denominators (for example `.executionkit/runtime/...`). Path-sensitive activation/MCP/editor integration must be adapted to that topology and smoke-tested.

Do not change host/editor/MCP configuration on production machines simply because repository files were installed. Runtime host changes require their own operational authority.

## Mandatory M4 evidence

Prove:

- current production history/release authority was preserved;
- no unauthorized production or search-facing side effect occurred during adoption;
- current/future execution frontier is gated correctly without rewriting historical releases;
- native CI/release/runbook/search controls remain reachable;
- task/Agent/component/content/SEO/quality authorities are reconciled to current code and production intent;
- production-only and search-engine-only facts are not fabricated from repository metadata;
- required staging/local host integrations were actually observed or truthfully blocked;
- independent integration audit passes;
- activating ExecutionKit changes autonomous execution eligibility, not production runtime or indexing truth.

## Acceptance trap to avoid

The main M4 failure is **confusing control-plane migration with product deployment or search migration**. A production project can remain live while ExecutionKit is in BOOTSTRAP/reconciliation. Preserve service and search continuity and gate future AI execution until the control plane is trustworthy.
