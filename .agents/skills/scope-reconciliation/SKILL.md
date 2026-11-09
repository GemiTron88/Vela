---
name: scope-reconciliation
description: Discover implemented routes, screens, components, and services and reconcile scope gaps.
---

# Skill — Product Discovery & Scope Reconciliation

1. Discover live product surfaces (routes, controllers, screens, components, models, content, and tests) with `executionkit product discover .` and `executionkit product components .`.
2. Reconcile discovered surfaces against `executionkit.scope.json` and canonical `TODO.md` using `executionkit product status .` and `executionkit product reconcile .`.
3. Never hide unimplemented scope by weakening `executionkit.scope.json`; either implement the missing surface or record an explicit owner-approved scope change.
