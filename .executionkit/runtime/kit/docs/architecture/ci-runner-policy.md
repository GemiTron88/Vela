# CI Runner Policy

**Status:** CANONICAL / NORMATIVE  
**Applies to:** Test OS, ExecutionKit integrity workflows, and project CI orchestration  
**Default orchestrator:** GitHub Actions  

## 1. Principle

Test OS owns **execution strategy, adequacy, reproducibility and freshness of test/check evidence**. Domain authorities still own their specialized acceptance criteria and gates: for example, SEO OS owns search architecture/indexability criteria and S0–S5 SEO gates, while Launch OS owns release/deployment authorization. CI is only an execution/orchestration lane for the applicable checks; it does not absorb those authorities.

A conforming project MUST NOT depend on GitHub-hosted runner minutes for its normal CI/test execution. The default execution topology is manually dispatched, project-isolated, self-hosted runners.

## 2. Default runner topology

A project MAY execute on macOS, Windows, or both.

The same project MAY therefore have, for example:

```text
Project X
├── Mac device A     -> one Project X runner
└── Windows device B -> one Project X runner
```

The governing invariant is physical-device scoped:

> **For a given project, a physical device MUST NOT register or operate more than one runner for that project.**

This rule does **not** limit the total number of devices a project may use. If a project legitimately runs on multiple physical machines, each machine may host one runner for that project.

This rule also does **not** prevent one physical device from hosting runners for different projects:

```text
Mac device A
├── project-waafi runner
├── project-da7y runner
└── project-nouraltelawa runner
```

Each is a distinct project registration and MUST remain label-isolated.

## 3. Runner identity and labels

Every project MUST define one stable project runner label, normally:

```text
project-<project-slug>
```

Examples:

```text
project-waafi
project-da7y
project-nouraltelawa
```

A runner for that project MUST carry:

- `self-hosted`;
- the project-specific runner label;
- GitHub's default operating-system label: `macOS` on a Mac runner or `windows` on a Windows runner;
- the normal architecture label GitHub assigns or the project explicitly requires.

Runner names SHOULD make the physical device distinguishable without committing serial numbers or secrets, for example:

```text
nouraltelawa-macbook
nouraltelawa-windows-desktop
```

## 4. Trigger policy

Project CI/Test OS workflows MUST be **manual by default**.

The canonical GitHub Actions trigger is:

```yaml
on:
  workflow_dispatch:
```

A project MUST NOT enable CI/test autorun on every `push`. Push autorun is prohibited by the default ExecutionKit CI policy and is not eligible for the ordinary automatic-workflow exception mechanism.

Other automatic triggers such as `pull_request`, `schedule`, `workflow_run`, or `pull_request_target` are non-default. They MAY exist only after an explicit project-level decision and MUST be listed by workflow path in:

```json
{
  "ci": {
    "allowedAutomaticWorkflowPaths": [
      ".github/workflows/explicitly-approved-workflow.yml"
    ]
  }
}
```

The exception is path-scoped so one approved scheduled/PR workflow does not silently authorize every workflow to autorun. The approved workflow must still satisfy the self-hosted/project-label policy unless a separately documented stronger exception applies.

There is no automatic fallback from an unavailable self-hosted runner to a GitHub-hosted runner. If the required project runner is offline/unavailable, the CI execution is `BLOCKED` or `NOT_RUN` according to the applicable Test/Launch/domain-gate semantics.

## 5. GitHub-hosted runners

The default policy forbids normal project jobs from using GitHub-hosted labels such as:

```text
ubuntu-latest
windows-latest
macos-latest
```

or equivalent hosted pools.

A project MUST NOT silently consume GitHub-hosted CI minutes as a fallback.

If a future project has an exceptional reason to use a hosted runner, that exception MUST be explicit, narrowly scoped, documented, and approved in the project's Test/operations authority rather than inherited from a starter workflow. The default validator intentionally rejects `*-latest` hosted labels; a hosted exception therefore requires a deliberate project-specific validator/policy override rather than a hidden config shortcut.

## 6. Test cadence under this policy

`PHASE_BOUNDARY_FULL_CI` is the portfolio-default cadence. The absence of push-triggered CI does not weaken testing requirements, but the complete expensive suite is intentionally separated from task-targeted verification.

