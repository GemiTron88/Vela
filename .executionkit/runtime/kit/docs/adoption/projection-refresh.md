# Native task projection refresh contract

Projects that preserve a native canonical task authority and expose it through `taskModel.adapter = projection-json` may configure `taskModel.projectionCommand`.

When configured, the command is part of the authoritative read path: ExecutionKit refreshes the projection in the project root before loading projected tasks. A non-zero exit, spawn error, timeout, or missing/invalid refreshed projection fails closed. The projection remains derived state; it never owns task status and never replaces the native TODO authority.

Projects without `projectionCommand` retain compatibility behavior: the existing projection may be loaded only when its declared source hashes match; stale projections fail closed and must be regenerated explicitly.

Projection generators must be deterministic, non-destructive to the native task authority, and cross-platform for every supported project host OS.
