#!/usr/bin/env node
import path from 'node:path';
import { existsSync,readFileSync,lstatSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  CLI_VERSION,
  CLI_SYSTEM_COUNT,
  HELP_ALIASES,
  VERSION_ALIASES,
  GROUPED_COMMANDS,
  HELP_USAGE,
  availableCommands,
  usageForCommand,
  findCommandSpec,
  cliInputErrorCode
} from '../lib/v4-cli-contract.mjs';

import { projectCliCommand } from '../lib/v4-cli-entry.mjs';

import { compactCliResult,renderHumanCli } from '../lib/cli-output.mjs';
import {spawnBoundedSync} from '../lib/bounded-process.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2);
const rawCommand=args.shift()??'help';
const isPathToken=(token)=>Boolean(token)&&(token==='.'||token==='..'||token.includes('/')||token.includes('\\'));
let command=HELP_ALIASES.includes(rawCommand)?'help':VERSION_ALIASES.includes(rawCommand)?'version':rawCommand;
const grouped=GROUPED_COMMANDS;
const helpUsage=HELP_USAGE;
let helpTarget=null;
if(command==='help'&&args[0]&&!args[0].startsWith('-')&&!isPathToken(args[0])){
  helpTarget=args.shift();
}
const commandHelpRequested=Boolean(helpTarget)||HELP_ALIASES.includes(args[0]??'')||args.some(arg=>arg==='--help'||arg==='-h')||grouped.has(command)&&args[1]==='help';
if(helpTarget)command=helpTarget;
if(commandHelpRequested&&HELP_ALIASES.includes(args[0]??''))args.shift();
const cmdSpec=findCommandSpec(command);
const canTakeSub=grouped.has(command)&&args[0]&&!args[0].startsWith('--')&&!isPathToken(args[0])&&(!commandHelpRequested||cmdSpec?.subcommands?.includes(args[0]));
const rawSub=canTakeSub?args.shift():null;
const sub=command==='test'&&['run','target'].includes(rawSub)?'task':rawSub;
if(commandHelpRequested&&HELP_ALIASES.includes(args[0]??''))args.shift();
const serviceAction=command==='launch'&&sub==='service'&&args[0]&&!args[0].startsWith('--')&&!isPathToken(args[0])?args.shift():null;
const doctorAction=command==='doctor'&&args[0]&&['review','cli-audit','distribution','bootstrap'].includes(args[0])?args.shift():null;
const isDbLookupArg=command==='db'&&['table','column','model'].includes(sub)&&args[0]&&!args[0].startsWith('--')&&!isPathToken(args[0])&&!(args[1]&&!args[1].startsWith('--')&&!isPathToken(args[1])&&sub!=='column')&&!(sub==='column'&&args[2]&&!args[2].startsWith('--'));
const root=path.resolve(!isDbLookupArg&&args[0]&&!args[0].startsWith('--')?args.shift():'.');
const invalidAction=grouped.has(command)&&sub&&!cmdSpec?.subcommands.includes(sub);
const has=(flag)=>args.includes(`--${flag}`);
const value=(name,fallback=null)=>{const eq=args.find((x)=>x.startsWith(`--${name}=`));if(eq)return eq.slice(name.length+3);const i=args.indexOf(`--${name}`);if(i<0)return fallback;const next=args[i+1];return next&&!next.startsWith('--')?next:fallback;};
const values=(name)=>{const out=[];for(let i=0;i<args.length;i++){const arg=args[i];if(arg.startsWith(`--${name}=`))out.push(arg.slice(name.length+3));else if(arg===`--${name}`&&args[i+1]&&!args[i+1].startsWith('--'))out.push(args[++i]);}return out;};
process.env.EXECUTIONKIT_CLI_PROGRESS_MODE=has('full-output')?'full':has('progress')?'stages':'heartbeat';

const timingEnabled=has('timing')||process.env.EXECUTIONKIT_TIMING==='1';
const cliStartTime=performance.now();
const stageTimings={};
function recordStage(name,fn){
  if(!timingEnabled)return fn();
  const t0=performance.now();
  try{return fn();}
  finally{stageTimings[name]=Math.round((performance.now()-t0)*100)/100;}
}
function attachTiming(result){
  if(!timingEnabled||!result||typeof result!=='object')return result;
  return {
    ...result,
    performance:{
      totalMs:Math.round((performance.now()-cliStartTime)*100)/100,
      stages:{...stageTimings}
    }
  };
}

function emit(result,exitCode=null){
  if(result&&typeof result==='object'&&existsSync(path.join(root,'.executionkit/bin/ek.cjs'))){
    const cliEntry=projectCliCommand();
    result={...result,cliEntry,...(typeof result.nextCommand==='string'?{nextCommand:result.nextCommand.replace(/^executionkit\b/,cliEntry)}:{})};
  }
  const output=compactCliResult(attachTiming(result),{root,command,full:has('full-output')});
  const human=has('human')||(process.stdout.isTTY&&!has('json'));
  console.log(human?renderHumanCli(output,{color:process.stdout.isTTY&&!process.env.NO_COLOR}):JSON.stringify(output));if(exitCode!==null)process.exitCode=exitCode;
}
async function forward(script,argv=[],{defaultTimeoutMs=null}={}){
  const {resolveNodeBinary}=await import('../lib/v4-platform.mjs');
  const nodeBinary=resolveNodeBinary();
  const timeoutMs=Number(value('timeout-ms',defaultTimeoutMs??(['audit','test','launch'].includes(command)?600000:120000)));
  if(!Number.isFinite(timeoutMs)||timeoutMs<1000||timeoutMs>3600000)throw Error('CLI helper timeout must be 1000..3600000ms');
  const result=spawnBoundedSync(nodeBinary,[path.join(here,script),...argv],{cwd:root,encoding:'utf8',timeoutMs,maxBuffer:16*1024*1024,forwardProgress:true,progressContext:{operation:command,stage:script}});
  if(result.timedOut){emit({status:'FAIL',code:'CLI_HELPER_TIMEOUT',command,stage:script,timeoutMs,durationMs:result.durationMs,nextCommand:'executionkit '+command+' --help'},1);return;}
  if(result.error){emit({status:'FAIL',code:'CLI_HELPER_FAILED',command,error:result.error.message,nextCommand:'executionkit '+command+' --help'},1);return;}
  if(result.stdout){
    try{const payload=JSON.parse(result.stdout);if(result.status!==0&&payload&&typeof payload==='object'){if(!payload.status||['PASS','OK','CURRENT','VALID','VALIDATED','COMPLETED','AVAILABLE','INSTALLED'].includes(payload.status))payload.status='FAIL';payload.ok=false;payload.exitCode=result.status;payload.error??=String(result.stderr||'helper exited unsuccessfully').slice(-1200);}emit(payload,result.status??1);}
    catch{if(has('full-output'))process.stdout.write(result.stdout);else emit({status:result.status===0?'COMPLETED':'FAIL',exitCode:result.status,outputTail:result.stdout.slice(-1600)},result.status??1);}
  }else emit({status:result.status===0?'COMPLETED':'FAIL',code:result.status===0?'CLI_HELPER_COMPLETED':'CLI_HELPER_FAILED',command,stage:script,exitCode:result.status,error:result.status===0?null:String(result.stderr||result.error?.message||'helper exited without a result').slice(-1200)},result.status??1);
  process.exitCode=result.status??1;
}

