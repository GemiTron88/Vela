#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root=path.resolve(process.argv[2]??'.');
const report=path.join(root,'.executionkit','reports','parallel-blackbox.tap');
const tests=[
  'tests/parallel-agent-os.test.mjs',
  'tests/v22-policy.test.mjs',
  'tests/v22-runtime.test.mjs',
  'tests/v22-operational-truth.test.mjs',
  'tests/migration.test.mjs',
  'tests/adopt-project.test.mjs',
].map((rel)=>path.join(root,rel));
for(const file of tests) if(!fs.existsSync(file)){ console.error(`Parallel black-box producer missing ${path.relative(root,file)}`); process.exit(1); }
fs.mkdirSync(path.dirname(report),{recursive:true});
const result=spawnSync(process.execPath,['--test','--test-reporter=tap',...tests],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024,windowsHide:true});
fs.writeFileSync(report,result.stdout??'');
if(result.stdout) process.stdout.write(result.stdout);
if(result.stderr) process.stderr.write(result.stderr);
if(result.error){ console.error(result.error.message); process.exit(1); }
const scenarioReport=path.join(root,".executionkit/reports/parallel-blackbox.scenarios.json");
const scenarioPass=!result.error&&result.status===0;
const output=result.stdout??'';
const scenarioStatuses={
  "safe-parallel-batch":scenarioPass&&["independent dependency-ready tasks form a bounded canonical batch"].every((marker)=>output.includes(marker))?'PASS':'FAIL',
  "forced-sequential-fallback":scenarioPass&&["overlapping ownership and coordination hotspots force sequential fallback"].every((marker)=>output.includes(marker))?'PASS':'FAIL',
  "boost-quality-preserved":scenarioPass&&["boost raises only the safe batch cap","current policy rejects boost that weakens quality gates"].every((marker)=>output.includes(marker))?'PASS':'FAIL',
  "v3-fleet-migration":scenarioPass&&["fleet upgrade plan routes v3 repair through migrate-current rather than the v2 migrator"].every((marker)=>output.includes(marker))?'PASS':'FAIL'
};
fs.writeFileSync(scenarioReport,JSON.stringify({
  schemaVersion:'1.0.0',
  producer:"parallel-blackbox",
  candidateId:process.env.EXECUTIONKIT_CANDIDATE_ID??null,
  generatedAt:new Date().toISOString(),
  journeys:{"J-V33-PARALLEL-AGENT-OS":scenarioStatuses}
},null,2)+'\n');
process.exit(result.status ?? 1);
