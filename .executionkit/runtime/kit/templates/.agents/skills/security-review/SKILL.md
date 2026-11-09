---
name: security-review
description: Verify authentication, authorization boundaries, tenant isolation, and secret safety.
---

# Skill — Security & Authorization Boundaries

1. Run `executionkit audit security .` to inspect secrets exposure, injection vectors, unsafe deserialization, CSRF/CORS, and dependency vulnerabilities.
2. Verify authentication, policy/gate enforcement, role/permission checks, and multi-tenant ownership boundaries across every mutating route, controller, Livewire action, job, and export.
3. Ensure sensitive credentials live only in environment configuration outside tracked source and generated docs.
