# Documentation & Knowledge Fabric Contract

**Authority:** Executable capability under **Docs OS** (supported by Repository Intelligence and bound at Content / State / Audit / Test / Launch boundaries). Never owns canonical task state.

## Runtime contract

Documentation is executable project state, not a passive template:

1. Build from live repository evidence through the native safe source pack and deep engineering knowledge (`executionkit docs refresh|build|validate|search .`).
2. Publish generated project knowledge only inside the configured generated namespace (`docs/knowledge/`).
3. Never overwrite a manually maintained document that lacks the generated ownership marker.
4. Every generated document has a stable ID, source references and content fingerprint.
5. The registry records the exact repository baseline, knowledge fingerprint, required-document denominator (24 canonical documents) and coverage.
6. Validation recomputes expected docs from live source and fails on missing, stale or unsafe documents or incomplete required coverage.
7. Live source/runtime evidence wins every conflict.
8. Generated docs never own canonical TODO state, acceptance, production state or security truth.
9. Material implementation changes require documentation refresh before release when `documentation.requiredForRelease=true`.
10. Agent OS routes documentation tasks to `skill.documentation-fabric`; file presence alone is not integration.
11. Audit/Test challenge coverage and currentness; Launch blocks release on stale docs without generating implementation truth.

## Required knowledge base (24-document denominator)

Overview, architecture, component catalogue, domains, feature catalogue, business rules/constraints, workflows, events/queues/jobs/background processing, interfaces/APIs, data/persistence, authentication/roles/permissions, dependencies/integrations, configuration/environment, storage/files, search/cache, notifications/messaging, payments/billing/money, security boundaries, testing, deployment architecture, operations/runtime, architecture decisions, known limitations/compatibility and glossary.