Required execution model:

1. **During task implementation:** run the narrow/targeted checks locally on the active Mac or Windows workstation, including applicable domain checks such as SEO contract validation for changed search surfaces.
2. **Task verification:** run the smallest sufficient local/native unit, feature, widget, static, integration, schema, browser, SEO or other task-specific checks and record evidence. Test OS owns evidence execution/adequacy; the owning domain authority interprets its specialized criteria. Do **not** dispatch the complete self-hosted CI suite merely because a task/commit completed.
3. **Independent acceptance:** when required, route the current implementation candidate to an independent reviewer and promote to `ACCEPTED` only when the task contract and task-targeted evidence pass. Legacy `VERIFIED` may be used only as an explicitly configured alias to `ACCEPTED`.
4. **Phase audit/remediation:** complete the applicable phase/domain audits — including SEO S2 where applicable — and map/fix executable remediation before creating the phase CI candidate.
5. **Phase gate:** manually dispatch the **complete applicable self-hosted CI suite once on the corrected phase candidate**. This is the normal portfolio full-suite cadence.
6. **Release candidate:** Launch OS MAY require another explicit exact-candidate full verification matrix when release evidence differs from the last phase candidate. Applicable SEO S3 remains owned by SEO OS and candidate-bound; CI/Test executes the required evidence but cannot waive or redefine the gate. This does not authorize per-task full CI.
7. **Launch:** execute release-specific smoke/health checks under Launch OS authority. Applicable SEO S4 follows real post-deployment production verification; S5 remains ongoing operational observation.

A task cannot claim `ACCEPTED` merely because full CI is deferred to phase end. Required targeted tests/review remain required. Conversely, ordinary task completion, commit or push MUST NOT automatically trigger full CI under the default policy.

A missing/unavailable runner or tool never converts a required check into PASS. When required exact-candidate execution cannot run, preserve `NOT_RUN`/`BLOCKED` according to canonical task/gate semantics.

## 7. Multi-OS projects

When both Mac and Windows runners exist for the same project, workflows SHOULD choose the OS explicitly rather than dispatching duplicate jobs to both by default.

A typical manual workflow exposes an input using the actual GitHub runner labels:

```text
runner_os = macOS | windows
```

Cross-platform matrix testing is run only when the phase/release contract requires both platforms.

Evidence MUST identify which OS/device class actually executed the check. A PASS on macOS MUST NOT be silently treated as Windows evidence, or vice versa, when platform-specific behavior matters.

## 8. Runner inventory

Test OS SHOULD maintain a small non-secret runner inventory containing only operational aliases:

| Device alias | OS | Runner name | Project label | Status/notes |
| --- | --- | --- | --- | --- |
| `mac-main` | macOS | `project-mac-main` | `project-example` | registered |
| `win-main` | Windows | `project-win-main` | `project-example` | registered |

Do not record registration tokens, machine secrets, hardware serial numbers, private IPs, passwords, or credentials in repository files.

The inventory is operational metadata, not a backlog or proof that a runner is currently online.

## 9. Adoption and migration

When adding ExecutionKit to an existing project, the adopting agent MUST inspect existing CI workflows and runner assumptions.

It MUST reconcile default GitHub-hosted or push-triggered behavior with this policy without weakening the project's actual test requirements or domain-owned gates such as candidate-bound SEO S3.

A healthy native self-hosted CI system MAY be preserved if it already satisfies or exceeds these rules.

Changing CI topology MUST NOT mark product tasks complete, manufacture test evidence, or move domain/release authority into CI configuration.

## 10. Validation boundary

Repository tooling can validate workflow/config structure, including hosted-runner labels, automatic triggers and explicit non-push trigger exceptions.

It cannot prove how many runner registrations actually exist on a physical machine unless runner-management access is available. Therefore the **one project runner per physical device** invariant is partly operational and MUST be checked during runner setup/adoption/reconciliation.

Likewise, a workflow file existing in git does not prove a run occurred. Release/domain evidence must identify the exact executed run/candidate/environment where evidence is required. No workflow, Lighthouse category score or generic test PASS guarantees SEO indexing, rankings, rich results, traffic or search-engine behavior.