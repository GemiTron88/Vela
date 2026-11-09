# AI ExecutionKit Adoption Record

**Status:** CANONICAL for adoption metadata only; this file is **not** an execution backlog and MUST NOT own mutable task state.  
**Adopted ExecutionKit version:** `[VERSION]`  
**ExecutionKit baseline/ref:** `[KIT_BASELINE]`  
**Target baseline branch/SHA:** `[TARGET_BASELINE]`  
**Adoption mode:** `[NATIVE_BOOTSTRAP|NATIVE_RECONCILIATION|CONTROLLED_MIGRATION|COMPATIBILITY_ADOPTION]`  
**Profile:** `[LITE|STANDARD|FULL|CUSTOM]`

## Capability matrix

| Capability | Level | Rationale if non-default/material |
| --- | --- | --- |
| Execution | `[NONE|LITE|STANDARD|FULL]` | |
| Content | `[NONE|LITE|STANDARD|FULL]` | |
| Audit | `[NONE|LITE|STANDARD|FULL]` | |
| Test | `[NONE|LITE|STANDARD|FULL]` | |
| Launch | `[NONE|LITE|STANDARD|FULL]` | |

## Authority mapping

| Question | Authority after adoption |
| --- | --- |
| Product intent | `[approved specs/contracts]` |
| Implemented reality | `[repository/schema/config/runtime]` |
| Remaining executable work | `[TODO.md / compatible canonical entry point]` |
| Task detail | `[task/phase contracts]` |
| Verification | `[native tests + ExecutionKit/project evidence]` |
| Release authority | `[launch/release gates]` |

## Preserved native controls

- `[native task IDs/lifecycle/generator/validator/contracts/workflows/etc.]`

## Lifecycle/state adapter

`NONE` unless `COMPATIBILITY_ADOPTION` preserves local syntax.

```text
[local state] -> [ExecutionKit semantic state]
```

The mapping MUST be conservative and MUST NOT overstate `VERIFIED` or `RELEASED`.

## TODO/context strategy

- Canonical entry point: `[path]`
- Scaling/context mode: `[S0|S1|S2|compatibility resolver/custom documented mode]`
- Bounded context command/mechanism: `[command or NONE]`

## CI / Test OS runner topology

- Project runner label: `[project-<slug>]`
- Trigger policy: `manual / workflow_dispatch`
- GitHub-hosted fallback: `FORBIDDEN` unless an explicit project exception is documented
- Known runner devices:

| Device alias | OS | Runner name | Project label | State/notes |
| --- | --- | --- | --- | --- |
| `[alias]` | `[macOS|Windows]` | `[runner name]` | `[project-<slug>]` | `[registered/offline/etc.]` |

Rules:

- a physical device MUST NOT host more than one runner registration for this project;
- the same physical device MAY host separate runners for other projects;
- runner aliases MUST NOT expose secrets, registration tokens, passwords or hardware serial numbers;
- Mac/Windows are both required only when the applicable verification contract requires both;
- if physical runner-registration state cannot be inspected, record that operational check as `UNVERIFIED/BLOCKED` rather than inventing a PASS.

## Validation

### Native/project checks

```text
[commands]
```

### ExecutionKit checks

```text
node bin/validate-ci-policy.mjs .
[other commands]
```

## Baseline state truth

```text
[task counts/states/blockers before adoption]
```

## Post-adoption state truth

```text
[task counts/states/blockers after adoption]
```

Any difference MUST be explained by repository/test/evidence reconciliation rather than adoption convenience.

## Known external blockers

- `[blocker or NONE]`

## Explicit non-goals

- no net-new product features unless separately authorized;
- no unrelated redesign/refactor;
- no fabricated progress or blocker closure;
- no weakening of stronger native verification/release gates;
- no competing execution backlog;
- no hosted-runner or push-trigger CI fallback introduced for convenience.

## Adoption completion evidence

- Exact final SHA: `[SHA]`
- Native checks: `[PASS/BLOCKED + evidence]`
- CI runner policy: `[PASS/BLOCKED + evidence]`
- ExecutionKit integrity: `[PASS/BLOCKED + evidence]`
- Next legitimate READY work: `[task ID or reason none exists]`
- Reviewer/ruling: `[result if applicable]`
