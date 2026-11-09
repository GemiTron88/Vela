---
name: component-system
description: Govern reusable product-specific UI component contracts and prevent raw primitive bypass.
---

# Skill — Reusable Component System

1. Inspect and discover component coverage via `executionkit product components .` and `executionkit guard ux .`.
2. Extend existing canonical components in `executionkit.components.json` before creating new ones; forbid raw primitive bypass when a governed component covers the pattern.
3. Ensure every reusable component handles `loading`, `empty`, `error`, `disabled`, and `success` states with accessible ARIA/semantics, keyboard navigation, and RTL/LTR layout support.
