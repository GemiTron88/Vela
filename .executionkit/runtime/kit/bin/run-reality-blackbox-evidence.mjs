#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] ?? '.');
const here = path.dirname(fileURLToPath(import.meta.url));
const report = path.join(root, '.executionkit', 'reports', 'reality-blackbox.tap');
const tests = [
  'tests/integration-reality.test.mjs',
  'tests/revalidation.test.mjs',
  'tests/release-readiness.test.mjs',
  'tests/execution-model.test.mjs',
].map((rel) => path.join(root, rel));

for (const file of tests) {
  if (!fs.existsSync(file)) {
    console.error(`Reality black-box producer missing required regression: ${path.relative(root,file)}`);
    process.exit(1);
  }
}
fs.mkdirSync(path.dirname(report), { recursive:true });
const result = spawnSync(process.execPath, ['--test','--test-reporter=tap',...tests], {
  cwd: root,
  encoding:'utf8',
  maxBuffer:32*1024*1024,
  env:{...process.env},
  windowsHide:true,
});
fs.writeFileSync(report, result.stdout ?? '');
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) {
  console.error(`Reality black-box evidence producer failed: ${result.error.message}`);
  process.exit(1);
}
const scenarioReport=path.join(root,".executionkit/reports/reality-blackbox.scenarios.json");
const scenarioPass=!result.error&&result.status===0;
const output=result.stdout??'';
const scenarioStatuses={
  "false-closure-rejection":scenarioPass&&["system release gate must converge the complete active denominator"].every((marker)=>output.includes(marker))?'PASS':'FAIL',
  "journey-convergence":scenarioPass&&["critical journey gate rejects a member task outside its dependency closure"].every((marker)=>output.includes(marker))?'PASS':'FAIL',
  "stale-evidence-revalidation":scenarioPass&&["changed accepted contract requires revalidation and impacts its critical journey"].every((marker)=>output.includes(marker))?'PASS':'FAIL',
  "release-fail-closed":scenarioPass&&["strict production release rejects closure without candidate, trusted producers, test adequacy and critical journeys"].every((marker)=>output.includes(marker))?'PASS':'FAIL'
};
fs.writeFileSync(scenarioReport,JSON.stringify({
  schemaVersion:'1.0.0',
  producer:"reality-blackbox",
  candidateId:process.env.EXECUTIONKIT_CANDIDATE_ID??null,
  generatedAt:new Date().toISOString(),
  journeys:{"J-V35-REALITY-CLOSURE":scenarioStatuses}
},null,2)+'\n');
process.exit(result.status ?? 1);
