---
name: documentation-fabric
description: Build, validate, and search the 24-document source-grounded Docs OS knowledge base.
---

# Skill — Documentation Fabric (Docs OS)

1. Inspect documentation freshness and coverage via `executionkit docs status .`.
2. Rebuild and validate the 24-document generated knowledge base from live repository truth using `executionkit docs refresh .` (or `executionkit docs build .` and `executionkit docs validate .`).
3. Search generated docs with `executionkit docs search . --query <q>`.
4. Generated docs derive strictly from live code, schemas, routes, and contracts; never store mutable task status or secrets in documentation.
