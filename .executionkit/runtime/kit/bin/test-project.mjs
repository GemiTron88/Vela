#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { collectEvidence, loadCandidate, validateCandidate, validateCollectedEvidence } from '../lib/evidence-model.mjs';
import { loadConfig } from '../lib/execution-model.mjs';
import { loadAdapterConfig } from '../lib/adapter-registry.mjs';
import { resolveDerivedPath } from '../lib/derived-state.mjs';
import { emitSystemEvent } from '../lib/telemetry-events.mjs';
import { executeAgenticJourneys } from '../lib/agentic-e2e.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const kitRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const root=path.resolve(args.find((arg)=>!arg.startsWith('--'))??'.');
const boundaryArg=args.find((arg)=>arg.startsWith('--boundary='));
const boundary=boundaryArg?boundaryArg.slice('--boundary='.length):'release';

function runJsonScript(rel, extra=[]) {
  const result=spawnSync(process.execPath,[path.join(kitRoot,rel),root,...extra],{cwd:root,encoding:'utf8',timeout:900000,maxBuffer:32*1024*1024});
  let parsed=null;
  try { parsed=JSON.parse(String(result.stdout||'').trim()); } catch {}
  return {ok:!result.error&&result.status===0,exitCode:result.status,stdout:result.stdout??'',stderr:result.stderr??'',error:result.error?.message??null,parsed};
}
function runValidator(reportPath, config) {
  const argv=[path.join(kitRoot,'bin/validate-test-evidence.mjs'), reportPath];
  if (config.evidence?.testFormat) argv.push('--format',config.evidence.testFormat);
  if (Number(config.evidence?.minimumTests??0)>0) argv.push('--minimum',String(config.evidence.minimumTests));
  if (config.evidence?.allowSkipped===true) argv.push('--allow-skipped');
  if (config.evidence?.allowFlaky===true) argv.push('--allow-flaky');
  return spawnSync(process.execPath,argv,{cwd:root,encoding:'utf8',timeout:900000,maxBuffer:32*1024*1024});
}
function writeGate(candidate,status,details) {
  const file=resolveDerivedPath(root,'.executionkit/gates/test-release.json','test release gate',{createParents:true});
  fs.writeFileSync(file,JSON.stringify({
    schemaVersion:'executionkit-release-gate/v1',system:'test-os',boundary:'release',status,
    candidateId:candidate.candidateId,commit:candidate.commit,completedAt:new Date().toISOString(),...details
  },null,2)+'\n');
  return path.relative(root,file).split(path.sep).join('/');
}

