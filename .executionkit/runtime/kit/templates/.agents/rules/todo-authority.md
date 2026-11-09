# Rule — TODO Authority

`TODO.md` or the explicitly configured preserved native task authority is the single mutable authority for remaining executable work and active task state.

`.agents` MAY define routing, expertise, constraints, workflows, contracts and reusable templates. `.executionkit/runtime`, `.executionkit/state`, State OS data, reports, audits and handoffs MAY record derived observations or evidence references. None of them may become task authority.

They MUST NOT:

- own task status;
- maintain an implementation queue or shadow backlog;
- introduce executable checklist items not mapped to canonical TODO IDs;
- mirror task state as a writable authority;
- mark work complete independently of TODO/evidence;
- use a State OS snapshot, runtime checkpoint or recalled memory to bypass dependencies, review, audit, test or launch gates.

State OS may record the task/action it **observed**, plus repository fingerprints, working paths, evidence references and a next-safe-action hint. Before acting on that observation, rehydrate against current live repository and canonical task truth. Live truth wins every conflict.

Derived Agent/Runtime/State output is disposable/recomputable navigation only.
