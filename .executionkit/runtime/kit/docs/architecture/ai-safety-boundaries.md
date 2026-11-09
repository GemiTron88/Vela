# AI Execution Safety and Environment Authority Boundaries

**Status:** CANONICAL guidance derived from `STANDARD.md`.  
**Applies to:** autonomous and semi-autonomous agents that can modify code, data, infrastructure or external systems.

## 1. Core rule

Authority to implement a task does not automatically grant authority to perform every real-world side effect that implementation could trigger.

The execution system must distinguish:

- **code authority** — permission to change repository artifacts;
- **test authority** — permission to run bounded verification;
- **environment authority** — permission to change development/staging/production systems;
- **external side-effect authority** — permission to send messages, move money, publish, delete, rotate, migrate or otherwise affect real users/systems.

An AI agent MUST NOT infer a higher authority merely because credentials are technically available.

## 2. Default environment posture

Unless the project explicitly says otherwise:

- local/development changes are allowed when required by the task;
- ephemeral test resources may be created and destroyed when isolated and non-sensitive;
- staging changes require normal project deployment policy;
- production is read/observe-only for ordinary implementation tasks;
- destructive or externally visible production actions require explicit project authorization/runbook gates.

The safest available environment that can provide valid evidence should be preferred.

## 3. Production side effects

The following are considered production side effects and require explicit authority appropriate to project risk:

- deploying a release;
- applying production migrations;
- deleting or rewriting production data;
- changing DNS/TLS/routing;
- modifying live infrastructure capacity/topology;
- changing production authorization/security policy;
- rotating or revoking credentials;
- publishing app/store/package releases;
- enabling/disabling production integrations;
- changing payment provider live settings;
- sending real customer communications;
- executing financial transactions/refunds;
- bulk import/export of live personal data.

A task that prepares these actions is not automatically a task that is allowed to perform them.

## 4. Secrets and credentials

Agents MUST NOT:

- place secrets in `TODO.md`, specs, audit logs, commits or test snapshots;
- print secret values merely to prove configuration exists;
- commit `.env`/credential files unless they are intentionally non-secret templates;
- copy production credentials into local fixtures;
- weaken secret-management controls to simplify execution;
- transmit secrets to unrelated external tools/services.

Evidence should prove secret availability without exposing the secret, for example by recording a successful authenticated health check or configuration-key presence check.

If a secret is accidentally exposed, treat that as a security finding and follow the project's rotation/incident procedure.

## 5. Data safety

### Production data

Prefer read-only inspection, sanitized snapshots or purpose-built fixtures.

Do not use live customer records for convenient testing when synthetic/sanitized data can provide valid evidence.

### Personal/sensitive data

Minimize retrieval, logging and propagation. Respect project privacy rules and applicable compliance requirements.

### Bulk operations

Bulk update/delete/backfill jobs require:

- bounded selection criteria;
- dry-run or preview when practical;
- backup/restore or rollback plan appropriate to impact;
- idempotency/restart behavior;
- observable progress/failure reporting;
- explicit production authorization.

## 6. Database migrations

Migration implementation may be part of normal code execution. Applying it to production is a separate launch authority.

For high-risk migrations, the task/launch contract should address:

- backward compatibility;
- lock/downtime behavior;
- data volume;
- index build cost;
- backfill strategy;
- partial failure/retry;
- rollback/roll-forward strategy;
- application version ordering;
- backup/restore requirements;
- post-migration verification.

Agents MUST NOT silently convert a safe additive migration into a destructive one simply to resolve a development mismatch.

## 7. Destructive commands

Commands capable of deleting repository/user/system state must be scoped and justified.

Examples include:

```text
rm -rf
DROP DATABASE
TRUNCATE
terraform destroy
kubectl delete
cloud resource deletion
force-push
reset --hard
clean commands that remove untracked work
```

Before destructive operations, the executor must distinguish:

- generated/disposable state;
- agent-created temporary state;
- user work;
- repository state that may contain uncommitted changes;
- shared environment resources.

Never destroy user or other-agent work merely to obtain a clean state.

## 8. Git safety

An agent MUST NOT:

- discard unrelated modifications to make `git status` clean;
- force-push shared branches without explicit policy;
- rewrite published history merely for cosmetic cleanliness;
- delete branches/worktrees before checking for unique work;
- hide failed changes by resetting rather than reconciling them.

If unrelated work exists, preserve it and constrain the current commit to owned changes where possible.

## 9. Dependency and supply-chain changes

Adding/upgrading dependencies may change security, licensing, bundle size, runtime compatibility and build reproducibility.

