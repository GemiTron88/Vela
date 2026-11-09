# Launch OS

**Status:** CANONICAL for production/distribution release gates.  
**Capability level:** `[LITE|STANDARD|FULL]`

> Launch OS is a release gate system, not an execution backlog. Agent OS may route launch/reviewer/operations context; it does not authorize irreversible production side effects or own task state. Any failed gate that requires implementation must map to `TODO.md` under Execution authority. Passing an implementation/test gate does not itself authorize an irreversible production side effect.

SEO OS owns search applicability, public page-family intent/value, index/canonical/structured-data/programmatic policy and S0–S5 SEO semantics. Launch OS does not replace SEO OS; it enforces applicable SEO release/production gates at the correct release boundary and binds them to the same candidate/environment.

## 1. Release identity

- Candidate commit/tag: `[VALUE]`
- Artifact/build: `[VALUE]`
- Environment: `[VALUE]`
- Release owner/agent: `[VALUE]`
- Deployment authority: `[PERSON / SYSTEM / POLICY REFERENCE]`
- Rollback owner: `[VALUE]`
- SEO contract/control hash when applicable: `[VALUE / N/A + rationale]`

The release candidate must be immutable/identifiable enough that all gate evidence refers to the same software state. A material change to code/config/content or an applicable SEO control contract invalidates stale candidate-bound evidence.

## 2. Gate register

| Gate | Applicability | Pass criteria | Status | Evidence / TODO task |
| --- | --- | --- | --- | --- |
| REL-TESTS | YES | Required RC suite passes on the candidate | NOT_EVALUATED | |
| REL-SEO | `[YES/N/A]` | Applicable SEO S3 passes on the exact candidate/current SEO contract; S4/S5 production procedures are ready | NOT_EVALUATED | |
| REL-BUILD | YES | Production build/artifact succeeds and is identifiable | NOT_EVALUATED | |
| REL-DATA | `[YES/N/A]` | Migrations/backups/restore/data validation satisfy risk | NOT_EVALUATED | |
| REL-CONFIG | YES | Production configuration/secrets presence is verified without exposure | NOT_EVALUATED | |
| REL-OBS | `[YES/N/A]` | Required logs/health/errors/metrics/alerts are ready | NOT_EVALUATED | |
| REL-ROLLBACK | YES | Rollback/roll-forward/recovery path is viable | NOT_EVALUATED | |
| REL-SECURITY | `[YES/N/A]` | Required security/privacy release checks pass | NOT_EVALUATED | |
| REL-INTEGRATIONS | `[YES/N/A]` | Live integration configuration/readiness is verified safely | NOT_EVALUATED | |
| REL-SMOKE | YES | Critical post-deploy/distribution smoke succeeds | NOT_EVALUATED | |
| REL-HEALTH | YES | Defined post-launch observation window remains healthy | NOT_EVALUATED | |

Gate statuses should use an explicit vocabulary such as:

```text
NOT_EVALUATED
PASS
FAIL
BLOCKED
N/A
```

`N/A` should include rationale when applicability would otherwise be ambiguous. `REL-SEO=N/A` requires the evidence-backed SEO applicability decision; it is not inferred from the absence of keywords or an SEO file.

<a id="rel-tests"></a>
## 3. REL-TESTS — Release-candidate verification

Pass only when the complete test/static/build/security scope required by Test OS and the selected project risk profile has run against the identified candidate or an equivalent reproducible build state.

Record concise evidence such as:

- CI run/check ID;
- commit SHA;
- required suite names;
- pass/fail result;
- accepted known limitations where policy explicitly allows them.

Do not treat a documentation statement saying `PASS` as evidence without an executed check.

<a id="rel-seo"></a>
## 3A. REL-SEO — Search release and production boundary

When SEO is applicable:

