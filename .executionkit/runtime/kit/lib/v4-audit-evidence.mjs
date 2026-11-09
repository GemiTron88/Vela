import { loadConfig } from './execution-model.mjs';
import { doctorV4Installation } from './v4-installer.mjs';
import { v4AgentRuntimeStatus } from './v4-agent-runtime.mjs';
import { rehydrateState } from './state-model.mjs';
import { reconciliationStatus } from './v4-reconcile.mjs';
import { documentationFabricStatus } from './documentation-fabric.mjs';
import { validateProductionDeploymentReadiness } from './production-deployment.mjs';
import { inspectVisualOS } from './visual-os.mjs';
import {isV5} from './v5-config.mjs';
import {executeBundledDecision} from './decision-os.mjs';
import {decisionQualitySignals} from './decision/quality-signals.mjs';
import {guardSurfaceIntegrity} from './surface-integrity.mjs';
import {inspectRepositoryProviders} from './repository-providers.mjs';
import {readV4ProviderUsageHistory} from './v4-knowledge-runtime.mjs';

function finding(code,message,{severity='HIGH',domain='v4-runtime',...extra}={}){return {code,severity,domain,message,...extra};}

export function evaluateV4TenSystemMatrix(systems,{boundary='phase',v5=false,deploymentEnabled=true,docsEnabled=true}={}){
  const allowed={
    execution:new Set(['PASS']),
    agent:new Set(['PASS']),
    state:new Set(['PASS']),
    content:new Set(['PASS','NOT_APPLICABLE']),
    seo:new Set(['PASS','NOT_APPLICABLE']),
    docs:new Set(docsEnabled===false?['PASS','NOT_APPLICABLE','DISABLED']:['PASS']),
    audit:new Set(['RUNNING','PASS']),
    test:new Set(['PASS']),
    launch:new Set(boundary==='release'?(deploymentEnabled===false?['PASS','NOT_APPLICABLE']:['PASS']):['NOT_APPLICABLE']),
    visual:new Set(['PASS','NOT_APPLICABLE']),
  };
  if(v5)allowed.decision=new Set(['PASS']);
  const findings=[];
  for(const [name,accepted] of Object.entries(allowed)){
    const status=String(systems?.[name]?.status??'MISSING').toUpperCase();
    if(!accepted.has(status))findings.push(finding(
      (v5?'V5_ELEVEN_SYSTEM_':'V4_TEN_SYSTEM_')+name.toUpperCase()+'_NOT_PASS',
      'System audit evidence is not acceptable for '+name+': '+status,
      {domain:name+'-os',system:name,status,accepted:[...accepted]}
    ));
  }
  return {status:findings.length?'FAIL':'PASS',findings,systemCount:Object.keys(allowed).length};
}

export function evaluateV4ProviderUsageAudit({providerReport={providers:[]},history={status:'UNUSED',entries:[]},head=null}={}) {
  const findings=[];
  const forbiddenProviders=(providerReport.providers??[]).filter((p)=>['repomix','codegraph','rtk','terrain'].includes(String(p.id).toLowerCase()));
  for(const provider of forbiddenProviders)findings.push(finding('V4_EXTERNAL_PROVIDER_PRESENT','External Repository Intelligence provider is forbidden in v4: '+provider.id,{domain:'knowledge-fabric',provider:provider.id}));
  const currentUsage=(history.entries??[]).filter((entry)=>!head||entry.repositoryHead===head);
  for(const entry of currentUsage){
    for(const provider of entry.externalUsed??[])findings.push(finding('V4_EXTERNAL_PROVIDER_USAGE_FORBIDDEN','External Repository Intelligence provider usage is forbidden in v4: '+provider,{domain:'knowledge-fabric',provider,purpose:entry.purpose??null}));
  }
  return {status:findings.length?'FAIL':'PASS',findings,currentUsage,preferred:[],providers:[]};
}

