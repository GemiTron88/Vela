---
name: laravel
description: Implement and verify Laravel backend routes, controllers, Eloquent models, jobs, and policies.
---

# Skill — Laravel Backend Engineering

1. Inspect live schema and route truth before coding: `executionkit db status|table|column|model .` and `executionkit route status|guard|probe .`.
2. Enforce FormRequest validation, Policy/Gate authorization, eager-loading (preventing N+1 queries), queue job idempotency, and database transactions on multi-write operations.
3. Verify with targeted tests (`php artisan test --filter <TestName>` or `executionkit test task . --target <file>`) and guards (`executionkit db guard .`, `executionkit route guard .`, `executionkit guard forms|lang|antifake .`).
