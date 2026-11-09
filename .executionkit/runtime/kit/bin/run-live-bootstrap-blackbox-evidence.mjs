#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root=path.resolve(process.argv[2]??'.');
const report=path.join(root,'.executionkit','reports','live-bootstrap-blackbox.tap');
const tests=[
  'tests/live-bootstrap-export.test.mjs',
  'tests/local-bootstrap-docs.test.mjs',
  'tests/operator-entry-contract.test.mjs',
].map((rel)=>path.join(root,rel));
for(const file of tests) if(!fs.existsSync(file)){ console.error(`Live-bootstrap black-box producer missing ${path.relative(root,file)}`); process.exit(1); }
fs.mkdirSync(path.dirname(report),{recursive:true});
const result=spawnSync(process.execPath,['--test','--test-reporter=tap',...tests],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024,windowsHide:true});
fs.writeFileSync(report,result.stdout??'');
if(result.stdout) process.stdout.write(result.stdout);
if(result.stderr) process.stderr.write(result.stderr);
if(result.error){ console.error(result.error.message); process.exit(1); }
const scenarioReport=path.join(root,".executionkit/reports/live-bootstrap-blackbox.scenarios.json");
const scenarioPass=!result.error&&result.status===0;
const output=result.stdout??'';
const scenarioStatuses={
  "official-main-resolution":scenarioPass&&["exported project bootstrap resolves official GitHub main at runtime without a static source pin"].every((marker)=>output.includes(marker))?'PASS':'FAIL',
  "override-rejection":scenarioPass&&["bootstrap exporter rejects repository, ref, commit and source customization flags"].every((marker)=>output.includes(marker))?'PASS':'FAIL',
  "project-local-source-self-heal-guard":scenarioPass&&["local bootstrap validation rejects loss of project-local source self-healing"].every((marker)=>output.includes(marker))?'PASS':'FAIL',
  "live-host-contract-preserved":scenarioPass&&["published distribution keeps live-verification local bootstrap documentation coherent"].every((marker)=>output.includes(marker))?'PASS':'FAIL'
};
fs.writeFileSync(scenarioReport,JSON.stringify({
  schemaVersion:'1.0.0',
  producer:"live-bootstrap-blackbox",
  candidateId:process.env.EXECUTIONKIT_CANDIDATE_ID??null,
  generatedAt:new Date().toISOString(),
  journeys:{"J-V34-GITHUB-LIVE-BOOTSTRAP":scenarioStatuses}
},null,2)+'\n');
process.exit(result.status ?? 1);
