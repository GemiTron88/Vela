import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// An oracle reads fresh state independently of the agent. The caller supplies
// real assertions, not a boolean or a prewritten PASS receipt.
export async function verifyPostcondition({ journeyId, id, kind, assertion }, read, check) {
  if (!/^[A-Z0-9][A-Z0-9._-]+$/.test(journeyId ?? '') || !/^[a-zA-Z0-9._-]+$/.test(id) || !['backend', 'ui'].includes(kind) || !assertion?.trim()) throw new Error('Invalid journey postcondition');
  if (typeof read !== 'function' || typeof check !== 'function') throw new Error('Postconditions require a live read and deterministic assertion');
  const runId = process.env.EXECUTIONKIT_E2E_RUN_ID;
  const proofRoot = process.env.EXECUTIONKIT_E2E_POSTCONDITION_DIR;
  if (!runId || !proofRoot || !path.isAbsolute(proofRoot)) throw new Error('Run postconditions through executionkit test journeys');
  const startedAt = new Date().toISOString();
  let failure = null, value;
  try { value = await read(); if (value === undefined) throw new Error('Postcondition reader returned no observable state'); if (await check(value) === false) throw new Error('Postcondition assertion returned false'); } catch (error) { failure = error; }
  const proof = {
    schemaVersion: 'executionkit-agentic-postcondition/v1', runId, journeyId, id, kind,
    assertion, startedAt, completedAt: new Date().toISOString(),
    status: failure ? 'FAIL' : 'PASS',
    // Do not store account data or secrets; retain a digest of the observed state.
    observedDigest: crypto.createHash('sha256').update(JSON.stringify(value) ?? 'undefined').digest('hex'),
  };
  const name = `postcondition-${id}.json`;
  const dir = path.join(proofRoot, journeyId); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
  if (failure) throw failure;
  return value;
}

// Use the public ArtifactStore seam to capture bytes at registration time.
// A replay/engine cleanup may rewrite its original trace later; never rehash
// that changed file and present it as the original evidence.
export function createEvidenceStore() {
  return { async put(artifact) {
    const runId=process.env.EXECUTIONKIT_E2E_RUN_ID, proofRoot=process.env.EXECUTIONKIT_E2E_POSTCONDITION_DIR;
    if(!runId||!proofRoot||!path.isAbsolute(proofRoot))throw new Error('Evidence snapshots require the Kit-owned run');
    if(!['complete','not-required'].includes(artifact.redaction))throw new Error('Refuse to snapshot unredacted evidence');
    const hash=crypto.createHash('sha256').update(artifact.bytes).digest('hex');
    if(hash!==artifact.sha256)throw new Error('Producer bytes differ from registered evidence hash');
    const dir=path.join(path.dirname(proofRoot),'snapshots');fs.mkdirSync(dir,{recursive:true});
    const file=path.join(dir,hash);
    try{fs.writeFileSync(file,artifact.bytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST'||crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==hash)throw error;}
    return {ref:`executionkit-snapshot:${runId}:${hash}`};
  }};
}
