export const FAST_CONTEXT_BUDGET_BYTES=12*1024;

function clipped(value,max=512){
  if(value===null||value===undefined)return null;
  const text=String(value);
  return text.length<=max?text:text.slice(0,max-1)+'…';
}
function clean(object){return Object.fromEntries(Object.entries(object).filter(([,value])=>value!==undefined&&value!==null));}

export function compactResourceRefs(resources={}){
  return Object.fromEntries(Object.entries(resources??{}).map(([kind,items])=>[
    kind,
    (Array.isArray(items)?items:[]).map((item)=>clean({id:item?.id??null,path:item?.path??null}))
  ]).filter(([,items])=>items.length));
}

export function compactTaskPayload(task={}){
  const meta=task?.meta??{};
  return clean({
    id:task?.id??null,
    state:task?.state??meta.Status??null,
    semanticState:task?.semanticState??null,
    title:clipped(task?.title,180),
    phase:task?.phase??meta.Phase??null,
    sourcePath:task?.sourcePath??null,
    startLine:task?.startLine??null,
    priority:meta.Priority??task?.priority??null,
    ownership:clipped(task?.ownership??meta.Ownership??meta['Claim Scope']??meta['Code Surfaces']??meta.Files,320),
    contract:clipped(task?.contract??meta.Contract,320),
    verification:clipped(task?.verification??meta.Verification,512),
    upgradeRevalidation:(task?.upgradeRevalidation===true||String(meta['Upgrade Revalidation']??'').trim().toLowerCase()==='true')?true:undefined,
  });
}

export function compactRuntimeEnvelope(runtime={}){
  if(!runtime||typeof runtime!=='object')return runtime;
  const rawBatch=Array.isArray(runtime.batch)?runtime.batch:[];
  const singleMatch=rawBatch.length===1&&runtime.task&&rawBatch[0]?.taskId===runtime.task.id;
  const batch=rawBatch.map((item)=>singleMatch?clean({taskId:item?.taskId??null,action:item?.action??null}):clean({
    taskId:item?.taskId??null,
    title:clipped(item?.title,160),
    action:item?.action??null,
    ownership:clipped(item?.ownership,240),
    sourcePath:item?.sourcePath??null,
    startLine:item?.startLine??null,
    phase:item?.phase??null,
  }));
  const closure=runtime.status==='NO_ACTIONABLE_WORK'&&runtime.closure
    ? clean({closed:runtime.closure.closed,implementationClosed:runtime.closure.implementationClosed,releaseComplete:runtime.closure.release?.complete??null})
    : undefined;
  return clean({
    schemaVersion:runtime.schemaVersion,
    mode:runtime.mode,
    boost:runtime.boost,
    status:runtime.status,
    error:clipped(runtime.error,420),
    task:runtime.task?compactTaskPayload(runtime.task):null,
    action:runtime.action,
    batch,
    batchReason:clipped(runtime.batchReason,240),
    routeId:runtime.routeId,
    supplementIds:Array.isArray(runtime.supplementIds)?runtime.supplementIds:undefined,
    resources:compactResourceRefs(runtime.resources),
    authority:runtime.authority,
    closure,
  });
}

function compactBlocker(item={}){
  return clean({code:item.code,system:item.system,message:clipped(item.message,420),status:item.status});
}
function compactSystems(systems={}){
  return Object.fromEntries(Object.entries(systems??{}).map(([name,value])=>[
    name,
    clean({required:value?.required,status:value?.status,routeId:value?.routeId})
  ]));
}
function compactHostDelegation(item={}){
  return clean({
    claimId:item.claimId,
    taskId:item.taskId,
    worktree:item.worktree,
    branch:item.branch,
    routeId:item.routeId,
    taskRef:item.taskRef,
    claimPath:item.claimPath??'.executionkit/agent-claim.json',
    resultPath:item.resultPath,
    ownedPaths:item.ownedPaths,
    workerPrompt:clipped(item.workerPrompt,650),
    subagentSpec:item.subagentSpec?clean({
      typeName:item.subagentSpec.typeName,
      role:item.subagentSpec.role,
      claimId:item.subagentSpec.claimId,
      taskId:item.subagentSpec.taskId,
      worktree:item.subagentSpec.worktree,
      branch:item.subagentSpec.branch,
      ownedPaths:item.subagentSpec.ownedPaths,
      completeCommand:item.subagentSpec.completeCommand,
      blockedCommand:item.subagentSpec.blockedCommand,
    }):undefined,
    acknowledgeCommand:item.acknowledgeCommand,
    instruction:item.workerPrompt?undefined:clipped(item.instruction,420),
    resourceCounts:item.resources?Object.fromEntries(Object.entries(item.resources).map(([kind,values])=>[kind,Array.isArray(values)?values.length:0])):undefined,
  });
}

