# Visual OS Capability — v4

**Status:** CANONICAL capability guidance.
**Mandatory:** Yes (for UI/Frontend projects)
**Purpose:** Enforce responsive behavior, design token authority, canonical component catalogs, complete UI states, accessibility semantics, and premium UI/UX authority through independent rendered review.

## Premium UI/UX Authority

Visual OS safeguards the frontend product experience against generic AI scaffolding. It mechanically maps surfaces across frameworks (Blade, Tailwind, Alpine, Flutter, Web Components) to ensure that custom UI uses reusable, canonical product components rather than raw primitives. It governs design conformance independently from basic execution or general source audits.

## Key responsibilities

Visual OS covers:
- Discovering visual UI surfaces across multiple supported stacks
- Enforcing canonical component catalog usage over repetitive raw primitives
- Identifying suspicious layout signals (e.g., generic AI card layouts) and responsive token usage
- Requiring rendered, context-aware visual review for premium design verification
- Mandating complete UI states, real data shaping, and accessibility semantics
- Intercepting poor UI construction before it enters the main branch or phase closure

## CLI Surface

```bash
executionkit visual status
executionkit visual validate
```

## Trigger / cadence

- **Trigger**: `ui-surface-impact`
- **Cadence**: At component-system changes, UI creation boundaries, and formal wave/phase audit gates.

## What it does NOT own

- End-to-end integration test execution (owned by Test OS).
- Overall system security, SEO auditing, or mechanical backend correctness (owned by Audit OS).
- Task status, implementation sequencing, or source task scheduling (owned by Execution OS).

## Evidence / contracts

- Produces: Visual conformance reports, component replacement mandates, generic-risk signals
- Reads: HTML, Blade, CSS, JS frameworks, Vue, Flutter, design tokens, and frontend component catalogs
