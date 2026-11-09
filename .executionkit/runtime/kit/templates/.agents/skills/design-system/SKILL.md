---
name: design-system
description: Align brand tokens, typography, color palettes, and contrast across web and Flutter surfaces.
---

# Skill — Design System & Token Authority

1. Enforce a single token authority (`executionkit.design.json`, CSS custom properties / Tailwind theme / Flutter `ThemeExtension`) across all surfaces.
2. Run `executionkit guard ux .` and `executionkit visual validate .` to detect uncontrolled hex/pixel literals, contrast failures, and token drift.
3. Verify light/dark palette parity, fluid typography scales, 4px/8px spatial rhythm, and focus-ring visibility on every interactive element.