- **S3 / release:** run `node bin/validate-seo.mjs . --release` (normally through `release-readiness`) on the exact candidate and current `executionkit.seo.json` control hash;
- verify the required representative page-family/search-contract evidence is current and any material programmatic/local/commerce/international rules are fail-closed as declared;
- **S4 / production:** after authorized deployment, verify the declared production robots/status/redirect/canonical/sitemap/hreflang/rendered/structured-data behavior against the real target;
- **S5 / operations:** establish/observe the declared ongoing search-health signals and ownership; material regressions map to canonical TODO or incident/change authority.

A repository/SEO PASS proves only declared technical/contract evidence. It does not guarantee search-engine indexing, ranking, rich-result display or organic traffic.

Search-facing production changes such as domains, redirects, robots, `noindex`, canonical, hreflang, sitemap generation or large route/indexability sets are production state changes. They require target identity, deployment authority, rollback/roll-forward thinking and post-change evidence; they are not incidental SEO cleanup.

<a id="rel-build"></a>
## 4. REL-BUILD — Production artifact integrity

Verify as applicable:

- production build succeeds;
- artifact/package/app bundle is identifiable;
- source commit/tag is known;
- signing/provenance requirements are satisfied;
- environment-specific configuration is not accidentally embedded when it should be injected;
- generated assets/schema/client code are current;
- no debug/test-only configuration leaks into production artifacts.

<a id="rel-data"></a>
## 5. REL-DATA — Data, migration, backup and restore

Document and verify, proportional to risk:

- migration order;
- backward/forward application compatibility;
- database/data backup point;
- restore procedure/readiness;
- destructive-change review;
- large-table lock/downtime impact;
- data backfill/reconciliation;
- retry/restart behavior;
- post-migration assertions;
- rollback or roll-forward strategy;
- source/target environment identity.

Implementation authority does not itself authorize applying a destructive production migration. The live action requires the project-defined environment authority.

<a id="rel-config"></a>
## 6. REL-CONFIG — Environment, secrets and runtime configuration

Verify required production configuration without recording secret values.

As applicable check:

- environment identity;
- required keys/secrets exist;
- sandbox/test credentials are not used in live mode;
- live credentials are not used unintentionally in non-production tests;
- domains/callback URLs/origins are correct;
- feature flags/defaults are correct;
- worker/queue/scheduler configuration is correct;
- storage/CDN/search/cache configuration is correct;
- mobile/app-store environment configuration is correct;
- public host/domain/base-URL configuration matches applicable SEO canonical/redirect/hreflang/sitemap policy.

Evidence should prove presence/behavior, not reveal secrets.

<a id="rel-obs"></a>
## 7. REL-OBS — Observability and operational visibility

Verify observability appropriate to the project:

- application/runtime logs;
- error/crash reporting;
- health/readiness endpoints;
- metrics/traces where required;
- business-critical health indicators;
- alert routing/ownership;
- privacy/redaction of logs;
- dashboards/runbooks where required;
- deploy/release correlation;
- S5 search-health monitoring ownership/signals where the SEO contract declares them.

A launch is higher risk when failure can occur invisibly.

<a id="rel-rollback"></a>
## 8. REL-ROLLBACK — Recovery and rollback

Define and verify:

- rollback/roll-forward trigger;
- code/artifact rollback mechanism;
- database migration compatibility;
- data repair implications;
- cache/search/queue compatibility;
- feature-flag/canary fallback where used;
- required backup/restore dependencies;
- incident communication/escalation path;
- who/what is authorized to initiate rollback;
- search-facing rollback/roll-forward path for material robots/noindex/canonical/redirect/sitemap/hreflang regressions where applicable.

Do not claim rollback readiness solely because the previous commit exists. Verify that stateful changes are compatible with the recovery strategy.

<a id="rel-security"></a>
## 9. REL-SECURITY — Security and privacy release gate

Where applicable verify:

- required security audit findings are resolved/accepted;
- authentication/authorization/tenant boundaries are intact;
- secrets are not exposed;
- production security headers/TLS/origin policy are correct;
- file/webhook/input boundaries are verified;
- dependency/security scans required by policy pass;
- privacy/logging/retention behavior is acceptable;
- privileged/admin flows receive required checks.