export function evaluateV4AuditEvidence(root,{boundary='phase',candidate=null,checkUpgradeRevalidation=true}={}){
  const {config}=loadConfig(root);
  if(!/^[45]\./.test(String(config.standardVersion??'')))return {schemaVersion:'executionkit-v4-audit-evidence/v1',status:'NOT_APPLICABLE',checks:[],findings:[],systems:{}};
  if(!['wave','phase','release'].includes(boundary))return {schemaVersion:'executionkit-v4-audit-evidence/v1',status:'NOT_APPLICABLE',checks:[],findings:[],systems:{}};
  const checks=[],findings=[];
  const doctor=doctorV4Installation(root,{checkUpgradeRevalidation});
  checks.push({id:'v4-doctor',status:doctor.status,errorCount:doctor.errors?.length??0});
  if(doctor.status!=='INSTALLED')findings.push(finding('V4_DOCTOR_BLOCKED','v4 installation doctor is not INSTALLED',{details:doctor.errors??[]}));

  const claims=v4AgentRuntimeStatus(root);
  checks.push({id:'v4-agent-runtime',status:claims.activeCount===0?'PASS':'FAIL',activeCount:claims.activeCount});
  if(claims.activeCount)findings.push(finding('V4_AGENT_CLAIMS_ACTIVE','Active Agent OS claims remain at audit boundary',{domain:'agent-os',claims:claims.active}));

  const state=rehydrateState(root);
  checks.push({id:'v4-state',status:state.status});
  if(state.status!=='FRESH')findings.push(finding('V4_STATE_NOT_FRESH','State OS is not FRESH at audit boundary',{domain:'state-os',stateStatus:state.status,drift:state.drift??[]}));

  const reconcile=reconciliationStatus(root,{boundary});
  checks.push({id:'v4-reconciliation',status:reconcile.gate?.status??reconcile.status,current:reconcile.current});
  if(!reconcile.current)findings.push(finding('V4_RECONCILIATION_STALE','Executable '+boundary+' reconciliation gate is missing/stale for the exact current worktree',{domain:'execution-os',reconcileStatus:reconcile.status}));
  if(reconcile.gate?.status!=='PASS')findings.push(finding('V4_RECONCILIATION_NOT_PASS','Executable '+boundary+' reconciliation gate is not PASS',{domain:'execution-os',gateStatus:reconcile.gate?.status??null}));
  if(boundary==='release'&&candidate){
    if(reconcile.gate?.candidateId!==candidate.candidateId||reconcile.gate?.commit!==candidate.commit)findings.push(finding('V4_RECONCILIATION_CANDIDATE_MISMATCH','Release reconciliation is not bound to the exact current candidate',{domain:'launch-os'}));
  }

  const docs=documentationFabricStatus(root);
  checks.push({id:'v4-docs',status:docs.status});
  const docsEnabled=config.documentation?.enabled!==false&&config.v4?.systems?.docs?.enabled!==false&&config.capabilities?.docs!=='NONE';
  if(config.documentation?.enabled===true&&docs.status!=='CURRENT')findings.push(finding('V4_DOCS_STALE','Docs OS source-grounded knowledge base is not CURRENT',{domain:'docs-os',errors:docs.errors??[]}));

  const providerAudit=evaluateV4ProviderUsageAudit({providerReport:inspectRepositoryProviders(root),history:readV4ProviderUsageHistory(root),head:reconcile.head});
  checks.push({id:'v4-repository-intelligence-mode',status:providerAudit.status,mode:'NATIVE_ONLY'});
  findings.push(...providerAudit.findings);

  const deploymentEnabled=config.deployment?.enabled!==false&&config.distributionRepository!==true;
  let launch={status:'NOT_APPLICABLE',ok:true,errors:[]};
  if(boundary==='release'&&deploymentEnabled){
    launch=validateProductionDeploymentReadiness(root);
    checks.push({id:'v4-launch-readiness',status:launch.status});
    if(!launch.ok)findings.push(finding('V4_LAUNCH_NOT_READY','Launch OS production deployment readiness is not PASS',{domain:'launch-os',errors:launch.errors??[]}));
  }

  const embedded=reconcile.gate?.systems??{};
  const independentlyVerifiedVisual=inspectVisualOS(root,{boundary,config});
  checks.push({id:'v4-independent-visual-evidence',status:independentlyVerifiedVisual.status,evidence:independentlyVerifiedVisual.visualEvidence??null});
  const systems={
    execution:{status:reconcile.current&&reconcile.gate?.status==='PASS'?'PASS':'FAIL',evidence:reconcile.gate?.gatePath??('.executionkit/gates/reconcile-'+boundary+'.json')},
    agent:{status:claims.activeCount===0?'PASS':'FAIL',activeClaims:claims.activeCount,hostIntegration:'CLI_ENTRY'},
    state:{status:state.status==='FRESH'?'PASS':'FAIL',evidence:state.snapshot?.capturedAt??null},
    content:{status:embedded.content?.status??'MISSING'},
    seo:{status:embedded.seo?.status??'MISSING'},
    docs:{status:docs.status==='CURRENT'?'PASS':docs.status==='DISABLED'?'DISABLED':'FAIL'},
    audit:{status:'RUNNING',evidence:'current-audit-boundary'},
    test:{status:embedded.test?.status??'MISSING'},
    launch:{status:boundary==='release'&&deploymentEnabled?(launch.ok?'PASS':'FAIL'):'NOT_APPLICABLE'},
    visual:{status:independentlyVerifiedVisual.status},
  };
  const antiFake=guardSurfaceIntegrity(root,{kind:'antifake',mode:'all'});
  checks.push({id:isV5(config)?'v5-independent-antifake':'v4-independent-antifake',status:antiFake.status,findings:antiFake.findings?.length??0});
  if(!['PASS','NOT_APPLICABLE'].includes(antiFake.status))findings.push(finding('PRODUCTION_DATA_AUTHENTICITY_UNRESOLVED','Independent production AntiFake scan is not passing',{domain:'surface-fabric',details:antiFake.findings}));
  if(isV5(config)){
    const surfaceForDecision=reconcile.gate?.fabrics?.surface??antiFake;
    const local=executeBundledDecision(root,config,{request:{schemaVersion:2,requestId:'audit-local-policy',event:boundary,action:'quality_gate',hostClass:'vps',environment:boundary==='release'?'production':'development',signals:decisionQualitySignals({surface:surfaceForDecision,visual:independentlyVerifiedVisual})}});
    systems.decision={status:embedded.decision?.status==='PASS'&&local.status==='AVAILABLE'&&!local.enforcement?.mandatoryBlock?'PASS':'FAIL',reconciliationStatus:embedded.decision?.status??'MISSING',localPolicyStatus:local.status};
  }
  const matrix=evaluateV4TenSystemMatrix(systems,{boundary,v5:isV5(config),deploymentEnabled,docsEnabled});
  findings.push(...matrix.findings);
  // Keep the stable compatibility check ID while enforcing eleven systems in v5.
  checks.push({id:'v4-ten-system-runtime-matrix',status:matrix.status,systems,systemCount:matrix.systemCount});
  const status=findings.some((x)=>['CRITICAL','HIGH'].includes(x.severity))?'FAIL':findings.some((x)=>x.severity==='REVIEW')?'REVIEW_REQUIRED':'PASS';
  return {schemaVersion:'executionkit-v4-audit-evidence/v1',status,boundary,standardVersion:config.standardVersion,checks,findings,systems,repositoryIntelligence:{mode:'NATIVE_ONLY',externalProviders:'REMOVED'},providerUsage:providerAudit,doctor,claims,state:{status:state.status,safeToResume:state.safeToResume},reconciliation:{status:reconcile.status,current:reconcile.current,gateStatus:reconcile.gate?.status??null,candidateCurrent:reconcile.candidateCurrent??null},docs:{status:docs.status},host:{status:'CLI_ENTRY',fresh:null},launch:{status:launch.status,ok:launch.ok}};
}
