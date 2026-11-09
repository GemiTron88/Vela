#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root=path.resolve(process.argv[2]??'.');
const report=path.join(root,'.executionkit','reports','installer-blackbox.tap');
const tests=[
  'tests/installer.test.mjs',
  'tests/bootstrap.test.mjs',
  'tests/adopt-project.test.mjs',
  'tests/migration.test.mjs',
  'tests/deep-integration.test.mjs',
].map((rel)=>path.join(root,rel));
for(const file of tests) if(!fs.existsSync(file)){ console.error(`Installer black-box producer missing ${path.relative(root,file)}`); process.exit(1); }
fs.mkdirSync(path.dirname(report),{recursive:true});
const result=spawnSync(process.execPath,['--test','--test-reporter=tap',...tests],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024,windowsHide:true});
fs.writeFileSync(report,result.stdout??'');
if(result.stdout) process.stdout.write(result.stdout);
if(result.stderr) process.stderr.write(result.stderr);
if(result.error){ console.error(result.error.message); process.exit(1); }
const scenarioReport=path.join(root,".executionkit/reports/installer-blackbox.scenarios.json");
const scenarioPass=!result.error&&result.status===0;
const output=result.stdout??'';
const scenarioStatuses={
  "preservation-first-install":scenarioPass&&["existing code and canonical history retain their bytes and current task semantics"].every((marker)=>output.includes(marker))?'PASS':'FAIL',
  "deep-integration-gating":scenarioPass&&["activation requires accepted integration gate and ACTIVE cannot regress behind it"].every((marker)=>output.includes(marker))?'PASS':'FAIL',
  "v3-parallel-migration":scenarioPass&&["v3 overlay preserves canonical TODO and installs only project-side fleet surfaces"].every((marker)=>output.includes(marker))?'PASS':'FAIL',
  "receipt-bound-safety":scenarioPass&&["direct v3 migration refuses receipt-bound isolated runtimes without changing canonical TODO"].every((marker)=>output.includes(marker))?'PASS':'FAIL'
};
fs.writeFileSync(scenarioReport,JSON.stringify({
  schemaVersion:'1.0.0',
  producer:"installer-blackbox",
  candidateId:process.env.EXECUTIONKIT_CANDIDATE_ID??null,
  generatedAt:new Date().toISOString(),
  journeys:{"J-V3-INSTALLER":scenarioStatuses}
},null,2)+'\n');
process.exit(result.status ?? 1);
