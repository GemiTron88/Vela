---
name: premium-experience
description: Construct and certify premium web/Flutter/desktop UI, media production, and accessibility.
---

# Skill — Premium Experience, Visual OS & Accessibility

## Core Invariants
- Premium Experience is a mandatory cross-cutting construction invariant for UI-bearing products, **not a ninth OS**.
- **Extend before create**: reuse and compose governed components and design tokens before introducing new primitives.
- Use **production-shaped** data and perform **anti-generic** review so interfaces never ship with AI boilerplate or placeholder chrome.
- Follow the mandatory rendered loop: **Render -> inspect -> correct -> re-render** (`Discover -> Design Direction -> Implement/Refine -> Capture -> Critique -> Remediate -> Re-capture -> Independent Certification`) across light/dark themes, mobile/desktop viewports, LTR/RTL directions, keyboard/touch/screen-reader input modes, and **safe areas**.
- Establish a product-specific **5-part Design Direction** (`Product`, `Character`, `World`, `Moments`, `Signature`), select the warranted intervention level (`No Change`, `Light Polish`, `Full Refinement`), and apply the **9 conceptual refinement passes** (`Spacing -> Color -> Icons -> Copy -> Typography -> Layout -> Details -> Visuals -> Motion`) via `skill.design-refinement`.
- Independent visual certification: the **reviewer must differ** from the implementer on UI-bearing acceptance.

## Verification Commands
1. Run changed-file and surface guards: `executionkit guard ux .`, `executionkit guard assets .`, `executionkit guard visuals .`, `executionkit guard perf .`, and `executionkit guard flutter .` (when applicable).
2. Plan and verify visual media roles (`hero`, `banner`, `background`, `illustration`, `icon`, `empty`, `dynamic`) with `executionkit visual media-plan . --offset=0 --limit=50` and `executionkit visual media-check .`.
3. Execute rendered inspection and certification via `executionkit visual inspect .`, `executionkit visual certify .`, and `executionkit visual boundary .`.
