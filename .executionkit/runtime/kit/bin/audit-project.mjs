#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { auditUiConformance } from '../lib/component-model.mjs';
import { inspectVisualOS } from '../lib/visual-os.mjs';
import { emitSystemEvent } from '../lib/telemetry-events.mjs';
import { loadConfig } from '../lib/execution-model.mjs';
import { loadAdapterConfig } from '../lib/adapter-registry.mjs';
import { collectEvidence, loadCandidate, validateCandidate, validateCollectedEvidence } from '../lib/evidence-model.mjs';
import { resolveDerivedPath } from '../lib/derived-state.mjs';
import { fileURLToPath } from 'node:url';
import { evaluateV4AuditEvidence } from '../lib/v4-audit-evidence.mjs';
import { captureV4WorktreeIdentity } from '../lib/v4-gate-identity.mjs';

const kitRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args = process.argv.slice(2);
const root = path.resolve(args.find((arg) => !arg.startsWith('--')) ?? '.');
function value(name, fallback = null) {
  const direct = args.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
}
function runScript(rel, extra = []) {
  const file=path.join(kitRoot,rel);
  if(!fs.existsSync(file)) return {name:rel,status:'MISSING',ok:false,exitCode:null,output:'',parsed:null};
  const result=spawnSync(process.execPath,[file,root,...extra],{cwd:root,encoding:'utf8',timeout:1800000,maxBuffer:32*1024*1024});
  const output=String(result.stdout||result.stderr||result.error?.message||'').trim();
  let parsed=null;
  try { parsed=JSON.parse(String(result.stdout||'').trim()); } catch {}
  return {name:rel,status:result.error?'ERROR':result.status===0?'PASS':'FAIL',ok:!result.error&&result.status===0,exitCode:result.status,output:output.slice(0,8000),parsed};
}
function runAuditAdapter(id,cfg,boundary,candidate) {
  const boundaries=Array.isArray(cfg.boundaries)&&cfg.boundaries.length?cfg.boundaries:['wave','phase','release'];
  if(!boundaries.includes(boundary)) return {id,status:'NOT_APPLICABLE',domains:cfg.domains??[],reason:`boundary ${boundary} not selected`};
  if(typeof cfg.command!=='string'||!cfg.command.trim()) return {id,status:'NOT_CONFIGURED',domains:cfg.domains??[],error:'audit adapter command missing'};
  const args=Array.isArray(cfg.args)?cfg.args.map(String):[];
  const result=spawnSync(cfg.command,args,{
    cwd:root,encoding:'utf8',timeout:Number(cfg.timeoutMs??900000),maxBuffer:32*1024*1024,shell:false,
    env:{...process.env,EXECUTIONKIT_AUDIT_BOUNDARY:boundary,EXECUTIONKIT_CANDIDATE_ID:candidate?.candidateId??'',EXECUTIONKIT_CANDIDATE_COMMIT:candidate?.commit??''}
  });
  return {
    id,status:result.error?'ERROR':result.status===0?'PASS':'FAIL',domains:cfg.domains??[],
    command:[cfg.command,...args].join(' '),exitCode:result.status,signal:result.signal,
    stdout:String(result.stdout??'').slice(0,4000),stderr:String(result.stderr??'').slice(0,4000),error:result.error?.message??null
  };
}
function writeAuditGate(boundary,candidate,status,checks,findings) {
  const file=resolveDerivedPath(root,'.executionkit/gates/audit-'+boundary+'.json','audit '+boundary+' gate',{createParents:true});
  const identity=boundary==='release'
    ? {candidateId:candidate.candidateId,commit:candidate.commit}
    : captureV4WorktreeIdentity(root);
  fs.writeFileSync(file,JSON.stringify({
    schemaVersion:boundary==='release'?'executionkit-release-gate/v1':'executionkit-v4-audit-boundary/v1',
    system:'audit-os',boundary,status,...identity,completedAt:new Date().toISOString(),checks,findings
  },null,2)+'\n');
  return path.relative(root,file).split(path.sep).join('/');
}