Failed executable findings map to TODO IDs.

<a id="rel-integrations"></a>
## 10. REL-INTEGRATIONS — Live integration readiness

For each live external dependency verify as applicable:

- correct live/sandbox mode;
- credentials/configuration presence;
- callback/webhook endpoint;
- signature/authentication validation;
- idempotency/retry behavior;
- rate-limit/error behavior;
- monitoring/reconciliation;
- safe provider-side activation sequence;
- fallback/degraded behavior.

Do not trigger real customer messages, payments or irreversible provider actions merely to prove configuration unless the launch runbook explicitly authorizes a bounded live verification.

Search-console/provider tooling, when used, is external evidence/operations integration. It does not become task authority or permission to infer search-engine outcomes not actually observed.

<a id="rel-deploy"></a>
## 11. Deployment / distribution procedure

Reference or document ordered, reproducible deployment/distribution steps, including as applicable:

1. identify candidate/artifact;
2. verify target environment;
3. verify pre-deploy gates, including applicable REL-SEO/S3;
4. establish backup/recovery point;
5. deploy compatible code/infrastructure;
6. apply authorized migration/data steps in defined order;
7. start/restart workers/schedulers/services;
8. invalidate/rebuild caches/search/generated assets where required;
9. verify integration callbacks/configuration;
10. execute critical smoke tests;
11. execute applicable S4 production SEO verification on the deployed target;
12. observe health/alerts and begin applicable S5 search-health monitoring;
13. complete rollout/canary promotion;
14. record release evidence.

The runbook should state stop/rollback triggers instead of assuming every step always succeeds.

<a id="rel-smoke"></a>
## 12. REL-SMOKE — Post-launch critical smoke

Verify a minimal but meaningful set of production/distribution journeys without unsafe side effects.

Examples:

- application boots and health endpoint is healthy;
- authentication/session path works;
- core read path works;
- bounded synthetic write path works where authorized;
- queues/workers process expected safe smoke jobs;
- storage/search/cache/integrations respond correctly;
- mobile/web client can reach the intended API/environment;
- applicable S4 search-facing technical behavior matches the deployed SEO contract.

Use sandbox/synthetic/allowlisted behavior for payments/messages where possible.

<a id="rel-health"></a>
## 13. REL-HEALTH — Post-launch observation

Define the observation window by risk rather than arbitrary habit.

Monitor applicable signals:

- error/crash rate;
- latency/throughput;
- queue backlog/failures;
- database/migration errors;
- payment/integration failure rates;
- authentication failures;
- business-critical workflow health;
- infrastructure saturation;
- user-facing regressions/support signals;
- declared S5 search-health signals such as sitemap/canonical/404/structured-data/index-coverage observations where available and authorized.

A release is not considered fully verified if a required post-launch health gate remains unevaluated. S5 observations do not guarantee rankings/traffic and must preserve provenance/freshness.

## 14. Failed gates and discovered work

A failed gate must receive one of these dispositions:

- fixed under an already-open task whose contract includes the issue;
- mapped to a new/existing TODO task;
- explicitly accepted by authorized release policy with rationale;
- declared `N/A` with rationale when genuinely inapplicable.

Do **not** add unchecked implementation actions here and execute them as a second queue. The same applies to REL-SEO: no private SEO remediation backlog.

## 15. Production side-effect boundary

Before any irreversible/external action, establish:

- exact target environment/account/region/project;
- exact release candidate/artifact;
- explicit authority to perform the action;
- rollback/recovery path;
- expected bounded effect;
- evidence to capture afterward.

For public-search systems, production changes to domains, redirects, robots, noindex, canonical, hreflang, sitemap generation or large route/indexability sets use this same side-effect boundary.

Ambiguous target identity or missing authority is `BLOCKED`, not permission to infer.

## 16. Final launch decision

The release may proceed only when:

