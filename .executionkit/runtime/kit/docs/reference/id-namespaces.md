# ID Namespaces

**Status:** REFERENCE with recommended conventions.

Stable IDs reduce ambiguity across tasks, findings, tests, requirements and releases.

## Recommended prefixes

| Prefix | Meaning | Example |
| --- | --- | --- |
| `EX-` | Executable task | `EX-0142` |
| `REQ-` | Requirement | `REQ-AUTH-012` |
| `TST-` | Named test contract | `TST-AUTH-031` |
| `AUD-` | Audit finding | `AUD-SEC-019` |
| `CNT-` | Content finding/requirement | `CNT-MEDS-004` |
| `REL-` | Release gate | `REL-DATA-002` |
| `DEC-` | Decision/ADR | `DEC-ARCH-005` |
| `INC-` | Incident | `INC-2026-004` |
| `BLK-` | Cross-task blocker record | `BLK-003` |

## Task IDs

Prefer identity independent of phase:

```text
EX-0142
```

rather than embedding a mutable phase:

```text
P03-T14
```

If a project already uses phase-prefixed IDs successfully, keep them immutable when tasks move; do not renumber simply for aesthetics.

## Allocation

- IDs are never reused after cancellation/deletion/archive.
- Gaps are acceptable.
- Do not renumber completed tasks to produce a tidy sequence.
- IDs should be case-consistent.

## When not to assign IDs

Do not ID every:

- assertion;
- paragraph;
- UI label;
- code symbol;
- one-off note.

Assign identity when an artifact needs durable cross-reference or lifecycle tracking.
