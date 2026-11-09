import {inspectDecisionPlan,activeDecisionTaskId} from './decision/plan-alignment.mjs';
import {isV5} from './v5-config.mjs';
import {writeDecisionEvidence,executeBundledDecision} from './decision-os.mjs';
import {decisionQualitySignals} from './decision/quality-signals.mjs';
import {reconciliationBudget} from './reconcile-budget.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { spawnBoundedSync } from './bounded-process.mjs';
import { fileURLToPath } from 'node:url';
import { loadConfig,loadTasks } from './execution-model.mjs';
import { inspectV4ContentOS } from './v4-content-os.mjs';
import { writeDocumentationFabric, validateDocumentationFabric } from './documentation-fabric.mjs';
import { inspectVisualOS } from './visual-os.mjs';
import { executeVisualBoundary } from './visual-boundary.mjs';
import { executeV4Tests } from './v4-test-os.mjs';
import { writeStateCheckpoint } from './state-model.mjs';
import { resolveDerivedPath } from './derived-state.mjs';
import { useV4Knowledge } from './v4-knowledge-runtime.mjs';
import { inspectRepositoryProviders } from './repository-providers.mjs';
import { loadCandidate, validateCandidate } from './evidence-model.mjs';
import { inspectV4ProductClosure, taskV4SystemFindingGroups } from './v4-product-closure.mjs';
import { captureV4FastWorktreeIdentity, captureV4WorktreeIdentity } from './v4-gate-identity.mjs';
import { todoMaintenanceStatus } from './todo-maintenance.mjs';
import { resolveRuntimePlan } from './runtime-orchestrator.mjs';
import { guardDatabaseReferences } from './database-integrity.mjs';
import { guardRouteReferences } from './route-integrity.mjs';
import { executeDecisionAdapter } from './decision-adapter.mjs';
import { guardSurfaceIntegrity } from './surface-integrity.mjs';

const kitRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function boundaryDecision(root,config,{boundary,changedFilesCount,failedChecks,deadlineAt,surface,visual}){
  let refresh=null;
  if((isV5(config)||(config.decisionOS?.enabled===true&&config.decisionOS.knowledgeSource))&&(deadlineAt==null||deadlineAt-Date.now()>16000))refresh=executeDecisionAdapter(root,config,{action:'refresh'});
  const signals=decisionQualitySignals({changedFilesCount,failedChecks,surface,visual});
  const result=executeDecisionAdapter(root,config,{request:{schemaVersion:2,requestId:crypto.randomUUID(),event:boundary==='release'?'release':boundary==='phase'?'phase':'wave',action:'quality_gate',hostClass:'vps',environment:boundary==='release'?'production':'development',signals}});
  if(isV5(config))writeDecisionEvidence(root,{...result,boundary,knowledgeRefresh:refresh});
  return {...result,knowledgeRefresh:refresh};
}
const SEO_BOUNDARY_TIMEOUT_MS=3*60*1000;
function remainingMs(deadlineAt){return deadlineAt===null||deadlineAt===undefined?Infinity:deadlineAt-Date.now();}
function requireBudget(deadlineAt,stage){
  const remaining=remainingMs(deadlineAt);
  if(remaining<=1000)throw Object.assign(new Error('Boundary deadline exhausted before '+stage),{code:'V4_BOUNDARY_DEADLINE_EXCEEDED',stage});
  return remaining;
}
function boundaryProgress(boundary,stage,status,startedAt=null,extra=null){
  const mode=process.env.EXECUTIONKIT_CLI_PROGRESS_MODE;
  if(!mode||mode==='heartbeat')return;
  const event={schemaVersion:'executionkit-v4-boundary-progress/v1',boundary,stage,status,at:new Date().toISOString(),...(extra&&typeof extra==='object'?extra:{})};
  if(startedAt!==null)event.durationMs=Date.now()-startedAt;
  process.stderr.write(JSON.stringify(event)+'\n');
}
function git(root,args,allowFail=false,timeout=30000){const r=spawnSync('git',args,{cwd:root,encoding:'utf8',timeout,maxBuffer:16*1024*1024,windowsHide:true});if(!allowFail&&(r.error||r.status!==0))throw new Error(String(r.stderr||r.stdout||r.error?.message||'git failed').trim());return {status:r.status,stdout:String(r.stdout??'').trim(),stderr:String(r.stderr??'').trim(),error:r.error?.message??null};}
function gitMutate(root,args){return git(root,args,false,120000);}
function parseJsonOutput(result,label){try{return JSON.parse(String(result.stdout??'').trim());}catch{throw new Error(label+' did not return JSON: '+String(result.stderr||result.stdout||'').slice(0,1000));}}
function runSeo(root,boundary,deadlineAt=null){
  const argv=[path.join(kitRoot,'bin/seo-os.mjs'),'validate',root,'--boundary='+boundary];
  if(boundary==='release')argv.push('--release');
  const timeout=Math.max(1000,Math.min(SEO_BOUNDARY_TIMEOUT_MS,requireBudget(deadlineAt,'seo')));
  const r=spawnBoundedSync(process.execPath,argv,{cwd:root,encoding:'utf8',timeoutMs:timeout,maxBuffer:16*1024*1024,windowsHide:true});
  if(r.error)return {status:'FAIL',errors:[{code:r.timedOut?'SEO_TIMEOUT':'SEO_EXEC_FAILED',message:r.error.message}]};
  try{
    const parsed=JSON.parse(String(r.stdout??'').trim());
    if(parsed&&parsed.schemaVersion==='executionkit-v4-seo-os/v1')return parsed;
  }catch{}
  if(r.status!==0){return {status:'FAIL',errors:[{code:'SEO_EXEC_FAILED',message:String(r.stderr||r.stdout||'SEO validation failed').trim().slice(0,5000)}]};}
  return parseJsonOutput(r,'SEO OS');
}
function trackedDocsCommit(root,outputRoot,taskId){
  const status=git(root,['status','--porcelain=v1','--',outputRoot],true);
  if(status.status!==0||!status.stdout)return {status:'NO_CHANGE',commit:null};
  gitMutate(root,['add','--',outputRoot]);
  const staged=git(root,['diff','--cached','--name-only','--',outputRoot]);
  if(!staged.stdout)return {status:'NO_CHANGE',commit:null};
  const msg='executionkit: refresh generated docs'+(taskId?' for '+taskId:'');
  const commit=gitMutate(root,['-c','user.name=ExecutionKit','-c','user.email=executionkit@local.invalid','commit','-m',msg,'--',outputRoot]);
  return {status:'COMMITTED',commit:git(root,['rev-parse','HEAD']).stdout,files:staged.stdout.split(/\r?\n/).filter(Boolean),message:msg,output:commit.stdout.slice(-1000)};
}
function systemStatus(value){return String(value?.status??'UNKNOWN').toUpperCase();}
function porcelainFiles(raw){
  const files=[];
  for(const line of String(raw??'').split(/\r?\n/).filter(Boolean)){
    const value=String(line??'').trim().replace(/^[A-Za-z?!]{1,2}\s+/,'');
    const file=(value.includes(' -> ')?value.split(' -> ').at(-1):value).replace(/^"|"$/g,'').replace(/\\/g,'/');
    if(file)files.push(file);
  }
  return [...new Set(files)];
}
function classify(results){
  const blocking=[];const reviews=[];
  const accept=(name,allowed)=>{const s=systemStatus(results[name]);if(allowed.includes(s))return;if(s==='REVIEW_REQUIRED')reviews.push(name);else blocking.push(name);};
  accept('test',['PASS']);
  accept('content',['PASS','NOT_APPLICABLE']);
  accept('seo',['PASS','NOT_APPLICABLE']);
  accept('docs',['PASS']);
  accept('visual',['PASS','NOT_APPLICABLE']);
  return {status:blocking.length?'FAIL':reviews.length?'REVIEW_REQUIRED':'PASS',blocking,reviews};
}
function boundaryFindings({test,content,seo,docs,visual}, boundary='phase'){
  const groups={test:[],content:[],seo:[],docs:[],visual:[]};
  const taskable=(item,owner)=>{
    if(!item||typeof item!=='object')return item;
    if(String(owner?.status??'').toUpperCase()==='REVIEW_REQUIRED'&&String(item.severity??'').toUpperCase()==='REVIEW'){
      return {...item,originalSeverity:'REVIEW',severity:'HIGH',reviewRequired:true};
    }
    return item;
  };
  for(const item of content?.findings??[])groups.content.push(taskable(item,content));
  for(const item of visual?.findings??[])groups.visual.push(taskable(item,visual));
  for(const item of seo?.implementation?.findings??[])groups.seo.push(taskable(item,seo));
  for(const item of seo?.contract?.errors??[])groups.seo.push({...item,severity:item.severity??'HIGH'});
  for(const item of seo?.errors??[])groups.seo.push({...item,severity:item.severity??'HIGH'});
  for(const item of docs?.errors??[])groups.docs.push({...item,severity:item.severity??'HIGH'});
  for(const run of test?.runs??[])if(run.status!=='PASS')groups.test.push({
    code:'TEST_'+String(run.id??'COMMAND').replace(/[^A-Za-z0-9]+/g,'_').toUpperCase()+'_FAILED',
    severity:'HIGH',
    message:String(run.stderr||run.stdout||run.error||('Test command '+(run.id??'unknown')+' failed')).slice(0,2000),
    checkId:run.id??null
  });
  for(const item of test?.errors??[])groups.test.push({...item,severity:item.severity??'HIGH'});
  if(content?.status==='REVIEW_REQUIRED'&&groups.content.length===0)groups.content.push({code:'CONTENT_REVIEW_REQUIRED',severity:'HIGH',originalSeverity:'REVIEW',reviewRequired:true,message:'Content OS requires explicit boundary review before closure'});
  if(seo?.status==='REVIEW_REQUIRED'&&groups.seo.length===0)groups.seo.push({code:'SEO_REVIEW_REQUIRED',severity:'HIGH',originalSeverity:'REVIEW',reviewRequired:true,message:'SEO OS requires explicit boundary review before closure'});
  if(docs?.status==='REVIEW_REQUIRED'&&groups.docs.length===0)groups.docs.push({code:'DOCS_REVIEW_REQUIRED',severity:'HIGH',originalSeverity:'REVIEW',reviewRequired:true,message:'Docs OS requires explicit boundary review before closure'});
  if(visual?.status==='REVIEW_REQUIRED'&&groups.visual.length===0)groups.visual.push({code:'VISUAL_REVIEW_REQUIRED',severity:'HIGH',originalSeverity:'REVIEW',reviewRequired:true,message:'Visual OS requires rendered/independent boundary review before closure'});
  if(test?.status==='REVIEW_REQUIRED'&&groups.test.length===0)groups.test.push({code:'TEST_REVIEW_REQUIRED',severity:'HIGH',originalSeverity:'REVIEW',reviewRequired:true,message:'Test OS requires explicit boundary review before closure'});
  if(['FAIL','BLOCKED'].includes(test?.status)&&groups.test.length===0)groups.test.push({
    code:'TEST_OS_'+test.status,
    severity:'HIGH',
    message:test.reason??'Test OS did not produce a PASS boundary gate'
  });
  return groups;
}
function gateFile(root,boundary){return resolveDerivedPath(root,'.executionkit/gates/reconcile-'+boundary+'.json','v4 reconciliation gate',{createParents:true});}
function releaseTestGate(root,candidate){
  const file=resolveDerivedPath(root,'.executionkit/gates/test-release.json','v4 Test OS release gate');
  if(!fs.existsSync(file))return {status:'FAIL',errors:[{code:'V4_RELEASE_TEST_GATE_MISSING',message:'Test OS release gate is missing'}]};
  let gate;try{gate=JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){return {status:'FAIL',errors:[{code:'V4_RELEASE_TEST_GATE_INVALID',message:error.message}]};}
  const errors=[];
  if(gate.schemaVersion!=='executionkit-release-gate/v1'||gate.system!=='test-os'||gate.boundary!=='release')errors.push({code:'V4_RELEASE_TEST_GATE_SCHEMA',message:'Test OS release gate contract is invalid'});
  if(gate.status!=='PASS')errors.push({code:'V4_RELEASE_TEST_GATE_NOT_PASS',message:'Test OS release gate is not PASS'});
  if(gate.candidateId!==candidate.candidateId||gate.commit!==candidate.commit)errors.push({code:'V4_RELEASE_TEST_GATE_CANDIDATE_MISMATCH',message:'Test OS release gate is not bound to the exact current candidate'});
  return {...gate,status:errors.length?'FAIL':'PASS',errors};
}
function currentCandidate(root){
  const candidate=loadCandidate(root),checked=validateCandidate(root,candidate);
  if(checked.errors.length)throw new Error('Release reconciliation requires exact current candidate: '+checked.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
  return candidate;
}

export function reconcileV4Lifecycle(root,{boundary='task',base='HEAD~1',taskId=null,commitGeneratedDocs=true,deadlineAt=null}={}){
  root=path.resolve(root);
  if(!['task','wave','phase','release'].includes(boundary))throw new Error('v4 lifecycle reconciliation supports task, wave, phase or release');
  const {config}=loadConfig(root);
  deadlineAt??=Date.now()+reconciliationBudget(root,{boundary});
  const heavyBoundary=['wave','phase','release'].includes(boundary);

  if(boundary==='task'){
    const startedAt=Date.now(),stages=[];
    let stageStarted=startedAt;
    const begin=stage=>{requireBudget(deadlineAt,stage);stageStarted=Date.now();boundaryProgress(boundary,stage,'STARTED');};
    const end=stage=>{const durationMs=Date.now()-stageStarted;stages.push({stage,durationMs});boundaryProgress(boundary,stage,'COMPLETED',stageStarted);};
    begin('changed-files');
    const identity=captureV4FastWorktreeIdentity(root);
    const worktreeChanged=identity.changedFiles??[];
    const committedFallback=worktreeChanged.length===0||base!=='HEAD~1'
      ? git(root,['diff','--name-only',base,'HEAD'],true).stdout.split(/\r?\n/).filter(Boolean)
      : [];
    const databaseFiles=[...new Set([...worktreeChanged,...committedFallback])];
    end('changed-files');begin('database-integrity');
    const database=guardDatabaseReferences(root,{files:databaseFiles,autoRefresh:true});
    end('database-integrity');begin('route-integrity');
    const route=guardRouteReferences(root,{files:databaseFiles,autoRefresh:true});
    end('route-integrity');begin('surface-integrity');
    const databaseBlocked=['FAIL','BLOCKED'].includes(database.status);
    const routeBlocked=['FAIL','BLOCKED'].includes(route.status);
    const surface=guardSurfaceIntegrity(root,{files:databaseFiles});
    end('surface-integrity');begin('decision-postflight');
    const surfaceBlocked=['FAIL','BLOCKED'].includes(surface.status);
    const allTasks=isV5(config)?loadTasks(root,config,{archiveMode:'index'}).tasks:[];
    const rawAlignmentTaskId=isV5(config)?taskId??activeDecisionTaskId(root):null;
    const matchedTask=rawAlignmentTaskId?allTasks.find(task=>task.id===rawAlignmentTaskId):null;
    const activeTask=matchedTask&&!matchedTask.isArchive?matchedTask:null;
    const alignmentTaskId=!taskId&&matchedTask?.isArchive?null:rawAlignmentTaskId;
    const plan=isV5(config)?inspectDecisionPlan(root,{task:activeTask,files:databaseFiles,required:Boolean(alignmentTaskId)||databaseFiles.some(rel=>!rel.startsWith('.executionkit/')&&rel!=='TODO.md')}):null;
    const taskSignals={
      ...decisionQualitySignals({surface,changedFilesCount:databaseFiles.length,failedChecks:Number(databaseBlocked)+Number(routeBlocked)+Number(surfaceBlocked)}),
      scopeUnclear:plan?.reasons?.includes('PLAN_SCOPE_UNCLEAR')===true,
      scopeExceeded:plan?.reasons?.includes('PLAN_SCOPE_EXCEEDED')===true,
    };
    const decision=isV5(config)?executeBundledDecision(root,config,{request:{schemaVersion:2,requestId:crypto.randomUUID(),event:'postflight',action:'edit',hostClass:'vps',environment:'development',signals:taskSignals}}):null;
    const decisionBlocked=isV5(config)&&(decision.status!=='AVAILABLE'||decision.enforcement?.mandatoryBlock===true||plan.blocking||Boolean(alignmentTaskId&&!activeTask));
    if(decision)decision.plan=plan;
    if(decision)writeDecisionEvidence(root,{...decision,boundary});
    end('decision-postflight');
    const integrityBlocked=databaseBlocked||routeBlocked||surfaceBlocked||decisionBlocked;
    const deferred={status:'DEFERRED_TO_WAVE_OR_PHASE',boundary};
    const payload={
      schemaVersion:'executionkit-v4-reconciliation/v1',
      status:integrityBlocked?'FAIL':'PASS',
      boundary,
      taskId,
      base,
      identityMode:'FAST_TASK',
      beforeHead:identity.head,
      head:identity.head,
      candidateId:null,
      commit:null,
      preStatusHash:crypto.createHash('sha256').update(JSON.stringify(identity.changedFiles??[])).digest('hex'),
      worktreeFingerprint:identity.worktreeFingerprint,
      systems:{
        test:{...deferred,automatic:false},
        content:{...deferred},
        seo:{...deferred},
        docs:{status:config.documentation?.enabled===true?'DEFERRED_TO_WAVE_OR_PHASE':'DISABLED',write:null,commit:{status:'NOT_APPLICABLE',commit:null}},
        visual:{...deferred},
        ...(decision?{decision:{status:decisionBlocked?'FAIL':'PASS',advice:decision}}:{}),
      },
      productClosure:{schemaVersion:'executionkit-v4-product-closure/v1',status:'DEFERRED_TO_WAVE_OR_PHASE'},
      fabrics:{database,route,surface},
      systemGapTasking:{schemaVersion:'executionkit-v4-system-gap-groups/v1',status:'NOT_APPLICABLE',boundary,results:{},createdOrReopened:0,tracked:0,blockingFindings:0,commit:{status:'NOT_APPLICABLE',commit:null}},
      knowledge:{
        sourceContext:{status:'ON_DEMAND_NATIVE_ONLY'},
        impact:{status:'DEFERRED_TO_WAVE_OR_PHASE'},
        gitRead:{status:'SKIPPED_FAST_TASK'},
        docsContext:{status:'DEFERRED_TO_WAVE_OR_PHASE'},
      },
      blockingSystems:[...(databaseBlocked?['database-fabric']:[]),...(routeBlocked?['route-fabric']:[]),...(surfaceBlocked?['surface-fabric']:[]),...(decisionBlocked?['decision']:[])],
      reviewSystems:[],
      reconciledAt:new Date().toISOString(),
    };
    const file=gateFile(root,boundary);
    fs.writeFileSync(file,JSON.stringify(payload,null,2)+'\n');
    payload.gatePath=path.relative(root,file).split(path.sep).join('/');
    try{
      begin('state-checkpoint');
      const nextPlan=resolveRuntimePlan(root,{boost:false,includeRepositoryContext:false,archiveMode:'index',includeConvergence:false});
      payload.state=writeStateCheckpoint(root,{
        fast:true,
        runtimePlan:nextPlan,
        reason:'v4-task-reconciliation',
        note:'Lightweight task reconciliation '+payload.status+(taskId?' for '+taskId:''),
        nextSafeAction:databaseBlocked?(database.nextCommand??'resolve-database-integrity-findings'):routeBlocked?(route.nextCommand??'resolve-route-integrity-findings'):surfaceBlocked?(surface.nextCommand??'resolve-surface-integrity-findings'):decisionBlocked?'resolve-decision-plan-alignment-findings':'resolve-next-live-action',
        contextHealth:integrityBlocked?'DEGRADED':'HEALTHY',
        evidenceRefs:[payload.gatePath],
      });
    }catch(error){
      payload.status='FAIL';
      payload.blockingSystems=['state'];
      payload.state={status:'FAIL',error:error.message};
    }
    end('state-checkpoint');
    payload.performance={durationMs:Date.now()-startedAt,stages,slowestStage:[...stages].sort((a,b)=>b.durationMs-a.durationMs)[0]?.stage??null};
    fs.writeFileSync(file,JSON.stringify(payload,null,2)+'\n');
    return payload;
  }

  const maintenance=todoMaintenanceStatus(root,config);
  if(maintenance.needed)throw new Error('V4_TODO_MAINTENANCE_REQUIRED: canonical TODO shard maintenance must complete before lifecycle reconciliation: '+maintenance.reasons.map((item)=>'['+item.code+'] '+item.message).join('; '));
  const candidate=boundary==='release'?currentCandidate(root):null;
  if(boundary==='release')commitGeneratedDocs=false;
  const beforeHead=git(root,['rev-parse','HEAD']).stdout;
  const resolvedBase=git(root,['rev-parse',base],true).stdout||base;
  const preStatus=git(root,['status','--porcelain=v1','--untracked-files=all']).stdout;
  const boundaryDatabaseFiles=[...new Set([
    ...git(root,['diff','--name-only',resolvedBase,'HEAD'],true).stdout.split(/\r?\n/).filter(Boolean),
    ...porcelainFiles(preStatus)
  ])];
  requireBudget(deadlineAt,'database-integrity');
  let stageStarted=Date.now();boundaryProgress(boundary,'database-integrity','STARTED');
  const database=guardDatabaseReferences(root,{files:boundary==='wave'?boundaryDatabaseFiles:null,mode:boundary==='wave'?'changed':'all',autoRefresh:true});
  const databaseBlocked=['FAIL','BLOCKED'].includes(database.status);
  boundaryProgress(boundary,'database-integrity','COMPLETED',stageStarted);
  requireBudget(deadlineAt,'route-integrity');
  stageStarted=Date.now();boundaryProgress(boundary,'route-integrity','STARTED');
  const route=guardRouteReferences(root,{files:boundary==='wave'?boundaryDatabaseFiles:null,mode:boundary==='wave'?'changed':'all',autoRefresh:true});
  const routeBlocked=['FAIL','BLOCKED'].includes(route.status);
  const surface=guardSurfaceIntegrity(root,{files:boundary==='wave'?boundaryDatabaseFiles:null,mode:boundary==='wave'?'changed':'all'});
  const surfaceBlocked=['FAIL','BLOCKED'].includes(surface.status);
  const integrityBlocked=databaseBlocked||routeBlocked||surfaceBlocked;
  boundaryProgress(boundary,'route-integrity','COMPLETED',stageStarted);
  requireBudget(deadlineAt,'product-closure');
  stageStarted=Date.now();boundaryProgress(boundary,'product-closure','STARTED');
  const productClosure=integrityBlocked?{schemaVersion:'executionkit-v4-product-closure/v1',status:'SKIPPED_AFTER_INTEGRITY_GUARD'}:inspectV4ProductClosure(root,{currentTaskId:taskId,autoCreate:boundary!=='release',autoCommit:boundary!=='release'});
  boundaryProgress(boundary,'product-closure','COMPLETED',stageStarted);
  let providerReport={providers:[]};
  let gitKnowledge={decision:{outcome:'SKIPPED_AFTER_INTEGRITY_GUARD'},evidence:[]};
  let sourceKnowledge={decision:{outcome:'SKIPPED_AFTER_INTEGRITY_GUARD'},evidence:[]};
  let impactKnowledge={decision:{outcome:'SKIPPED_AFTER_INTEGRITY_GUARD'},evidence:[]};
  if(!integrityBlocked){
    requireBudget(deadlineAt,'repository-intelligence');
    stageStarted=Date.now();boundaryProgress(boundary,'repository-intelligence','STARTED');
    providerReport=inspectRepositoryProviders(root);
    gitKnowledge=useV4Knowledge(root,{purpose:'git-read',gitArgs:['git','status'],maxBytes:8192,providerReport});
    sourceKnowledge=useV4Knowledge(root,{purpose:'agent-context',maxBytes:config.repositoryIntelligence?.context?.maxBytes??16384,providerReport,task:taskId?{id:taskId}:null});
    impactKnowledge=useV4Knowledge(root,{purpose:'test-impact',base:resolvedBase,providerReport});
    boundaryProgress(boundary,'repository-intelligence','COMPLETED',stageStarted);
  }else boundaryProgress(boundary,'repository-intelligence','SKIPPED',null);
  const productBlocked=integrityBlocked||['GAPS_EXIST','GAPS_TRACKED','GAPS_TASKED','MIGRATION_REQUIRED'].includes(productClosure.status);

  let test={status:'DEFERRED_TO_WAVE_OR_PHASE',boundary,automatic:false};
  let content={status:'DEFERRED_TO_WAVE_OR_PHASE',boundary};
  let seo={status:'DEFERRED_TO_WAVE_OR_PHASE',boundary};
  let docs={status:config.documentation?.enabled===true?'DEFERRED_TO_WAVE_OR_PHASE':'DISABLED'};
  let docsWrite=null,docsCommit={status:'NOT_APPLICABLE',commit:null};
  let docsKnowledge={status:'DEFERRED_TO_WAVE_OR_PHASE'};
  let visual={status:'DEFERRED_TO_WAVE_OR_PHASE',boundary};

  if(!productBlocked){
      if(config.documentation?.enabled===true){
        requireBudget(deadlineAt,'docs');
        stageStarted=Date.now();boundaryProgress(boundary,'docs','STARTED');
        try{
          docsKnowledge=useV4Knowledge(root,{purpose:'docs-context',maxBytes:config.repositoryIntelligence?.context?.maxBytes??16384,providerReport});
          if(boundary==='release'){docsWrite={status:'READ_ONLY_RELEASE'};docs=validateDocumentationFabric(root);}
          else{
            docsWrite=writeDocumentationFabric(root);
            docs=validateDocumentationFabric(root);
            if(commitGeneratedDocs&&docs.status==='PASS')docsCommit=trackedDocsCommit(root,config.documentation.outputRoot,taskId);
          }
        }catch(error){docs={status:'FAIL',ok:false,errors:[{code:'DOCS_RECONCILIATION_FAILED',message:error.message}]};}
        boundaryProgress(boundary,'docs','COMPLETED',stageStarted);
      }

    requireBudget(deadlineAt,'test');
    stageStarted=Date.now();boundaryProgress(boundary,'test','STARTED');
    test=boundary==='release'?releaseTestGate(root,candidate):executeV4Tests(root,{boundary,base:resolvedBase,taskId,deadlineAt});
    boundaryProgress(boundary,'test','COMPLETED',stageStarted);
    const testTimedOut=(test.runs??[]).some((run)=>run?.timedOut===true);
    if(testTimedOut){
      content={status:'SKIPPED_AFTER_TEST_TIMEOUT',boundary};
      seo={status:'SKIPPED_AFTER_TEST_TIMEOUT',boundary};
      if(docs.status==='DEFERRED_TO_WAVE_OR_PHASE')docs={status:'SKIPPED_AFTER_TEST_TIMEOUT',write:null,commit:{status:'NOT_APPLICABLE',commit:null}};
      visual={status:'SKIPPED_AFTER_TEST_TIMEOUT',boundary};
      boundaryProgress(boundary,'remaining-heavy-gates','SKIPPED',null,{reason:'test-timeout'});
    }else{
      requireBudget(deadlineAt,'content');
      stageStarted=Date.now();boundaryProgress(boundary,'content','STARTED');
      content=inspectV4ContentOS(root,{boundary,writeEvidence:true});
      boundaryProgress(boundary,'content','COMPLETED',stageStarted);

      requireBudget(deadlineAt,'seo');
      stageStarted=Date.now();boundaryProgress(boundary,'seo','STARTED');
      seo=runSeo(root,boundary,deadlineAt);
      boundaryProgress(boundary,'seo','COMPLETED',stageStarted);

      requireBudget(deadlineAt,'visual');
      stageStarted=Date.now();boundaryProgress(boundary,'visual','STARTED');
      const visualExecution=boundary==='release'?{status:'READ_ONLY_RELEASE'}:executeVisualBoundary(root,{boundary,base:resolvedBase,deadlineAt,journeyRunId:test.agentic?.visualRunId??null});
      visual=inspectVisualOS(root,{boundary,config});
      visual.execution=visualExecution;
      boundaryProgress(boundary,'visual','COMPLETED',stageStarted);
    }
  }

  const testTimedOut=(test.runs??[]).some((run)=>run?.timedOut===true);
  const classified=integrityBlocked?{status:'FAIL',blocking:[...(databaseBlocked?['database-fabric']:[]),...(routeBlocked?['route-fabric']:[]),...(surfaceBlocked?['surface-fabric']:[])],reviews:[]}:productBlocked?{status:'FAIL',blocking:['product-closure'],reviews:[]}:testTimedOut?{status:'FAIL',blocking:['test'],reviews:[]}:classify({test,content,seo,docs,visual});
  let systemGapTasking={schemaVersion:'executionkit-v4-system-gap-groups/v1',status:'NOT_APPLICABLE',boundary,results:{},createdOrReopened:0,tracked:0,blockingFindings:0,commit:{status:'NOT_APPLICABLE',commit:null}};
  if(['wave','phase'].includes(boundary)&&!productBlocked){
    systemGapTasking=taskV4SystemFindingGroups(root,{
      boundary,
      groups:boundaryFindings({test,content,seo,docs,visual}, boundary),
      currentTaskId:taskId,
      gatePath:'.executionkit/gates/reconcile-'+boundary+'.json',
      autoCommit:true,
    });
  }

  if(['wave','phase'].includes(boundary)&&integrityBlocked){
    const findings=(value,code)=>value.findings?.length?value.findings:[{code,severity:'HIGH',message:value.reason??'Required integrity truth is unavailable'}];
    systemGapTasking=taskV4SystemFindingGroups(root,{boundary,groups:{database:databaseBlocked?findings(database,'DATABASE_TRUTH_UNAVAILABLE'):[],route:routeBlocked?findings(route,'ROUTE_TRUTH_UNAVAILABLE'):[],surface:surfaceBlocked?findings(surface,'SURFACE_TRUTH_UNAVAILABLE'):[]},currentTaskId:taskId,gatePath:'.executionkit/gates/reconcile-'+boundary+'.json',autoCommit:true});
  }
  const identity=captureV4WorktreeIdentity(root);
  const decisionAdvice=boundaryDecision(root,config,{boundary,changedFilesCount:boundaryDatabaseFiles.length,failedChecks:classified.blocking.length,deadlineAt,surface,visual});
  if(decisionAdvice.enforcement?.mandatoryBlock){classified.status='FAIL';classified.blocking.push('decision-policy');}
  const payload={
    schemaVersion:'executionkit-v4-reconciliation/v1',
    status:classified.status,
    boundary,
    taskId,
    base,
    identityMode:'DEEP',
    beforeHead,
    head:identity.head,
    candidateId:candidate?.candidateId??null,
    commit:candidate?.commit??null,
    preStatusHash:crypto.createHash('sha256').update(preStatus).digest('hex'),
    worktreeFingerprint:identity.worktreeFingerprint,
    systems:{test,content,seo,docs:{...docs,write:docsWrite,commit:docsCommit},visual,...(isV5(config)?{decision:{status:decisionAdvice.enforcement?.mandatoryBlock?'FAIL':decisionAdvice.status==='AVAILABLE'?'PASS':'FAIL',advice:decisionAdvice}}:{})},
    fabrics:{database,route,surface},
    productClosure,
    systemGapTasking,
    knowledge:{
      advisory:decisionAdvice,
      sourceContext:{decision:sourceKnowledge.decision,evidence:sourceKnowledge.evidence},
      impact:{decision:impactKnowledge.decision,evidence:impactKnowledge.evidence},
      gitRead:{decision:gitKnowledge.decision,evidence:gitKnowledge.evidence},
      docsContext:docsKnowledge.status==='OK'?{decision:docsKnowledge.decision,evidence:docsKnowledge.evidence}:docsKnowledge,
    },
    blockingSystems:classified.blocking,
    reviewSystems:classified.reviews,
    reconciledAt:new Date().toISOString(),
  };
  const file=gateFile(root,boundary);
  fs.writeFileSync(file,JSON.stringify(payload,null,2)+'\n');
  payload.gatePath=path.relative(root,file).split(path.sep).join('/');

  try{
    payload.state=writeStateCheckpoint(root,{
      reason:'v4-'+boundary+'-reconciliation',
      note:'Reconciliation '+payload.status+(taskId?' for '+taskId:''),
      nextSafeAction:payload.status==='PASS'?'resolve-next-live-action':'resolve-reconciliation-findings',
      contextHealth:payload.status==='PASS'?'HEALTHY':'DEGRADED',
      evidenceRefs:[payload.gatePath,test.gatePath].filter(Boolean),
    });
  }catch(error){
    payload.status='FAIL';
    payload.blockingSystems=[...new Set([...payload.blockingSystems,'state'])];
    payload.state={status:'FAIL',error:error.message};
  }
  fs.writeFileSync(file,JSON.stringify(payload,null,2)+'\n');
  return payload;
}

export function reconciliationStatus(root,{boundary='task'}={}){
  root=path.resolve(root);
  const file=gateFile(root,boundary);
  if(!fs.existsSync(file))return {status:'MISSING',current:false,gate:null};
  let gate;
  try{gate=JSON.parse(fs.readFileSync(file,'utf8'));}
  catch(error){return {status:'INVALID',current:false,error:error.message,gate:null};}

  let head=null,fingerprint=null;
  try{
    const identity=boundary==='task'&&['FAST_TASK','FAST_TASK_METADATA'].includes(gate.identityMode)
      ? captureV4FastWorktreeIdentity(root)
      : captureV4WorktreeIdentity(root);
    head=identity.head;
    fingerprint=identity.worktreeFingerprint;
  }catch{}

  let candidateCurrent=true,candidateId=null,candidateCommit=null;
  if(boundary==='release'){
    try{
      const candidate=currentCandidate(root);
      candidateId=candidate.candidateId;
      candidateCommit=candidate.commit;
      candidateCurrent=gate.candidateId===candidate.candidateId&&gate.commit===candidate.commit;
    }catch{candidateCurrent=false;}
  }
  const current=Boolean(head&&gate.head===head&&gate.worktreeFingerprint&&gate.worktreeFingerprint===fingerprint&&candidateCurrent);
  return {status:gate.status,current,head,gateHead:gate.head??null,fingerprint,gateFingerprint:gate.worktreeFingerprint??null,candidateCurrent,candidateId,candidateCommit,gate};
}
