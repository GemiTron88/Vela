#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnBoundedSync } from '../lib/bounded-process.mjs';
import { VISUAL_CONFIG, VISUAL_ROOT, loadVisualConfig, readJSON, safeVisualPath, sealVisual, writeJSON } from '../lib/visual-contract.mjs';
import { discoverVisualSurfaces, planVisualMatrix } from '../lib/visual-surface.mjs';
import { captureVisualMatrix } from '../lib/visual-capture.mjs';
import { inspectVisualRun, submitNativeVisualReview } from '../lib/visual-critic.mjs';
import { auditVisualRun, certifyVisualRun, compareVisualRemediation, currentVisualRunId, visualHeatmapMarkdown } from '../lib/visual-audit.mjs';
import { taskV4SystemFindings } from '../lib/v4-product-closure.mjs';
import {planVisualMedia} from '../lib/visual-production-plan.mjs';

const args=process.argv.slice(2),action=args.shift()??'status',root=path.resolve(args[0]&&!args[0].startsWith('--')?args.shift():'.');
const flag=k=>args.includes('--'+k),value=(k,d=null)=>{const eq=args.find(a=>a.startsWith('--'+k+'='));if(eq)return eq.slice(k.length+3);const i=args.indexOf('--'+k);return i>=0?args[i+1]:d;};
const here=path.dirname(fileURLToPath(import.meta.url));
try{
  if(flag('init')){
    const file=safeVisualPath(root,VISUAL_CONFIG);if(fs.existsSync(file))throw new Error('Refuse to overwrite the project visual contract');
    fs.copyFileSync(path.join(here,'../templates/visual/executionkit.visual.json'),file);
    const hook=safeVisualPath(root,'tests/visual/project-hooks.mjs');fs.mkdirSync(path.dirname(hook),{recursive:true});if(!fs.existsSync(hook))fs.copyFileSync(path.join(here,'../templates/visual/project-hooks.mjs'),hook);
    console.log(JSON.stringify({schemaVersion:'executionkit-visual-init/v2',status:'SCAFFOLDED',contract:VISUAL_CONFIG,reason:'Bind real surfaces, authentication, state fixtures, live revision probe and vision reviewer before capture'}));
  }else if(['capture','inspect','certify'].includes(action)&&!flag('worker')){
    const cfg=loadVisualConfig(root),r=spawnBoundedSync(process.execPath,[fileURLToPath(import.meta.url),action,root,...args,'--worker'],{cwd:root,timeoutMs:cfg.budgets.timeoutMs+15000,maxBuffer:16*1024*1024});
    if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
    if(r.error||r.timedOut){console.log(JSON.stringify({schemaVersion:'executionkit-visual-operation/v2',status:'FAIL',code:'VISUAL_OPERATION_TIMEOUT_OR_PROCESS_FAILURE',message:r.error?.message??'Visual process exceeded its budget'}));process.exitCode=1;}else process.exitCode=r.status??1;
  }else{
    const runId=value('run',currentVisualRunId(root));let result;
    if(action==='media-plan'||action==='media-check'){
      const start=Number(value('offset','0')),pageSize=Number(value('limit','50'));
      result=planVisualMedia(root,{offset:start,limit:pageSize,verify:action==='media-check'||flag('verify')});
      if(action==='media-check'&&result.status==='BLOCKED'&&result.evidence)result.status='FAIL';
    }
    else if(action==='discover')result=discoverVisualSurfaces(root);
    else if(action==='plan')result=planVisualMatrix(root,{mode:value('mode','impact'),base:value('base'),changedFiles:value('changed','').split(',').filter(Boolean)});
    else if(action==='capture')result=await captureVisualMatrix(root,{mode:value('mode','impact'),base:value('base'),changedFiles:value('changed','').split(',').filter(Boolean),resume:flag('resume')?runId:null});
    else if(action==='inspect'){
      const responseFile=value('response');
      result=responseFile
        ? await submitNativeVisualReview(root,{runId,cellId:value('cell'),responseFile,reviewerId:value('reviewer')})
        : await inspectVisualRun(root,{runId,cellIds:value('cell')?value('cell').split(','):null});
    }
    else if(action==='compare')result=compareVisualRemediation(root,readJSON(safeVisualPath(root,value('claim'),{mustExist:true,file:true})));
    else if(action==='certify')result=await certifyVisualRun(root,{runId});
    else if(['status','validate'].includes(action))result=auditVisualRun(root,{runId,requireCertification:flag('release')});
    else if(action==='remediate'){
      const audit=auditVisualRun(root,{runId});
      if(flag('accept')||flag('waive')){
        const finding=audit.unresolved?.find(f=>f.id===value('finding'));if(!finding||['P0','P1'].includes(finding.severity))throw new Error('Only independently reviewed P2/review findings can be accepted or waived');
        const rationale=value('rationale');if(!rationale||rationale.length<20)throw new Error('A concrete rationale is required');
        const cfg=loadVisualConfig(root),file=safeVisualPath(root,`${VISUAL_ROOT}/dispositions.json`),existing=fs.existsSync(file)?readJSON(file):{items:[]};
        const disposition=sealVisual({findingId:finding.id,imageSha256:finding.evidenceRefs[0],disposition:flag('accept')?'accepted':'waived',rationale,reviewerId:cfg.critic.reviewerId,expiresAt:new Date(Date.now()+30*86400000).toISOString()},'review');
        existing.items=existing.items.filter(w=>!(w.findingId===disposition.findingId&&w.imageSha256===disposition.imageSha256));existing.items.push(disposition);writeJSON(file,existing);result={schemaVersion:'executionkit-visual-remediation-plan/v2',status:'DISPOSITION_RECORDED',disposition};
      }else{
        const findings=[...(audit.errors??[]),...(audit.unresolved??[])].map(f=>({...f,code:f.code??f.category,message:f.message??f.reason,severity:f.severity==='P0'?'CRITICAL':['P1','P2','review'].includes(f.severity)?'HIGH':f.severity??'HIGH'}));
        result={schemaVersion:'executionkit-visual-remediation-plan/v2',status:findings.length?'REMEDIATION_REQUIRED':'NO_OPEN_FINDINGS',runId,findings,...(flag('task-findings')?{tasks:taskV4SystemFindings(root,{system:'visual',findings,boundary:value('boundary','wave'),autoCommit:false})}:{})};
      }
    }else throw new Error('Unknown Visual OS operation: '+action);
    if(flag('human'))console.log(result.heatmap?visualHeatmapMarkdown(result):JSON.stringify(result,null,2));else console.log(JSON.stringify(result));
    if(['FAIL','BLOCKED','REVIEW_REQUIRED','REMEDIATION_REQUIRED'].includes(result.status)||result.complete===false)process.exitCode=1;
  }
}catch(error){console.log(JSON.stringify({schemaVersion:'executionkit-visual-operation/v2',status:'BLOCKED',code:'VISUAL_OPERATION_BLOCKED',message:error.message}));process.exitCode=1;}