- every mandatory pre-launch gate is `PASS` or explicitly accepted under project policy;
- applicable REL-SEO/S3 is current for the exact candidate/SEO contract;
- no unresolved P0/P1 launch or material search blocker remains unless an authorized exception exists;
- candidate identity is frozen/known;
- deployment authority and target are known;
- rollback/recovery is viable;
- required production actions are authorized;
- smoke/health and applicable S4/S5 procedures are ready.

After launch, capture the deployed artifact/commit/environment and smoke/health evidence. Capture applicable S4 production verification and S5 operational observations under the SEO/Launch authority boundary. Update applicable TODO tasks to `RELEASED` only when their semantics require release-state tracking and the evidence supports it.

## Product evidence gate

Include configured quality requirements in the RC gate. Missing/failed/not-run or stale required results prevent release. Confirm declared source coverage and perform fresh environment checks. Kit tooling conformance alone is insufficient.

When SEO applies, candidate identity additionally binds the current SEO contract control hash. A materially changed contract/candidate invalidates affected S3 evidence even if unrelated quality evidence remains current.

## v2.2.1 integrity gate

Release-required producer artifacts are rehashed and checked against the candidate/environment, configured command, process result and ordered fresh timestamps. Required test reports must be bound to collected evidence. Null discovery artifacts and missing/duplicate evidence cannot satisfy the release gate.

Applicable SEO evidence follows the same exact-candidate/freshness discipline and never manufactures external search-engine state.

## Reality-closure precondition

Before any production/distribution release can PASS, run the configured integration release validator and strict candidate-bound evidence gates. Every release-required critical journey must have an accepted canonical phase/release gate that transitively converges its declared members and binds to a trusted ExecutionKit evidence producer with black-box/runtime/browser/device proof. A terminal TODO count, unit-test-only evidence, or a self-authored `REAL_PRODUCTION` label is insufficient.

## System release convergence gate

When configured, `releaseGateTask` is the single canonical whole-system convergence authority. It must be an accepted release audit gate whose transitive dependency closure covers every active non-cancelled canonical task in the candidate denominator. Each release-critical journey must also bind concrete required scenarios to an executable black-box/runtime/browser/device/integration producer. Launch remains blocked when phase gates are individually green but the system gate, scenario coverage, current trusted evidence or change-impact revalidation is incomplete.

## Executable Launch OS closure

For launch-capable product projects, terminal TODO state is implementation completion only.

Use:

```bash
node bin/release-project.mjs .
# only after explicit production authority:
node bin/release-project.mjs . --authorize
```

The orchestrator creates the exact candidate, requires current candidate-bound Audit/Test gates, builds and validates the production artifact, runs release readiness, and stops at an explicit authorization boundary before production side effects. Authorized release then deploys the exact artifact and requires configured smoke commands plus a real health URL to pass on the activated release.

`productionVerified=true` requires exact deployed artifact identity, successful configured smoke commands and successful health evidence. A direct low-level deploy cannot by itself make overall project closure true when Audit/Test/readiness evidence is absent or stale.

Source/distribution repositories use a distinct publication authority; they MUST NOT fabricate product-production deployment evidence.

## Strict VPS mobile prohibition

A VPS/server is control-plane and web/API hosting only. NEVER compile APK/AAB (debug or release), execute Gradle/Android builds, install or download Android SDK/build-tools/system images, or install/run an Android emulator on any VPS/server. KVM, available disk/RAM, sudo/root access, missing tools, failed tests, and an Antigravity decision are NOT exceptions. Do not bootstrap mobile tools to unblock a task. Submit typed work to an enrolled physical workstation; if none is available, record BLOCKED and stop the native path. Shorebird build/patch workloads are workstation-only as well. Existing web deployment/queue monitoring stays on the server. No production-VPS Flutter dependency resolution or mobile test workloads.

The native entrypoints fail closed before downloads/builds and require matching owner enrollment of a detected physical host; virtual/cloud/container/CWP hosts cannot be enrolled by a CLI flag. Repository rules govern all agents and manual recovery. Host-level enforcement outside these entrypoints must be verified on the actual host; never claim a source check installed an OS sandbox.