export function compactExecutionEnvelope(envelope={}){
  const active=(envelope.agentRuntime?.active??[]).map((item)=>clean({claimId:item.claimId,taskId:item.taskId,status:item.status}));
  const reconciliation=envelope.reconciliation&&envelope.reconciliation.status!=='DEFERRED_FAST_PATH'
    ? clean({status:envelope.reconciliation.status,current:envelope.reconciliation.current})
    : undefined;
  const todoMaintenance=envelope.todoMaintenance?.needed
    ? clean({status:envelope.todoMaintenance.status,needed:true})
    : undefined;
  return clean({
    schemaVersion:envelope.schemaVersion,
    standardTarget:envelope.standardTarget,
    runtimeMode:envelope.runtimeMode,
    cliFirst:envelope.cliFirst,
    mcp:envelope.mcp,
    host:envelope.host,
    hostIntegration:envelope.hostIntegration?clean({status:envelope.hostIntegration.status,fresh:envelope.hostIntegration.fresh}):undefined,
    blocked:Boolean(envelope.blocked),
    blockers:(envelope.blockers??[]).map(compactBlocker),
    runtime:compactRuntimeEnvelope(envelope.runtime),
    agentRuntime:envelope.agentRuntime?clean({activeCount:envelope.agentRuntime.activeCount,hostAction:envelope.agentRuntime.hostAction,hostCapability:envelope.agentRuntime.hostCapability,fallback:envelope.agentRuntime.fallback?{taskId:envelope.agentRuntime.fallback.taskId,reason:envelope.agentRuntime.fallback.reason}:undefined,active}):undefined,
    hostAction:envelope.hostAction,
    hostDirective:envelope.hostDirective?clean({required:envelope.hostDirective.required,action:envelope.hostDirective.action,message:clipped(envelope.hostDirective.message,300)}):undefined,
    hostDelegations:(envelope.hostDelegations??[]).map(compactHostDelegation),
    reconciliation,
    state:envelope.state?clean({status:envelope.state.status,safeToResume:envelope.state.safeToResume,drift:Array.isArray(envelope.state.drift)?envelope.state.drift.slice(0,8):undefined}):undefined,
    knowledge:envelope.knowledge?clean({status:envelope.knowledge.status,trustState:envelope.knowledge.trustState}):undefined,
    systems:compactSystems(envelope.systems),
    visualSummary:envelope.visualSummary?clean({status:envelope.visualSummary.status}):undefined,
    fabrics:envelope.fabrics?{
      route:clean({required:envelope.fabrics.route?.required,status:envelope.fabrics.route?.status,nextCommand:envelope.fabrics.route?.nextCommand}),
      database:clean({required:envelope.fabrics.database?.required,status:envelope.fabrics.database?.status,cacheHit:envelope.fabrics.database?.cacheHit}),
      upgradeRevalidation:clean({status:envelope.fabrics.upgradeRevalidation?.status,blocking:envelope.fabrics.upgradeRevalidation?.blocking}),
      update:clean({status:envelope.fabrics.update?.status}),
    }:undefined,
    docs:envelope.docs?clean({status:envelope.docs.status,enabled:envelope.docs.enabled}):undefined,
    todoMaintenance,
    nextCommand:envelope.nextCommand,
  });
}

export function contextPolicyFor(payload,{budgetBytes=FAST_CONTEXT_BUDGET_BYTES}={}){
  const bytes=Buffer.byteLength(JSON.stringify(payload),'utf8');
  return {
    mode:'COMPACT_HOT_PATH',
    reuseEnvelope:true,
    rerunAfterEveryEdit:false,
    resourceLoading:'LAZY_ON_DEMAND',
    taskLoading:'EXACT_BLOCK_ONLY',
    deepMode:'EXPLICIT_ONLY',
    budgetBytes,
    payloadBytes:bytes,
    estimatedTokens:Math.ceil(bytes/4),
    budgetStatus:bytes<=budgetBytes?'PASS':'OVER_BUDGET',
  };
}

export function withContextBudget(payload,options={}){
  return {...payload,contextPolicy:contextPolicyFor(payload,options)};
}