try {
  const boundary = value('boundary', 'ad-hoc');
  if(!['ad-hoc','wave','phase','release'].includes(boundary)) throw new Error(`Unsupported audit boundary: ${boundary}`);
  await emitSystemEvent(root, 'audit.started', { boundary }, { source: 'audit-os' });
  const {config,policyIssues=[]}=loadConfig(root);
  if(policyIssues.length) throw new Error(policyIssues.map((e)=>`[${e.code}] ${e.message}`).join('; '));

  let candidate=null;
  if(boundary==='release') {
    candidate=loadCandidate(root);
    const checked=validateCandidate(root,candidate);
    if(checked.errors.length) throw new Error(`Release Audit OS requires the exact current candidate: ${checked.errors.map((e)=>`[${e.code}] ${e.message}`).join('; ')}`);
  }

  const visual = inspectVisualOS(root, { boundary, config });
  const renderedEvidenceProven = Boolean(visual.renderedEvidence?.proven);
  const heuristicReviewCodes = new Set(['VISUAL_GENERIC_PATTERN_REVIEW_REQUIRED']);
  const ui = visual.audit ?? auditUiConformance(root, { boundary });
  const uiMechanicalStatus = renderedEvidenceProven && visual.status === 'PASS' ? 'PASS' : ui.mechanicalStatus;
  const checks = [{ id: 'ui-conformance', status: uiMechanicalStatus, findings: ui.findings.length }];
  const findings = renderedEvidenceProven
    ? ui.findings.filter((f) => !heuristicReviewCodes.has(f.code))
    : [...ui.findings];
  if(boundary==='release' && uiMechanicalStatus==='REVIEW_REQUIRED') findings.push({
    code:'RELEASE_UI_REVIEW_UNRESOLVED',severity:'HIGH',domain:'premium-ux',
    message:'Release boundary cannot convert REVIEW_REQUIRED into PASS. Provide independent rendered evidence through the project quality/audit contract and rerun the release audit.'
  });

  const matrix=[
    ['security','bin/validate-security.mjs',[]],
    ['data-safety','bin/validate-data-safety.mjs',['wave','phase','release'].includes(boundary)?['--strict']:[]],
    ['integration','bin/validate-integration.mjs',boundary==='release'?['--release']:[]],
  ];
  if(['wave','phase','release'].includes(boundary)) matrix.push(['quality','bin/validate-quality.mjs',boundary==='release'?['--release','--json']:['--json']]);
  if(boundary==='release') {
    const productionRuntimeRequired=config.distributionRepository!==true && config.deployment?.requiredForRelease===true;
    if(productionRuntimeRequired) matrix.push(['runtime-health','bin/validate-runtime-health.mjs',[]]);
    matrix.push(['repository-intelligence','bin/validate-repository-intelligence.mjs',[]]);
  }

  for(const [id,script,extra] of matrix) {
    const result=runScript(script,extra);
    checks.push({id,status:result.status,exitCode:result.exitCode,reportedStatus:result.parsed?.status??null});
    if(Array.isArray(result.parsed?.findings)&&result.parsed.findings.length) {
      for(const f of result.parsed.findings) findings.push({domain:id,...f});
    } else if(!result.ok) {
      findings.push({code:`AUDIT_CHECK_${id.replace(/[^a-z0-9]+/gi,'_').toUpperCase()}_FAILED`,severity:'HIGH',domain:id,message:result.output||`${script} failed`});
    }
    if(id==='runtime-health' && boundary==='release' && result.parsed?.status==='NOT_CONFIGURED') findings.push({code:'RELEASE_RUNTIME_HEALTH_NOT_CONFIGURED',severity:'HIGH',domain:'runtime-health',message:'Release audit requires configured runtime health checks; NOT_CONFIGURED is not a PASS.'});
  }

  const adapterRel=config.evidence?.adapterConfigPath??'executionkit.adapters.json';
  const adapters=loadAdapterConfig(root,adapterRel).adapters??{};

  if(boundary==='release' && config.premiumExperience?.applicability==='REQUIRED') {
    let qualityEvidencePath=null;
    try {
      const qualityContractPath=String(config.quality?.contractPath??'').trim();
      if(!qualityContractPath) throw new Error('quality.contractPath is not configured');
      const qualityContract=JSON.parse(fs.readFileSync(path.join(root,qualityContractPath),'utf8'));
      qualityEvidencePath=String(qualityContract.evidencePath??'').trim();
      if(!qualityEvidencePath) throw new Error('premium quality contract evidencePath is missing');
    } catch(error) {
      findings.push({code:'PREMIUM_QUALITY_EVIDENCE_CONTRACT_INVALID',severity:'HIGH',domain:'premium-ux',message:error.message});
    }

    const qualityProducers=Object.entries(adapters).filter(([,cfg])=>
      cfg?.kind==='evidence' &&
      cfg?.evidenceType==='quality' &&
      qualityEvidencePath &&
      cfg?.reportPath===qualityEvidencePath
    );
    if(qualityProducers.length===0) {
      findings.push({
        code:'PREMIUM_QUALITY_EXECUTABLE_EVIDENCE_MISSING',severity:'HIGH',domain:'premium-ux',
        message:'Premium release audit requires at least one kind=evidence, evidenceType=quality producer whose reportPath matches the quality contract evidencePath. A hand-authored PASS JSON is not release evidence.'
      });
    } else {
      try {
        const selected=qualityProducers.map(([id])=>id);
        const collected=collectEvidence(root,{selected});
        for(const report of collected.reports) {
          const errors=validateCollectedEvidence(root,candidate,report,{maxAgeMinutes:Number(config.evidence?.maxAgeMinutes??1440)});
          checks.push({id:`premium-quality:${report.producer}`,status:report.result,exitCode:report.exitCode??null});
          if(errors.length) findings.push({
            code:'PREMIUM_QUALITY_EXECUTABLE_EVIDENCE_INVALID',severity:'HIGH',domain:'premium-ux',producer:report.producer,
            message:errors.join('; ')
          });
        }
        const passed=new Set(collected.reports.filter((report)=>report.result==='PASS').map((report)=>report.producer));
        for(const id of selected) if(!passed.has(id)) findings.push({
          code:'PREMIUM_QUALITY_EXECUTABLE_EVIDENCE_FAILED',severity:'HIGH',domain:'premium-ux',producer:id,
          message:`Premium quality evidence producer ${id} did not PASS for the current candidate.`
        });
      } catch(error) {
        findings.push({code:'PREMIUM_QUALITY_EXECUTABLE_EVIDENCE_ERROR',severity:'HIGH',domain:'premium-ux',message:error.message});
      }
    }
  }

  let v4Evidence=null;
  if(/^[45]\./.test(String(config.standardVersion??'')) && ['wave','phase','release'].includes(boundary)){
    v4Evidence=evaluateV4AuditEvidence(root,{boundary,candidate});
    checks.push({id:'v4-ten-system-evidence',status:v4Evidence.status,systems:v4Evidence.systems,providerUsage:v4Evidence.providerUsage});
    findings.push(...v4Evidence.findings);
  }

  const projectAuditAdapters=Object.entries(adapters).filter(([,cfg])=>cfg?.kind==='audit');
  for(const [id,cfg] of projectAuditAdapters) {
    const result=runAuditAdapter(id,cfg,boundary,candidate);
    checks.push({id:`project-audit:${id}`,status:result.status,exitCode:result.exitCode??null,domains:result.domains});
    if(['FAIL','ERROR','NOT_CONFIGURED'].includes(result.status)) findings.push({
      code:'PROJECT_AUDIT_ADAPTER_FAILED',severity:'HIGH',domain:(result.domains?.[0]??'project-domain'),adapter:id,
      message:result.error||result.stderr||result.stdout||`Project audit adapter ${id} did not pass`
    });
  }

  if(boundary==='release' && config.capabilities?.audit==='FULL') {
    if(projectAuditAdapters.length===0) findings.push({
      code:'FULL_AUDIT_PROJECT_DOMAIN_ADAPTERS_MISSING',severity:'HIGH',domain:'project-domain',
      message:'Audit OS FULL requires at least one project-specific kind=audit adapter for business/domain invariants; generic framework checks alone are insufficient.'
    });
    if(!Array.isArray(adapters.security?.commands)||adapters.security.commands.length===0) findings.push({
      code:'FULL_AUDIT_SECURITY_DEPTH_UNCONFIGURED',severity:'HIGH',domain:'security',
      message:'Audit OS FULL requires project-configured security tooling in adapters.security.commands; the built-in baseline alone is insufficient.'
    });
    const productionRuntimeRequired=config.distributionRepository!==true && config.deployment?.requiredForRelease===true;
    if(productionRuntimeRequired && (!Array.isArray(adapters['runtime-health']?.checks)||adapters['runtime-health'].checks.length===0)) findings.push({
      code:'FULL_AUDIT_RUNTIME_DEPTH_UNCONFIGURED',severity:'HIGH',domain:'runtime-health',
      message:'Audit OS FULL requires project-configured runtime-health checks; source inspection alone cannot prove runtime health.'
    });
  }

  const blocking=findings.filter((finding)=>['CRITICAL','HIGH'].includes(finding.severity));
  const status=blocking.length?'FAIL':findings.some((finding)=>finding.severity==='REVIEW')?'REVIEW_REQUIRED':'PASS';
  let gatePath=null;
  if(['wave','phase','release'].includes(boundary)) gatePath=writeAuditGate(boundary,candidate,status,checks,findings);

  const report={
    schemaVersion:'executionkit-audit-orchestrator/v1',boundary,status,mechanicalStatus:status,
    candidateId:candidate?.candidateId??null,commit:candidate?.commit??null,checks,findings,v4Evidence,
    renderedReviewRequired:ui.renderedReviewRequired,ui,gatePath,
    limitations:['Audit OS executes the configured mechanical/runtime matrix and fails closed on missing FULL-depth security/runtime checks. Domain-specific business invariants still require explicit project adapters/contracts; undocumented intent is never inferred as verified.']
  };
  await emitSystemEvent(root,status==='FAIL'?'audit.failed':'audit.completed',{boundary,mechanicalStatus:status,findingCount:findings.length,gatePath},{source:'audit-os'});
  console.log(JSON.stringify(report,null,2));
  if(status==='FAIL'||(boundary==='release'&&status!=='PASS')) process.exit(1);
} catch (error) {
  await emitSystemEvent(root, 'audit.failed', { boundary: value('boundary', 'ad-hoc'), message: error.message }, { source: 'audit-os' });
  console.error(`Audit scan failed: ${error.message}`); process.exit(1);
}
