# Repository Intelligence Agent Contract

Agent OS may route Repository Intelligence as supporting context only.

## Retrieval order

1. Rehydrate current execution/repository identity.
2. Measure knowledge freshness for the relevant scope.
3. Read compact context only when allowed by trust state.
4. Read relevant domain knowledge.
5. Use relationship providers for callers/dependencies/impact only when their baseline is independently current.
6. Use bounded source-pack slices or live source for exact implementation facts.

## Trust behavior

- `TRUSTED`: derived context may guide navigation.
- `VERIFY`: material claims require current source/graph cross-check.
- `DEGRADED`: hint-only.
- `SOURCE_ONLY`: do not rely on derived narrative for conclusions.
- `UNAVAILABLE`: ignore the provider/artifact.

## Authority boundary

Repository Intelligence MUST NOT mutate canonical task state or replace Execution, Agent, State, Content, SEO, Docs, Audit, Test, Launch, Visual, or Decision authority.