try{
  if(invalidAction&&!commandHelpRequested)throw Error('Unknown '+command+' action: '+sub);
  if(command==='version'){
    emit({schemaVersion:'executionkit-v4-cli/v1',status:'OK',version:CLI_VERSION},0);
  } else if(command==='help'&&!commandHelpRequested){
    emit({
      schemaVersion:'executionkit-v4-cli/v1',
      status:'OK',
      mcp:'DISABLED',
      systems:CLI_SYSTEM_COUNT,
      version:CLI_VERSION,
      commands:availableCommands(),
      usage:helpUsage
    },0);
  } else if(commandHelpRequested){
    const usage=usageForCommand(command);
    if(!usage.length)throw new Error(`Unknown ExecutionKit v4 command: ${command}`);
    emit({
      schemaVersion:'executionkit-v4-cli/v1',
      status:'OK',
      command,
      version:CLI_VERSION,
      usage
    },0);
  } else if(['start','status','next'].includes(command)){
    const deep=has('deep');
    const [
      {buildV4ExecutionEnvelope,validateV4Envelope},
      {compactExecutionEnvelope,withContextBudget}
    ]=await Promise.all([
      import('../lib/v4-kernel.mjs'),
      import('../lib/v4-context-economy.mjs')
    ]);
    let inspectV4Activation=null,inspectV4ProductClosure=null;
    if(deep){
      [{inspectV4Activation},{inspectV4ProductClosure}]=await Promise.all([
        import('../lib/v4-activation.mjs'),
        import('../lib/v4-product-closure.mjs')
      ]);
    }
    const activation=deep
      ? recordStage('activation',()=>inspectV4Activation(root))
      : {schemaVersion:'executionkit-v4-activation/v1',status:'DEFERRED_FAST_PATH'};
    const productClosure=deep
      ? recordStage('productClosure',()=>inspectV4ProductClosure(root,{autoCreate:false,autoCommit:false,persist:false}))
      : {schemaVersion:'executionkit-v4-product-closure/v1',status:'DEFERRED_TO_BOUNDARY'};
    let envelope=recordStage('kernelEnvelope',()=>buildV4ExecutionEnvelope(root,{
      host:value('host','antigravity'),
      boost:has('boost'),
      boundary:value('boundary','task'),
      forceRefresh:has('force')||has('force-refresh'),
      fast:!deep,
    }));
    let autoDelegation=null;
    if(['start','next'].includes(command)&&envelope.hostAction==='PREPARE_NATIVE_SUBAGENTS'){
      const nonDelegationBlockers=(envelope.blockers??[]).filter((item)=>item.code!=='V4_AGENT_DELEGATION_REQUIRED');
      if(nonDelegationBlockers.length===0){
        try{
          const {prepareV4AgentExecution}=await import('../lib/v4-agent-runtime.mjs');
          autoDelegation=recordStage('autoDelegation',()=>prepareV4AgentExecution(root,{boost:has('boost'),apply:true}));
          envelope=recordStage('kernelEnvelopeAfterDelegation',()=>buildV4ExecutionEnvelope(root,{
            host:value('host','antigravity'),
            boost:has('boost'),
            boundary:value('boundary','task'),
            forceRefresh:false,
            fast:!deep,
          }));
        }catch(error){
          autoDelegation={schemaVersion:'executionkit-v4-agent-runtime/v1',status:'AUTO_DELEGATION_BLOCKED',error:error.message,required:true};
        }
      }
    }
    const validation=recordStage('envelopeValidation',()=>validateV4Envelope(envelope));
    const hostHandoff=validation.status==='PASS'&&envelope.hostDirective?.required===true&&['SPAWN_NATIVE_SUBAGENTS','COLLECT_AGENT_RESULTS'].includes(envelope.hostDirective.action);
    const outputEnvelope=deep?envelope:compactExecutionEnvelope(envelope);
    const compactAutoDelegation=!deep&&autoDelegation?{
      status:autoDelegation.status,
      required:autoDelegation.required??false,
      hostAction:autoDelegation.hostAction??null,
      claims:(autoDelegation.claims??[]).map((claim)=>({claimId:claim.claimId,taskId:claim.taskId}))
    }:autoDelegation;
    let sessionCollaboration=null;
    if(command==='start'){
      try{
        const os=await import('node:os');
        if(!process.env.NODE_TEST_CONTEXT&&!path.resolve(root).startsWith(path.resolve(os.tmpdir()))){
          const {syncGlobalHostContract}=await import('../lib/v4-platform.mjs');
          syncGlobalHostContract(null,{apply:true,version:CLI_VERSION});
        }
      }catch{}
      try{
        const {loadConfig}=await import('../lib/execution-model.mjs');
        const {config:startCfg}=loadConfig(root);
        const collabOn=startCfg?.executionCollaboration?.enabled===true||process.env.EXECUTIONKIT_COLLABORATION_ENABLED==='1';
        const signalsOn=startCfg?.executionSignals?.enabled===true||process.env.EXECUTIONKIT_SIGNALS_ENABLED==='1';
        if(collabOn||signalsOn){
          const {runSafeBoundaryExecutionHook}=await import('../lib/execution-signals.mjs');
          const hook=await runSafeBoundaryExecutionHook(root,{
            config:startCfg,
            boundary:'session-start',
            boundaryKey:'session-start:'+String(envelope?.head??'head').slice(0,12)
          });
          if(collabOn)sessionCollaboration=hook.collaboration;
        }
      }catch{}
    }
    const payload={
      ...outputEnvelope,
      hostAwaitingAction:hostHandoff,
      ...(compactAutoDelegation?{autoDelegation:compactAutoDelegation}:deep?{autoDelegation:null}:{}),
      ...(sessionCollaboration?{collaboration:sessionCollaboration}:{}),
      activation:deep?activation:{status:'DEFERRED_FAST_PATH'},
      productClosure:deep?productClosure:{status:'DEFERRED_TO_BOUNDARY'},
      envelopeValidation:validation
    };
    const response=deep
      ? {...payload,contextPolicy:{mode:'DEEP_EXPLICIT',reuseEnvelope:true,rerunAfterEveryEdit:false,resourceLoading:'ON_DEMAND',taskLoading:'EXACT_BLOCK_PREFERRED'}}
      : withContextBudget(payload);
    emit(response,validation.status!=='PASS'?1:hostHandoff?0:envelope.blocked?2:0);
  } else if(command==='activation'){
    const {applyV4Activation,inspectV4Activation}=await import('../lib/v4-activation.mjs');
    const action=sub??'status';
    if(action==='status')emit(inspectV4Activation(root),0);
    else if(action==='apply'){
      const result=applyV4Activation(root,{commit:!has('no-commit')});
      emit(result,result.status==='ACTIVE'?0:2);
    } else throw new Error('Unknown activation action: '+action);
  } else if(command==='boundary'){
    const {runV4Boundary}=await import('../lib/v4-boundary.mjs');
    const action=sub??'wave';
    if(!['wave','phase'].includes(action))throw new Error('Unknown boundary action: '+action);
    const result=recordStage('boundary',()=>runV4Boundary(root,{boundary:action,base:value('base','HEAD~1'),timeoutMs:Number(value('timeout-ms','0'))||null}));
    emit(result,result.status==='PASS'?0:result.status==='REVIEW_REQUIRED'?2:1);
  } else if(command==='control-plane'){
    const {inspectV4ControlPlane,verifyV4ExactHead}=await import('../lib/v4-control-plane.mjs');
    const action=sub??'status';
    if(action==='status'){
      const result=inspectV4ControlPlane(root);emit(result,result.status==='FAIL'?1:0);
    } else if(action==='verify-head'){
      const expected=value('expected');
      if(!expected)throw new Error('control-plane verify-head requires --expected <40-char-sha>');
      const result=verifyV4ExactHead(root,expected);emit(result,result.status==='PASS'?0:1);
    } else throw new Error('Unknown control-plane action: '+action);
  } else if(command==='platform'){
    const action=sub??'status';
    if(action==='provision'){
      const {provisionV4PortableBinary}=await import('../lib/v4-portable-install.mjs');
      const result=await provisionV4PortableBinary(root,{source:value('source')});
      emit(result,0);
    }else if(action==='status'){
      const {inspectV4Platform}=await import('../lib/v4-platform.mjs');
      const result=inspectV4Platform(root);emit(result,result.status==='PASS'?0:1);
    }else if(action==='sync-global'){
      const {syncGlobalHostContract}=await import('../lib/v4-platform.mjs');
      const result=syncGlobalHostContract(root,{
        targetPath:value('target'),
        secondaryTargetPath:value('secondary-target'),
        apply:has('apply')&&!has('dry-run')
      });
      emit(result,result.status==='SYNCHRONIZED'||result.status==='IN_SYNC'?0:result.status==='DRIFT_DETECTED'||result.status==='MISSING_TARGET'||result.status==='TARGET_MISSING'?0:1);
    }else throw new Error('Unknown platform action: '+action);
  } else if(command==='systems'){
    const {inspectV4Systems}=await import('../lib/v4-systems-status.mjs');
    const action=sub??'status';
    if(action!=='status')throw new Error('Unknown systems action: '+action);
    const result=inspectV4Systems(root);
    emit(result,result.status==='PASS'?0:1);
  } else if(command==='product'){
    const action=sub??'status';
    if(action==='status'){
      const {inspectV4ProductClosure}=await import('../lib/v4-product-closure.mjs');
      emit(inspectV4ProductClosure(root,{autoCreate:false,autoCommit:false,persist:false}),0);
    } else if(action==='reconcile'){
      const {inspectV4ProductClosure}=await import('../lib/v4-product-closure.mjs');
      const result=inspectV4ProductClosure(root,{currentTaskId:value('task'),autoCreate:true,autoCommit:!has('no-commit')});
      emit(result,result.status==='GAPS_EXIST'?2:0);
    } else if(action==='discover'){
      const {discoverProduct}=await import('../lib/discovery-model.mjs');
      emit(discoverProduct(root),0);
    } else if(action==='components'){
      const {inspectComponentSystem}=await import('../lib/component-model.mjs');
      const result=inspectComponentSystem(root);
      emit(result,result.status==='FAIL'?1:0);
    } else throw new Error('Unknown product action: '+action);
  } else if(command==='todo'){
    const action=sub??'status';
    if(action==='archive'){
      await forward('archive-todo.mjs',[root,'--json',...args]);
    } else {
      const [{loadConfig},{completeCanonicalTask,maintainTodoAuthority,todoMaintenanceStatus}]=await Promise.all([
        import('../lib/execution-model.mjs'),
        import('../lib/todo-maintenance.mjs')
      ]);
      const {config}=loadConfig(root);
      if(action==='status')emit(todoMaintenanceStatus(root,config),0);
      else if(action==='maintain'||action==='migrate'){
        const result=maintainTodoAuthority(root,config,{apply:has('apply')});
        emit(result,result.status==='BLOCKED'?2:0);
      } else if(action==='complete'){
        const taskId=value('task');
        if(!taskId)throw new Error('todo complete requires --task <id>');
        const runReconcile=!has('no-reconcile');
        const reconcileFn=runReconcile?(await import('../lib/reconcile-runner.mjs')).runBoundedReconciliation:null;
        const result=completeCanonicalTask(root,config,{
          taskId,
          verifyCommand:value('verify'),
          targetStatus:value('status','ACCEPTED'),
          evidence:value('evidence'),
          apply:!has('dry-run'),
          runReconcile,
          reconcileFn
        });
        emit(result,result.ok?0:2);
      } else throw new Error('Unknown todo action: '+action);
    }
  } else if(command==='upgrade-revalidation'){
    const action=sub??'status';
    if(action==='status'){
      const {upgradeRevalidationStatus}=await import('../lib/v4-upgrade-revalidation-status.mjs');
      const result=upgradeRevalidationStatus(root);
      emit(result,result.blocking?2:0);
    } else if(action==='plan'){
      const {planUpgradeRevalidation}=await import('../lib/v4-upgrade-revalidation.mjs');
      const result=planUpgradeRevalidation(root);
      emit(result,result.blocking?2:0);
    } else if(action==='run'){
      const {runUpgradeRevalidation}=await import('../lib/v4-upgrade-revalidation.mjs');
      const result=runUpgradeRevalidation(root,{apply:!has('dry-run'),autoTask:!has('no-task'),allChecks:has('all-checks'),progress:has('progress'),timeoutMs:value('timeout-ms')??undefined});
      emit(result,result.ok?0:2);
    } else throw new Error('Unknown upgrade-revalidation action: '+action);
  } else if(command==='proof'){
    const {sealTaskEvidence,taskProofStatus}=await import('../lib/task-proof.mjs');
    const action=sub??'status';
    if(action==='status'){
      const result=taskProofStatus(root,{taskId:value('task'),includeArchive:!has('active-only')});
      emit(result,result.status==='PASS'?0:2);
    } else if(action==='seal'){
      const taskId=value('task');
      if(!taskId)throw new Error('proof seal requires --task <id>');
      const result=sealTaskEvidence(root,{taskId,apply:has('apply')});
      emit(result,['SEALED','UP_TO_DATE','PLANNED'].includes(result.status)?0:2);
    } else throw new Error('Unknown proof action: '+action);
  } else if(command==='visual'){
    const action=sub??'status';
    if(['status','validate'].includes(action)&&!has('run')&&!has('release')){
      const {inspectVisualOS}=await import('../lib/visual-os.mjs');
      const result=inspectVisualOS(root,{boundary:value('boundary',action==='validate'?'phase':'task')});
      emit(result,result.status==='FAIL'?1:result.status==='REVIEW_REQUIRED'?1:0);
    } else if(action==='boundary'){
      await forward('visual-boundary.mjs',[root,...args]);
    } else await forward('visual-project.mjs',[action,root,...args]);
  } else if(command==='state'){
    const {readStateSnapshot,rehydrateState,validateStateOS,writeStateCheckpoint,amnesiaTest,memoryEnvelope}=await import('../lib/state-model.mjs');
    const action=sub??'status';
    if(action==='status'){
      const validation=validateStateOS(root);
      emit({validation,snapshot:readStateSnapshot(root),rehydration:rehydrateState(root)},validation.errors.length?1:0);
    } else if(action==='rehydrate'){
      const {emitSystemEvent}=await import('../lib/telemetry-events.mjs');
      const result=rehydrateState(root);
      await emitSystemEvent(root,'state.rehydrated',{
        status:result.status,
        safeToResume:result.safeToResume,
        driftFields:(result.drift||[]).map((item)=>item.field),
        taskId:result.live?.lifecycle?.task?.id??null,
        action:result.live?.lifecycle?.action??null,
      },{source:'state-os'});
      emit(result,result.safeToResume?0:2);
    } else if(action==='checkpoint'){
      const {emitSystemEvent}=await import('../lib/telemetry-events.mjs');
      const result=writeStateCheckpoint(root,{
        reason:value('reason','manual'),
        note:value('note'),
        nextSafeAction:value('next-safe-action'),
        contextHealth:value('context-health','UNKNOWN'),
        workingFiles:values('working-file'),
        evidenceRefs:values('evidence'),
      });
      await emitSystemEvent(root,'state.checkpointed',{
        status:result.status,
        reason:result.snapshot?.reason??value('reason','manual'),
        capturedAt:result.snapshot?.capturedAt??null,
        taskId:result.snapshot?.lifecycle?.task?.id??null,
        action:result.snapshot?.lifecycle?.action??null,
        runtimeStatus:result.snapshot?.runtime?.status??null,
        evidenceRefCount:result.snapshot?.evidenceRefs?.length??0,
      },{source:'state-os'});
      emit(result,0);
    } else if(action==='amnesia'){
      const result=amnesiaTest(root);
      emit(result,result.ok?0:2);
    } else if(action==='memory'){
      emit(memoryEnvelope(root),0);
    } else throw new Error(`Unknown state action: ${action}`);
  } else if(command==='knowledge'){
    const action=sub??'status';
    const map={
      status:'status',refresh:'refresh',search:'search',impact:'impact',context:'context',
      freshness:'freshness',read:'read',symbol:'symbol',relation:'relation',
      engineering:'engineering','engineering-stored':'engineering-stored','engineering-refresh':'engineering-refresh',
      'external-ingest':'external-ingest','external-stored':'external-stored','external-search':'external-search'
    };
    if(action==='auto'){
      const {useV4Knowledge}=await import('../lib/v4-knowledge-runtime.mjs');
      const purpose=value('purpose','agent-context');
      const gitArgs=(value('git-args','git;status')||'').split(';').filter(Boolean);
      emit(useV4Knowledge(root,{purpose,query:value('query'),target:value('target'),operation:value('operation','search'),base:value('base','HEAD~1'),gitArgs,maxBytes:Number(value('max-bytes','0'))||null}),0);
    } else if(action==='usage'){
      const {readV4ProviderUsage}=await import('../lib/v4-knowledge-runtime.mjs');
      emit(readV4ProviderUsage(root),0);
    } else if(action==='providers') await forward('repository-providers.mjs',[root,'--json']);
    else if(action in map) await forward('repository-intelligence.mjs',[map[action],root,...args]);
    else throw new Error(`Unknown knowledge action: ${action}. External provider commands were removed from v4.`);
  } else if(command==='guard'){
    const kind=sub??'all';
    const fileList=(value('files','')||'').split(';').map(x=>x.trim()).filter(Boolean);
    let files=null;
    if(kind!=='vhost'&&!has('all')){
      if(fileList.length)files=fileList;
      else{
        const {captureV4FastWorktreeIdentity}=await import('../lib/v4-gate-identity.mjs');
        files=captureV4FastWorktreeIdentity(root).changedFiles;
      }
      if(Array.isArray(files)&&!files.length){
        const prev=spawnSync('git',['diff','--name-only','-z','HEAD~1','HEAD'],{cwd:root,encoding:'utf8',timeout:15000});
        if(!prev.error&&prev.status===0)files=[...new Set(prev.stdout.split('\0').filter(Boolean))];
      }
    }
    const result=kind==='vhost'
      ? (await import('../lib/vhost-guard.mjs')).inspectVhostGuard(root)
      : (await import('../lib/surface-integrity.mjs')).guardSurfaceIntegrity(root,{kind,files,mode:has('all')?'all':'changed'});
    emit(result,['PASS','NOT_APPLICABLE'].includes(result.status)?0:1);
  } else if(command==='decision'){
    const [{loadConfig,loadTasks},{decisionAdapterStatus,executeDecisionAdapter}]=await Promise.all([
      import('../lib/execution-model.mjs'),
      import('../lib/decision-adapter.mjs')
    ]);
    const action=sub??'status',config=loadConfig(root).config;
    if(action==='status')emit(decisionAdapterStatus(root,config),0);
    else if(action==='align'){
      const [{inspectDecisionPlan},{captureV4FastWorktreeIdentity}]=await Promise.all([
        import('../lib/decision/plan-alignment.mjs'),
        import('../lib/v4-gate-identity.mjs')
      ]);
      const taskId=value('task');if(!taskId)throw Error('decision align requires --task');
      const task=loadTasks(root,config,{archiveMode:'index'}).tasks.find(task=>task.id===taskId);
      if(!task)throw Error('Canonical task not found');
      if(has('accept')&&!has('authorize'))throw Error('Plan revision acceptance requires --authorize after reviewing canonical scope/objective');
      const changedFiles=captureV4FastWorktreeIdentity(root).changedFiles??[];
      const result=inspectDecisionPlan(root,{task,files:changedFiles,capture:!has('accept'),accept:has('accept'),expectedGoal:value('expected-goal')});
      emit(result,result.blocking?1:0);
    }
    else if(['advise','refresh'].includes(action)){
      const input=value('input');
      if(action==='advise'&&!input)throw Error('decision advise requires --input <typed-request.json>');
      let request=null;
      if(input){
        const file=path.resolve(root,input);
        if(!existsSync(file))throw Error('DECISION_INPUT_INVALID');
        const stat=lstatSync(file);
        if(stat.isSymbolicLink()||!stat.isFile()||stat.size>12*1024)throw Error('DECISION_INPUT_INVALID');
        try{request=JSON.parse(readFileSync(file,'utf8'));}catch{throw Error('DECISION_INPUT_INVALID');}
      }
      const result=executeDecisionAdapter(root,config,{action,request});
      emit(result,result.enforcement?.mandatoryBlock?1:result.status==='UNAVAILABLE'?2:0);
    }else throw Error('Unknown decision action: '+action);
  } else if(command==='db'){
    const {guardDatabaseReferences,inspectDatabaseIntegrity,refreshDatabaseIntegrity,resolveDatabaseTruth}=await import('../lib/database-integrity.mjs');
    const action=sub??'status';
    if(action==='status'){
      const result=inspectDatabaseIntegrity(root,{fast:!has('deep')});
      emit(result,['CURRENT','NOT_APPLICABLE'].includes(result.status)?0:2);
    } else if(action==='refresh'){
      const result=refreshDatabaseIntegrity(root,{write:true});
      emit(result,['CURRENT','NOT_APPLICABLE'].includes(result.status)?0:1);
    } else if(action==='guard'){
      const fileList=(value('files','')||'').split(';').map((x)=>x.trim()).filter(Boolean);
      const result=guardDatabaseReferences(root,{files:fileList.length?fileList:null,mode:has('all')?'all':'changed',autoRefresh:true});
      emit(result,['PASS','NOT_APPLICABLE'].includes(result.status)?0:result.status==='BLOCKED'?2:1);
    } else if(action==='table'){
      const pos=args.filter((a)=>!a.startsWith('-'));
      const table=value('table',pos[0]??null); if(!table)throw new Error('db table requires a table name or --table <name>');
      const result=resolveDatabaseTruth(root,{table}); emit(result,result.status==='FOUND'?0:2);
    } else if(action==='column'){
      const pos=args.filter((a)=>!a.startsWith('-'));
      const table=value('table',pos[0]??null),column=value('column',pos[1]??null); if(!table||!column)throw new Error('db column requires <table> <column> or --table/--column');
      const result=resolveDatabaseTruth(root,{table,column}); emit(result,result.status==='FOUND'?0:2);
    } else if(action==='model'){
      const pos=args.filter((a)=>!a.startsWith('-'));
      const model=value('model',pos[0]??null); if(!model)throw new Error('db model requires a model name or --model <name>');
      const result=resolveDatabaseTruth(root,{model}); emit(result,result.status==='FOUND'?0:2);
    } else throw new Error('Unknown db action: '+action);
  } else if(command==='route'){
    const {guardRouteReferences,inspectRouteIntegrity,probeRouteHealth,refreshRouteIntegrity}=await import('../lib/route-integrity.mjs');
    const action=sub??'status';
    if(action==='status'){
      const result=inspectRouteIntegrity(root,{fast:!has('deep')});
      emit(result,['CURRENT','NOT_APPLICABLE'].includes(result.status)?0:2);
    } else if(action==='refresh'){
      const result=refreshRouteIntegrity(root,{write:true});
      emit(result,['CURRENT','NOT_APPLICABLE'].includes(result.status)?0:1);
    } else if(action==='guard'){
      const fileList=(value('files','')||'').split(';').map((x)=>x.trim()).filter(Boolean);
      const result=guardRouteReferences(root,{files:fileList.length?fileList:null,mode:has('all')?'all':'changed',autoRefresh:true});
      if(has('probe')&&result.status==='PASS'){
        const probed=await probeRouteHealth(root,{baseUrl:value('base-url'),timeoutMs:Number(value('timeout-ms','5000')),limit:Number(value('limit','250'))});
        emit({...result,httpProbe:probed,status:probed.status==='PASS'?'PASS':'FAIL'},probed.status==='PASS'?0:1);
      }else emit(result,['PASS','NOT_APPLICABLE'].includes(result.status)?0:result.status==='BLOCKED'?2:1);
    } else if(action==='probe'){
      const result=await probeRouteHealth(root,{baseUrl:value('base-url'),timeoutMs:Number(value('timeout-ms','5000')),limit:Number(value('limit','250'))});
      emit(result,result.status==='PASS'||result.status==='NOT_APPLICABLE'?0:1);
    } else throw new Error('Unknown route action: '+action);
  } else if(command==='content'){
    const action=sub??'status';
    if(!['status','discover','validate'].includes(action))throw new Error('Unknown content action: '+action);
    if(action==='discover'){const {discoverContent}=await import('../lib/content-model.mjs');emit(discoverContent(root),0);}
    else{
      const {inspectV4ContentOS}=await import('../lib/v4-content-os.mjs');
      const result=inspectV4ContentOS(root,{boundary:value('boundary','task'),writeEvidence:action==='validate'});
      emit(result,result.status==='FAIL'?1:result.status==='REVIEW_REQUIRED'?2:0);
    }
  } else if(command==='docs'){
    const action=sub??'status';
    const map={status:'status',refresh:'refresh',build:'build',validate:'validate',search:'search'};
    if(!map[action])throw new Error(`Unknown docs action: ${action}`);
    await forward('documentation-fabric.mjs',[map[action],root,...args]);
  } else if(command==='seo'){
    const action=sub??'status';
    if(!['status','validate'].includes(action))throw new Error(`Unknown seo action: ${action}`);
    await forward('seo-os.mjs',[action,root,...args]);
  } else if(command==='audit'){
    const action=sub??'task';
    if(action==='security') await forward('validate-security.mjs',[root,...args]);
    else if(action==='data-safety') await forward('validate-data-safety.mjs',[root,...args]);
    else if(action==='health') await forward('validate-runtime-health.mjs',[root,...args]);
    else if(action==='quality'){
      const [{loadConfig},{validateQuality}]=await Promise.all([
        import('../lib/execution-model.mjs'),
        import('../lib/quality-model.mjs')
      ]);
      const result=validateQuality(root,loadConfig(root).config,{release:has('release')});
      emit(result,result.errors?.length?1:0);
    } else if(action==='storage'){
      const {inspectProductionStorage}=await import('../lib/production-storage-report.mjs');
      const result=inspectProductionStorage(root);
      emit(result,result.status==='FAIL'?1:0);
    } else {
      const boundary=action==='task'?'ad-hoc':action;
      if(!['ad-hoc','wave','phase','release'].includes(boundary))throw new Error(`Unknown audit action: ${action}`);
      await forward('audit-project.mjs',[root,`--boundary=${boundary}`,...args]);
    }
  } else if(command==='test'){
    const action=sub??'task';
    const targets=[...values('target'),...values('files')];
    const filter=value('filter');
    const taskId=value('task');
    if(action==='journeys') {
      if(has('init'))await forward('init-agentic-e2e.mjs',[root,'--platform='+value('platform','web')]);
      else {
        const {executeAgenticJourneys,planAgenticJourneys}=await import('../lib/agentic-e2e.mjs');
        const result=has('dry-run')?planAgenticJourneys(root):executeAgenticJourneys(root,{boundary:value('boundary','phase')});
        emit(result,['PASS','PLANNED','NOT_APPLICABLE'].includes(result.status)?0:result.status==='BLOCKED'?2:1);
      }
    }
    else if(action==='impact') {
      const {useV4Knowledge}=await import('../lib/v4-knowledge-runtime.mjs');
      emit(useV4Knowledge(root,{purpose:'test-impact',base:value('base','HEAD~1')}),0);
    }
    else if(action==='portfolio') {
      const {inspectTestPortfolio}=await import('../lib/test-portfolio.mjs');
      const report=inspectTestPortfolio(root,{base:value('base','HEAD~1')});
      emit(report,report.status==='PASS'?0:2);
    }
    else if(action==='flakes') await forward('analyze-flakes.mjs',[root,...args]);
    else if(action==='select') {
      const {analyzeImpact,selectTests}=await import('../lib/impact-model.mjs');
      const impact=analyzeImpact(root,{base:value('base','HEAD~1')});
      emit({schemaVersion:'executionkit-test-selection/v1',status:'OK',impact,selection:selectTests(root,impact)},0);
    }
    else if(['task','wave','phase'].includes(action)){
      const {executeV4Tests,planV4Tests}=await import('../lib/v4-test-os.mjs');
      const opts={boundary:action,base:value('base','HEAD~1'),taskId,targets,filter};
      const result=has('dry-run')?planV4Tests(root,opts):executeV4Tests(root,opts);
      emit(result,result.status==='PASS'||result.status==='PLANNED'?0:result.status==='BLOCKED'?2:1);
    } else if(action==='release'){
      if(has('dry-run')){
        const {planV4Tests}=await import('../lib/v4-test-os.mjs');
        const result=planV4Tests(root,{boundary:'phase',base:value('base','HEAD~1'),taskId,targets,filter});
        emit({...result,boundary:'release',dryRun:true},result.status==='PLANNED'?0:2);
      } else await forward('test-project.mjs',[root,'--boundary=release',...args]);
    } else throw new Error(`Unknown test action: ${action}`);
  } else if(command==='launch'){
    const action=sub??'status';
    if(action==='providers'||action==='providers-discover'){
      const {discoverExternalServices,inspectProviderReadiness}=await import('../lib/provider-readiness.mjs');
      if(action==='providers-discover')emit(discoverExternalServices(root,{cache:true}),0);
      else {const {loadCandidate}=await import('../lib/evidence-model.mjs');let candidate=null;try{candidate=loadCandidate(root);}catch{}
        const result=inspectProviderReadiness(root,{candidate:{...candidate,artifactSha256:value('artifact-sha256',candidate?.artifactSha256??null)},environment:value('environment','production'),targetId:value('target-id')});emit(result,result.ok?0:1);}
    } else if(action==='mobile'){
      const {executeLaunchMobile}=await import('../lib/launch-mobile.mjs');
      const maxAgeRaw=value('max-evidence-age-ms');
      const result=await executeLaunchMobile(root,{mode:value('mode','status'),kind:value('kind','verify'),expectedCommit:value('expected-commit'),authorize:has('authorize'),job:value('job'),worker:value('worker'),principal:value('principal'),desired:value('desired'),release:value('release'),channel:value('channel'),receipt:value('receipt'),artifact:value('artifact'),artifactFile:value('artifact-file'),outputFile:value('output-file'),handoffFile:value('handoff-file'),testEvidenceFile:value('test-evidence-file'),flutterVersion:value('flutter-version'),skipTests:has('skip-tests'),allowUntested:has('allow-untested'),...(maxAgeRaw!==null?{maxEvidenceAgeMs:Number(maxAgeRaw)}:{}),notes:value('notes',''),digest:value('digest'),operation:value('operation'),adapterRoot:value('adapter-root'),adapterSha:value('adapter-sha'),projectFile:value('project-file'),inputFile:value('input-file')});
      emit(result,['CONNECTED','PLANNED','READY','INSPECTED','BUILT','HANDOFF_READY','IMPORTED','ATTESTED','RELEASE_READY','PUBLISHED','QUEUED','CANCELLED','DIRECTED','RECORDED','COMMAND_SUCCEEDED'].includes(result.status)?0:2);
    } else if(action==='release'){
      if(has('authorize'))throw new Error('launch release is non-deploying; use launch deploy --authorize for production activation');
      await forward('release-project.mjs',[root,...args]);
    } else if(action==='deploy'){
      if(!has('authorize'))throw new Error('launch deploy requires --authorize and always executes the complete exact-candidate release pipeline');
      await forward('release-project.mjs',[root,...args]);
    } else if(action==='service'){
      const svcAct=serviceAction??'start';
      const serviceArgs=[svcAct,...args];
      const {resolveNodeBinary}=await import('../lib/v4-platform.mjs');
      const nodeBinary=resolveNodeBinary();
      const result=spawnSync(nodeBinary,[path.join(here,'launch-service.mjs'),...serviceArgs],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024,stdio:'inherit'});
      if(result.error)throw result.error;
      process.exitCode=result.status??1;
    } else if(action==='verify'){
      const {validateV4ReleaseGates}=await import('../lib/v4-release-gates.mjs');
      const result=validateV4ReleaseGates(root);
      emit(result,result.ok?0:1);
    } else {
      const map={status:'status',plan:'plan-artifact',build:'build-artifact','validate-artifact':'validate-artifact',readiness:'readiness','host-plan':'host-plan','host-check':'host-check',storage:'storage',backup:'backup',rollback:'rollback'};
      if(!map[action])throw new Error(`Unknown launch action: ${action}`);
      if(action==='backup'&&!has('authorize'))throw new Error('launch backup requires --authorize');
      const extra=[map[action],root,...args];
      if(action==='rollback'&&has('authorize')&&!extra.includes('--authorize'))extra.push('--authorize');
      await forward('production-deployment.mjs',extra);
    }
  } else if(command==='agents'){
    const {cleanupV4AgentClaim,collectV4AgentExecution,declineV4AgentExecution,integrateV4AgentClaim,markV4AgentClaimDelegated,prepareV4AgentExecution,reconcileV4AgentClaim,v4AgentRuntimeStatus,writeV4AgentResult}=await import('../lib/v4-agent-runtime.mjs');
    const action=sub??'status';
    if(action==='status') emit(v4AgentRuntimeStatus(root),0);
    else if(action==='plan') emit(prepareV4AgentExecution(root,{boost:has('boost'),apply:false}),0);
    else if(action==='run') emit(prepareV4AgentExecution(root,{boost:has('boost'),apply:true,retrySpawn:has('retry-spawn')}),0);
    else if(action==='delegated') { const claim=value('claim'); if(!claim)throw new Error('--claim is required for agents delegated'); emit(markV4AgentClaimDelegated(root,claim,{spawnTool:value('spawn-tool'),workerId:value('worker-id')}),0); }
    else if(action==='decline') emit(declineV4AgentExecution(root,{reason:value('reason','HOST_SPAWN_UNAVAILABLE')}),0);
    else if(action==='collect') emit(collectV4AgentExecution(root),0);
    else if(action==='integrate'){
      const claim=value('claim'); if(!claim)throw new Error('--claim is required for agents integrate');
      emit(integrateV4AgentClaim(root,claim,{apply:has('apply')}),0);
    } else if(action==='reconcile'){
      const claim=value('claim'); if(!claim)throw new Error('--claim is required for agents reconcile');
      const result=reconcileV4AgentClaim(root,claim);
      emit(result,result.status==='INTEGRATED'?0:2);
    } else if(action==='cleanup'){
      const claim=value('claim'); if(!claim)throw new Error('--claim is required for agents cleanup');
      emit(cleanupV4AgentClaim(root,claim,{force:has('force')}),0);
    } else if(action==='result'){
      const status=value('status','COMPLETED');
      const verification=(value('verification','')||'').split(';').map((x)=>x.trim()).filter(Boolean);
      const evidenceRefs=(value('evidence','')||'').split(';').map((x)=>x.trim()).filter(Boolean);
      emit(writeV4AgentResult(root,{status,message:value('message'),verification,evidenceRefs}),0);
    } else throw new Error(`Unknown agents action: ${action}`);
  } else if(command==='reconcile'){
    const action=sub??'status';
    if(action==='status'){
      const {reconciliationStatus}=await import('../lib/v4-reconcile.mjs');
      emit(reconciliationStatus(root,{boundary:value('boundary','task')}),0);
    } else if(['task','wave','phase','release'].includes(action)){
      const {runBoundedReconciliation:reconcileV4Lifecycle}=await import('../lib/reconcile-runner.mjs');
      const result=recordStage('reconcileLifecycle',()=>reconcileV4Lifecycle(root,{boundary:action,base:value('base','HEAD~1'),taskId:value('task'),commitGeneratedDocs:!has('no-doc-commit'),timeoutMs:value('timeout-ms')}));
      emit(result,result.status==='PASS'?0:result.status==='REVIEW_REQUIRED'?2:1);
    } else throw new Error('Unknown reconcile action: '+action);
  } else if(['install','update','upgrade','repair'].includes(command)){
    if(has('dry-run')&&(has('apply')||has('auto')))throw new Error('Choose --dry-run or --apply/--auto');
    const [
      {applyV4Installation,doctorV4Installation,planV4Installation,refreshV4TransactionAfterActivation,rollbackV4Installation,summarizeV4Plan},
      {acquireLatestOfficialV4Source},
      {provisionV4PortableBinary},
      {applyV4Activation}
    ]=await Promise.all([
      import('../lib/v4-installer.mjs'),
      import('../lib/v4-source.mjs'),
      import('../lib/v4-portable-install.mjs'),
      import('../lib/v4-activation.mjs')
    ]);
    const explicitSource=value('source');
    const sourceResolution=explicitSource?{mode:'EXPLICIT_DEVELOPMENT_SOURCE',sourceSnapshot:path.resolve(explicitSource)}:{mode:'OFFICIAL_MAIN',...acquireLatestOfficialV4Source(root)};
    const plan=planV4Installation(root,{source:sourceResolution.sourceSnapshot,sourceCommit:sourceResolution.resolvedCommit??null,operation:command,targetVersion:CLI_VERSION.startsWith('5.')?CLI_VERSION:'4.1.0'});
    const applying=has('apply')||has('auto');
    let core=applying?applyV4Installation(plan,{expectedPlanId:value('plan-id'),allowDirty:has('allow-dirty')}):summarizeV4Plan(plan);
    let portable=null,activation=null;
    if(applying&&process.platform==='linux'&&/^[a-f0-9]{40}$/.test(plan.sourceCommit??'')){
      try{portable=await provisionV4PortableBinary(root,{source:sourceResolution.sourceSnapshot});}
      catch(error){if(core.transaction)rollbackV4Installation(root,core.transaction);throw error;}
    }
    const doctor=applying?doctorV4Installation(root,{mode:'bootstrap',checkUpgradeRevalidation:false}):null;
    if(applying&&doctor?.status==='INSTALLED'){
      activation=applyV4Activation(root,{commit:false});
      if(core.transaction)refreshV4TransactionAfterActivation(root,core.transaction);
      try{
        const os=await import('node:os');
        if(!process.env.NODE_TEST_CONTEXT&&!path.resolve(root).startsWith(path.resolve(os.tmpdir()))){
          const {syncGlobalHostContract}=await import('../lib/v4-platform.mjs');
          syncGlobalHostContract(null,{apply:true,version:CLI_VERSION});
        }
      }catch{}
    }
    const status=applying
      ? (doctor?.status==='INSTALLED'&&activation?.status==='ACTIVE'?'INSTALLED':'INSTALLED_WITH_BLOCKER')
      : core.status;
    emit({
      ...core,
      status,
      portable,
      activation,
      providerTooling:{status:'REMOVED',mode:'NATIVE_ONLY'},
      doctor,
      fullDoctor:{status:applying?'DEFERRED_TO_BOUNDARY':'NOT_RUN',command:'executionkit doctor .'},
      sourceResolution:{mode:sourceResolution.mode,resolvedCommit:sourceResolution.resolvedCommit??null,sourceLocation:sourceResolution.sourceLocation??sourceResolution.sourceSnapshot}
    },status==='INSTALLED'||status==='UP_TO_DATE'||status==='PLANNED'?0:2);
  } else if(command==='self-update'){
    const {applyV4SelfUpdate,discoverV4Update,getFastUpdateStatus}=await import('../lib/v4-update-discovery.mjs');
    const action=sub??'status';
    if(action==='status'){
      const result=getFastUpdateStatus(root);
      emit(result,result.status==='CURRENT'?0:result.status==='UPDATE_AVAILABLE'?1:0);
    } else if(action==='check'){
      const result=discoverV4Update(root,{force:has('force')});
      emit(result,result.status==='CURRENT'?0:result.status==='UPDATE_AVAILABLE'?1:0);
    } else if(action==='apply'){
      const result=await applyV4SelfUpdate(root,{force:has('force'),allowDirty:has('allow-dirty'),dryRun:has('dry-run')});
      emit(result,['UPDATED','UP_TO_DATE','DRY_RUN'].includes(result.status)?0:result.status==='BLOCKED'?1:2);
    } else throw new Error('Unknown self-update action: '+action);
  } else if(command==='doctor'){
    if(has('review')||doctorAction==='review') await forward('review-v5.mjs',[root,...args],{defaultTimeoutMs:600000});
    else if(has('cli-audit')||doctorAction==='cli-audit') await forward('audit-cli.mjs',[...args],{defaultTimeoutMs:600000});
    else if(has('distribution')||doctorAction==='distribution') await forward('validate-seo-distribution.mjs',[root,...args]);
    else {
      const {doctorV4Installation}=await import('../lib/v4-installer.mjs');
      const result=doctorV4Installation(root,{mode:has('bootstrap')||doctorAction==='bootstrap'?'bootstrap':'full'});
      emit(result,result.status==='INSTALLED'?0:1);
    }
  } else if(command==='providers'){
    const action=sub??'status';
    if(['status','doctor'].includes(action))await forward('repository-providers.mjs',[root,'--json']);
    else throw new Error('External provider plan/apply commands were removed from ExecutionKit v4');
  } else if(command==='rollback'){
    const {rollbackV4Installation}=await import('../lib/v4-installer.mjs');
    const id=value('transaction');
    if(!id)throw new Error('--transaction is required for v4 rollback');
    emit(rollbackV4Installation(root,id),0);
  } else throw new Error(`Unknown ExecutionKit v4 command: ${command}`);
}catch(error){
  const code=cliInputErrorCode(error.message);
  console.error(JSON.stringify({
    schemaVersion:'executionkit-v4-cli/v1',
    status:code?'CLI_ERROR':'BLOCKED',
    code:code??'RUNTIME_ERROR',
    error:error.message,
    command,
    ...(code?{usage:usageForCommand(command),availableCommands:code==='UNKNOWN_COMMAND'?availableCommands():undefined}:{}),
  }));
  process.exitCode=code?2:1;
}


