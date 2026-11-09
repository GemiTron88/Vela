# Rule — AI Execution Closure

A fully AI-executed project is not complete while required canonical tasks remain in any non-final lane.

Equivalent native states such as:

- open/unstarted (`[ ]`);
- partial/candidate (`[~]`);
- revalidation required (`[R]`);
- blocked (`[!]`);
- implemented-but-unaccepted;

are all non-terminal execution truth.

The scheduler MUST keep routing these states to the appropriate implementation, correction, review/revalidation or blocker-analysis lane. Final closure requires every required task to be accepted/verified/released, or explicitly cancelled under an authorized scope decision. A blocker prevents closure; it is not invisible work.

For native checkbox lifecycles, `[x]` is the normal accepted semantic state. Candidate markers MUST NOT be treated as done.
