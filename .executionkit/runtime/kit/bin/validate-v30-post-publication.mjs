#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] || path.join(here, '..'));
const errors = [];
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const requireMarkers = (rel, markers, label = rel) => {
  const content = read(rel);
  for (const marker of markers) if (!content.includes(marker)) errors.push(`${label} missing post-publication guard: ${marker}`);
};

requireMarkers('lib/executionkit-agent-v3.mjs', [
  'MAX_ACK_BYTES = 64 * 1024',
  'boundedTransportBatch',
  'readAckBody(response, controller)',
  'compatibility.upgradeRequired === true',
  'existing?.sessionId === this.sessionId',
  'stateSnapshotFresh(snapshot)',
  "'bounded-http-exchange'",
  "'state-os.freshness-guard'",
]);
requireMarkers('tests/v30-agent.test.mjs', [
  'single-instance lock rejects a second runtime even when it shares the same PID',
  'State RUNNING snapshot activates execution only while the snapshot is fresh',
  'one project observation failure is isolated and does not abort the device cycle',
]);
requireMarkers('tests/v30-protocol.test.mjs', [
  '2.0-only ACK compatibility cannot acknowledge or delete protocol v1 spool',
  'upgradeRequired ACK cannot acknowledge or delete spool even when the range includes v1',
  'complete HTTP exchange timeout includes delayed ACK body and retains spool',
  'oversized ACK body is rejected before spool acknowledgement',
  'serialized request envelope stays inside maxBatchBytes without dropping queued events',
]);

const cliPath = path.join(root, 'bin', 'executionkit-agent.mjs');
if (process.platform !== 'win32' && (fs.statSync(cliPath).mode & 0o111) === 0) errors.push('bin/executionkit-agent.mjs must remain executable on POSIX distributions');

const todo = read('TODO.md');
for (const id of ['EK3-010', 'EK3-011', 'EK3-012', 'EK3-013']) if (!todo.includes(`TASK:${id}`)) errors.push(`canonical TODO missing live-audit task ${id}`);

console.log(JSON.stringify({ schemaVersion:'executionkit-v30-post-publication/v1', status:errors.length ? 'FAIL' : 'PASS', errors }, null, 2));
process.exit(errors.length ? 1 : 0);
