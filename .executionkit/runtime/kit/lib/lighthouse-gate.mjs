import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolveDerivedPath,resolveProjectPathSafe} from './derived-state.mjs';

export const LIGHTHOUSE_FLOOR=Object.freeze({performance:100,accessibility:100,'best-practices':100,seo:100});
export const LIGHTHOUSE_CWV_LIMITS=Object.freeze({
  'largest-contentful-paint':2500,
  'cumulative-layout-shift':0.1,
  'total-blocking-time':200
});
export function validateMobileLighthouse(reports,{urls,startedAtMs,now=Date.now()}={}){
  const errors=[],covered=new Set(),add=(code,message)=>errors.push({code,message});
  if(!Number.isFinite(startedAtMs))add('LIGHTHOUSE_REPORT_STALE','Execution start timestamp is required');
  const normalize=value=>{const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Invalid Lighthouse target');url.hash='';return url.href;};
  let targets=[];
  try{if(!Array.isArray(urls)||!urls.length||urls.length>1000)throw Error('Explicit complete target URLs required');targets=[...new Set(urls.map(normalize))];}catch(error){add('LIGHTHOUSE_TARGETS_REQUIRED',error.message);}
  let minScore=100;
  for(const report of reports){
    if(report.runtimeError){add('LIGHTHOUSE_RUNTIME_ERROR','Lighthouse could not measure the page');minScore=0;continue;}
    const time=Date.parse(report.fetchTime);
    if(!Number.isFinite(time)||time<startedAtMs-2000||time>now+5000)add('LIGHTHOUSE_REPORT_STALE','Report must come from this execution');
    if(report.configSettings?.throttlingMethod==='provided'||report.configSettings?.disableStorageReset===true){
      add('LIGHTHOUSE_THROTTLING_SPOOFED','Lighthouse throttling or storage reset must not be disabled to inflate scores');
    }
    for(const [category,min] of Object.entries(LIGHTHOUSE_FLOOR)){
      const rawScore=report.categories?.[category]?.score;
      const pct=Number.isFinite(rawScore)?Math.round(rawScore*100):0;
      if(pct<minScore)minScore=pct;
      if(!Number.isFinite(rawScore)||rawScore!==1)add('LIGHTHOUSE_BUDGET_FAILED',category+' must reach '+min);
    }
    if(report.audits?.['http-status-code']?.score!==1)add('LIGHTHOUSE_HTTP_FAILURE','Measured page must have successful HTTP status');
    for(const [auditId,limit] of Object.entries(LIGHTHOUSE_CWV_LIMITS)){
      const audit=report.audits?.[auditId];
      if(audit&&Number.isFinite(audit.numericValue)&&audit.numericValue>limit){
        add('LIGHTHOUSE_CWV_FAILED',auditId+' ('+audit.numericValue+') exceeds 100/100 budget limit ('+limit+')');
      }
    }
    try{
      const url=normalize(report.requestedUrl??report.finalUrl),final=normalize(report.finalDisplayedUrl??report.finalUrl);
      if(url!==final)add('LIGHTHOUSE_TARGET_REDIRECTED','A redirected page cannot stand in for the requested target');
      if(report.configSettings?.formFactor==='mobile'&&url===final)covered.add(url);
    }catch{add('LIGHTHOUSE_URL_INVALID','Report has no valid requested/final target');}
  }
  for(const url of targets)if(!covered.has(url))add('LIGHTHOUSE_MOBILE_TARGET_MISSING','A declared target lacks a current mobile report: '+url);
  if(!reports.length)minScore=0;
  return {status:errors.length?'FAIL':'PASS',ok:errors.length===0,errors,targets,mobileTargets:covered.size,minScore,minimumScores:LIGHTHOUSE_FLOOR};
}
export function lighthouseSourceIdentity(root){
  const scope=['app','routes','resources','src','pages','public','frontend','web','database','config','bootstrap','artisan','package.json','package-lock.json','pnpm-lock.yaml','yarn.lock','composer.json','composer.lock','execution.config.json','executionkit.adapters.json','executionkit.components.json','executionkit.design.json','executionkit.visual.json','quality.contract.json'];
  const run=args=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8',timeout:15000,maxBuffer:16*1024*1024,shell:false,windowsHide:true});if(r.error||r.status!==0)throw Error('LIGHTHOUSE_SOURCE_IDENTITY_REQUIRED');return r.stdout;};
  const commit=run(['rev-parse','HEAD']).trim();
  const source=run(['ls-tree','HEAD','--',...scope])+run(['diff','--binary','HEAD','--',...scope]);
  const untracked=run(['ls-files','--others','--exclude-standard','-z','--',...scope]).split('\0').filter(Boolean);
  // Measured application source must be committed; generated LHCI output is outside this scope.
  if(untracked.length)throw Error('LIGHTHOUSE_UNTRACKED_APPLICATION_SOURCE');
  return {commit,sourceFingerprint:createHash('sha256').update(source).digest('hex')};
}
export function inspectLighthouseGate(root,{boundary='phase'}={}){
  try{
    const file=resolveDerivedPath(root,'.executionkit/evidence/raw/seo-performance.json','Lighthouse gate',{file:true,mustExist:true});
    const evidence=JSON.parse(fs.readFileSync(file,'utf8')),identity=lighthouseSourceIdentity(root);
    const observed=Date.parse(evidence.observedAt);
    if(evidence.status!=='PASS'||evidence.mobileGate?.status!=='PASS'||evidence.source?.sourceFingerprint!==identity.sourceFingerprint||!Number.isFinite(observed)||observed>Date.now()+5000||observed<Date.now()-24*3600000)throw Error('LIGHTHOUSE_CURRENT_MOBILE_GATE_REQUIRED');
    if(!Array.isArray(evidence.reports)||!evidence.reports.length)throw Error('LIGHTHOUSE_REPORT_PROOF_REQUIRED');
    const measured=[];
    for(const report of evidence.reports){
      const full=resolveProjectPathSafe(root,report.path,'Lighthouse report',{file:true,mustExist:true});
      if(createHash('sha256').update(fs.readFileSync(full)).digest('hex')!==report.sha256)throw Error('LIGHTHOUSE_REPORT_CHANGED');
      measured.push(JSON.parse(fs.readFileSync(full,'utf8')));
    }
    const configFile=resolveProjectPathSafe(root,'execution.config.json','Lighthouse project config',{file:true,mustExist:true}),config=JSON.parse(fs.readFileSync(configFile,'utf8'));
    const adapterFile=resolveProjectPathSafe(root,config.evidence?.adapterConfigPath??'executionkit.adapters.json','Lighthouse adapter config',{file:true,mustExist:true});
    const urls=JSON.parse(fs.readFileSync(adapterFile,'utf8')).adapters?.['seo-performance']?.urls;
    if(validateMobileLighthouse(measured,{urls,startedAtMs:Date.parse(evidence.startedAt)}).status!=='PASS')throw Error('LIGHTHOUSE_MEASUREMENTS_INVALID');
    return {status:'PASS',source:identity,mobileTargets:evidence.mobileGate.mobileTargets};
  }catch(error){return {status:'BLOCKED',reason:error.message,nextCommand:'executionkit test '+(boundary==='release'?'release':'phase')+' .'};}
}
