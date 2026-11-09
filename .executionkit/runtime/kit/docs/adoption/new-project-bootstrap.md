# New Project Bootstrap — current 3.x

Use `bin/init-project.mjs` only for greenfield/effectively empty projects or a deliberately disposable fresh bootstrap. Existing `.agents` content causes bootstrap refusal unless an explicitly reset target uses both `--force --replace-agent-layer`; normal existing projects must use adoption/migration so native authorities and resources are preserved.

## Command

```bash
node bin/init-project.mjs --target /path/to/project --profile STANDARD
```

Current 3.x has seven capability authorities — Execution, Agent, Content, SEO, Audit, Test and Launch — plus cross-cutting State OS as system #8. `CUSTOM` requires explicit levels for all seven capability authorities plus `--reason`; State OS is not capability-leveled.

Profile defaults bind SEO depth with the project profile: `LITE → SEO LITE`, `STANDARD → SEO STANDARD`, `FULL → SEO FULL`. When the product is known to have no public organic-search surface, `--seo NONE` is a valid explicit bootstrap decision: no fake SEO contract/authority is generated and `seo.requiredForRelease` is `false`. Any enabled SEO depth must set `seo.requiredForRelease=true`; actual applicability may still resolve evidence-backed `NOT_APPLICABLE` from the SEO contract.

## Generated control plane

Bootstrap installs, as applicable:

- root `AGENTS.md`;
- canonical `TODO.md` + terminal-only `TODO_ARCHIVE.md`;
- Execution OS + Agent OS + enabled Content/SEO/Audit/Test/Launch authorities;
- State OS authority/runtime surfaces as cross-cutting continuity system #8;
- phase/deep-integration starter contracts, including State and SEO reconciliation tasks;
- execution/Agent/State/SEO config, schemas, runtime models and validators;
- full `.agents` manifest/resources with deterministic routing for State, SEO and stack/quality specialists;
- lifecycle scheduler + task-context resolver;
- archive/activation/release-readiness tooling;
- candidate/evidence/discovery tooling and candidate-bound SEO S3 validation when applicable;
- optional quality-contract tooling/schema/docs without turning quality into another OS/backlog;
- Antigravity integration tooling and the SEO-aware eight-system host bundle (registration is still not runtime proof);
- manual self-hosted GitHub Actions integrity workflow including structural SEO validation.

Distribution-side adoption/migration/release self-audit tooling is intentionally not copied when it depends on the canonical distribution/version/test surface.

## BOOTSTRAP semantics

Fresh generated projects start `projectState=BOOTSTRAP`. Structural validation may PASS while project-specific placeholders, product implementation or runtime evidence do not yet exist. This is intentional and MUST NOT be described as product acceptance, release readiness, production conformance, search indexing/ranking proof or physical-runner evidence.

Existing projects — including compatible current 3.x upgrades — are migration/adoption concerns and do not use fresh-bootstrap replacement semantics.

The generated canonical `TODO.md` begins with the deep-integration phase. Execute it sequentially, reconcile actual project scope and all seven capability authorities plus State OS, preserve SEO `NOT_APPLICABLE` when justified, and complete the independent integration audit before activation.

Before activation run the applicable structural validators, including:

```bash
node bin/validate-agents.mjs .
node bin/validate-state.mjs .
node bin/validate-seo.mjs .
node bin/validate-execution.mjs .
node bin/validate-ci-policy.mjs .
node bin/validate-deep-integration.mjs . --require-gate-accepted
node bin/activate-project.mjs .
node bin/activate-project.mjs . --apply
```

Activation sets `ACTIVE` only when the configured deep-integration gate and required validators are satisfied. It does not manufacture runtime, production, external-search or release evidence.

## Product-quality policy

Quality tooling is installed but quality contracts are selected by project policy. Premium UI/UX, rich responsive states, content depth, generic performance and SEO are separate concerns with explicit authority boundaries:

- Content OS owns content inventory/provenance/editorial quality;
- SEO OS owns organic-search applicability, search architecture and S0–S5 search criteria;
- Test OS owns executed checks/evidence adequacy, including Lighthouse/browser/performance/schema commands;
- Audit OS independently challenges evidence and implementation;
- Launch OS owns candidate/deployment/rollback authorization.

Do not treat a Lighthouse SEO/category score or metadata/schema presence as the SEO authority or as a guarantee of indexing/rankings.

## Editor integration

Antigravity integration may be generated after project reconciliation. When SEO is enabled, the generated project rule and plugin bundle must expose the current eight-system semantics and `ek-seo` host skill. Registered files are not enough: required resources must be deterministically routable, and local editor/MCP loading or smoke evidence must be observed when that integration is required.

## First execution

```bash
node bin/next-execution.mjs . --json
node bin/resolve-task-context.mjs . --next --json
```

Do not independently scan only READY tasks. Follow the lifecycle-aware action returned by the scheduler: review/revalidation, correction and resume precede new READY implementation; automatic blocker inspection requires an explicitly AI-actionable unblock action. One canonical lifecycle action is executed at a time.

## CI

The generated workflow uses manual `workflow_dispatch`, self-hosted + project label + selected OS. No automatic push trigger or GitHub-hosted fallback is generated. Targeted task verification stays local to the task; the complete self-hosted suite belongs at configured phase/release-candidate boundaries. Required verification remains required when CI is deliberately manual, and an unavailable runner is never converted to PASS.