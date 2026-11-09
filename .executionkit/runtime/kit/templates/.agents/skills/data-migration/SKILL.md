---
name: data-migration
description: Guard database schema truth, migration rollback safety, and financial/monetary invariants.
---

# Skill — Database Truth, Migrations & Money Integrity

1. Always query compiled schema truth before writing queries or migrations: `executionkit db status .`, `executionkit db table <name> .`, `executionkit db column <table>.<col> .`, `executionkit db model <Model> .`.
2. Run `executionkit db guard .` and `executionkit audit data-safety .` after schema or model changes.
3. Ensure migrations are reversible/safe for production data and never drop or repurpose populated columns without an explicit data migration path.
4. For pricing, wallet, payment, tax, discount, and refund flows, use exact integer minor units or `DECIMAL`, idempotent transaction keys, and atomic ledger writes (never floating-point math).