Agents SHOULD:

- prefer existing dependencies when adequate;
- verify the package/module identity and source;
- avoid unmaintained/unknown packages for trivial helpers;
- update lockfiles intentionally;
- run relevant vulnerability/license checks where required;
- avoid broad dependency upgrades unrelated to the task;
- treat install scripts and binary downloads as code execution.

A failing task is not justification for replacing major framework versions without scope authority.

## 10. Authentication and security controls

Agents MUST NOT disable or bypass controls solely to make tests or development easier, including:

- authentication;
- authorization;
- CSRF/origin protections;
- TLS validation;
- signature verification;
- rate limiting where security-relevant;
- audit logging;
- encryption;
- tenant isolation;
- sandbox boundaries.

Test-specific substitutes must be explicit, bounded to non-production environments and unable to leak into production configuration unnoticed.

## 11. Payments and financial systems

Use sandbox/test mode by default.

Real financial actions require explicit authorization and a launch/operations contract. This includes:

- charges;
- captures;
- refunds;
- transfers;
- payout changes;
- invoice issuance with legal effect;
- wallet/ledger corrections.

Ledger/database edits must not be used as a shortcut around the system's financial invariants.

## 12. Communications

Email, SMS, WhatsApp, push notifications and similar channels can create irreversible user-visible effects.

Development/testing should use:

- sandbox providers;
- fake transports;
- allowlisted recipients;
- local capture tools;
- provider test numbers/accounts.

Bulk or production sends require explicit authorization, audience validation and duplicate-send protection.

## 13. Webhooks and third-party actions

When testing outbound integrations:

- prefer provider sandbox endpoints;
- protect against repeated execution;
- record idempotency keys where applicable;
- avoid triggering real downstream workflows;
- distinguish replay testing from live event publication.

When accepting inbound webhooks, do not weaken signature/security validation for production to satisfy a local test.

## 14. AI/ML-specific boundaries

If the product itself uses AI/ML:

- do not send private production data to an external model unless the approved architecture permits it;
- use documented model/provider/data-retention policy;
- preserve deterministic fallback for critical workflows where required;
- test prompt/tool boundaries against injection and unauthorized actions;
- separate model suggestions from privileged actions;
- require application-level authorization for tool calls, not model confidence.

## 15. Infrastructure changes

Infrastructure-as-code changes are code changes; applying them to shared/live environments is an environment action.

Before apply, verify as applicable:

- plan/diff;
- target account/project/region;
- resource ownership;
- destructive replacements;
- secrets exposure;
- downtime;
- cost impact;
- rollback/recovery;
- concurrency/locking.

## 16. Environment identity

Before any potentially material environment action, the agent should positively identify the target rather than infer it from directory name or shell history.

Useful evidence includes:

- cloud account/project ID;
- cluster/context;
- database host/name;
- deployment environment variable;
- provider mode (`test` vs `live`).

Ambiguous target identity is a blocker for destructive or externally visible actions.

## 17. Stop conditions

The agent must stop implementation/action and classify a blocker when:

- required authority is absent;
- the target environment cannot be confidently identified;
- production credentials appear unexpectedly in a local/test workflow;
- a destructive command would touch unverified user/shared state;
- a migration can cause data loss without an approved strategy;
- a task requires weakening a security invariant not authorized by specification;
- a real payment/message/publication would be triggered unintentionally;
- required backup/restore/rollback controls are missing for the planned risk.

Stopping here is correct execution, not failure.

## 18. Evidence without dangerous side effects

Where production action is not authorized, verification can still prove readiness through:

- unit/integration tests;
- staging deployment;
- migration dry-run;
- infrastructure plan;
- sandbox provider response;
- signed/build artifact checks;
- configuration validation;
- synthetic smoke tests;
- restore drills in non-production environments.

Evidence must be labeled accurately. A staging pass is not a production pass.

## 19. Emergency operations

An incident/hotfix may require elevated actions. The project may use an emergency policy that compresses normal approval/sequence, but it should preserve:

- who/what authorized the action;
- exact target/environment;
- exact change/command;
- before/after evidence;
- rollback or recovery action;
- post-incident tests;
- after-the-fact TODO and documentation reconciliation.

Emergency does not mean untraceable.

## 20. Conformance summary

A safe AI execution system makes it impossible to confuse "I can technically do this" with "this task authorizes me to do this."

The governing sequence is:

```text
Task scope
  -> repository authority
  -> environment authority
  -> side-effect authorization
  -> bounded action
  -> evidence
```

When any link is missing, the action must be narrowed, simulated, moved to a safer environment or blocked until the required authority exists.