try {
  if(boundary!=='release') throw new Error('Test OS orchestrator currently supports boundary=release; task/phase targeted testing remains owned by task contracts and configured producers.');
  await emitSystemEvent(root,'test.started',{boundary},{source:'test-os'});
  const {config,policyIssues=[]}=loadConfig(root);
  if(policyIssues.length) throw new Error(policyIssues.map((e)=>`[${e.code}] ${e.message}`).join('; '));
  if(config.capabilities?.test==='NONE') throw new Error('Test OS is disabled for this project');
  const required=config.evidence?.requiredProducers??[];
  if(!Array.isArray(required)||required.length===0) throw new Error('Release Test OS requires at least one evidence.requiredProducers entry; empty producer sets cannot prove tests.');
  if(!String(config.evidence?.testReportPath??'').trim()) throw new Error('Release Test OS requires evidence.testReportPath.');

  const candidate=loadCandidate(root);
  const checked=validateCandidate(root,candidate);
  if(checked.errors.length) throw new Error(checked.errors.map((e)=>`[${e.code}] ${e.message}`).join('; '));

  const evidenceErrors=[];
  const selectionRun=runJsonScript('bin/select-tests.mjs');
  const intelligence=selectionRun.parsed ? {
    status:selectionRun.ok?'PASS':'FAIL',
    base:selectionRun.parsed?.impact?.base??null,
    changed:selectionRun.parsed?.impact?.changed??[],
    impactedTests:(selectionRun.parsed?.impact?.impactedTests??[]).map((item)=>item.path??item),
    impactedSurfaces:(selectionRun.parsed?.impact?.impactedSurfaces??[]).map((item)=>item.path??item),
    releaseSelection:selectionRun.parsed?.selection?.release??[],
  } : {status:'FAIL',base:null,changed:[],impactedTests:[],impactedSurfaces:[],releaseSelection:[]};
  if(config.repositoryIntelligence?.enabled===true && !selectionRun.ok) evidenceErrors.push({
    code:'REPOSITORY_INTELLIGENCE_TEST_SELECTION_FAILED',
    message:(selectionRun.stderr||selectionRun.stdout||selectionRun.error||'test selection failed').trim().slice(0,5000)
  });

  const adapterConfigs=loadAdapterConfig(root,config.evidence?.adapterConfigPath??'executionkit.adapters.json').adapters??{};
  const collected=collectEvidence(root,{selected:required});
  for(const report of collected.reports) {
    const errors=validateCollectedEvidence(root,candidate,report,{maxAgeMinutes:Number(config.evidence?.maxAgeMinutes??1440)});
    if(errors.length) evidenceErrors.push({producer:report.producer,errors});
    const producerCfg=adapterConfigs[report.producer]??{};
    if(report.result==='PASS' && producerCfg.reportPath && producerCfg.testFormat) {
      const producerReport=path.resolve(root,producerCfg.reportPath);
      if(!producerReport.startsWith(root+path.sep)||!fs.existsSync(producerReport)||!fs.statSync(producerReport).isFile()) {
        evidenceErrors.push({producer:report.producer,code:'PRODUCER_TEST_REPORT_MISSING',path:producerCfg.reportPath});
      } else {
        const producerPolicy={evidence:{
          testFormat:producerCfg.testFormat,
          minimumTests:Number(producerCfg.minimumTests??1),
          allowSkipped:producerCfg.allowSkipped===true,
          allowFlaky:producerCfg.allowFlaky===true,
        }};
        const validation=runValidator(producerReport,producerPolicy);
        if(validation.error||validation.status!==0) evidenceErrors.push({
          producer:report.producer,code:'PRODUCER_TEST_ADEQUACY_FAILED',
          message:(validation.stderr||validation.stdout||validation.error?.message||'').trim().slice(0,5000)
        });
      }
    }
  }
  const missing=required.filter((id)=>!collected.reports.some((report)=>report.producer===id&&report.result==='PASS'));
  if(missing.length) evidenceErrors.push({code:'REQUIRED_PRODUCERS_NOT_PASS',producers:missing});

  const reportPath=path.resolve(root,config.evidence.testReportPath);
  if(!reportPath.startsWith(root+path.sep)||!fs.existsSync(reportPath)||!fs.statSync(reportPath).isFile()) evidenceErrors.push({code:'TEST_REPORT_MISSING',path:config.evidence.testReportPath});
  else {
    const validator=runValidator(reportPath,config);
    if(validator.error||validator.status!==0) evidenceErrors.push({code:'TEST_ADEQUACY_FAILED',message:(validator.stderr||validator.stdout||validator.error?.message||'').trim().slice(0,5000)});
  }

  const agentic=evidenceErrors.length?{status:'BLOCKED',reason:'deterministic-gate-failed'}:executeAgenticJourneys(root,{boundary:'release'});
  if(!['PASS','NOT_APPLICABLE'].includes(agentic.status))evidenceErrors.push({code:'AGENTIC_RELEASE_NOT_PASS',errors:agentic.errors??[],gatePath:agentic.gatePath??null});
  const status=evidenceErrors.length?'FAIL':'PASS';
  const gatePath=writeGate(candidate,status,{agentic,requiredProducers:required,intelligence,reports:collected.reports.map((r)=>({producer:r.producer,result:r.result,completedAt:r.completedAt??null,artifact:r.artifact??null})),errors:evidenceErrors});
  await emitSystemEvent(root,status==='PASS'?'test.completed':'test.failed',{boundary,status,gatePath,errorCount:evidenceErrors.length},{source:'test-os'});
  console.log(JSON.stringify({schemaVersion:'executionkit-test-orchestrator/v1',status,boundary,candidateId:candidate.candidateId,commit:candidate.commit,gatePath,intelligence,errors:evidenceErrors},null,2));
  process.exit(status==='PASS'?0:1);
} catch(error) {
  await emitSystemEvent(root,'test.failed',{boundary,message:error.message},{source:'test-os'});
  console.error(`Test OS failed: ${error.message}`);
  process.exit(1);
}
