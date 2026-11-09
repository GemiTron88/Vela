import {isV5} from './v5-config.mjs';
import {decisionOSStatus,executeBundledDecision} from './decision-os.mjs';

// The v4 adapter remains a configuration compatibility surface, not a remote
// process or external source loader. Old sourceRoot/sourceCommit/knowledgeSource
// settings are intentionally ignored: all advice uses the bundled deterministic
// engine and the canonical local Knowledge Base. No archived Git repo is needed.
export function decisionAdapterStatus(root,config={}){
  const settings=config.decisionOS;
  if(!isV5(config)&&settings?.enabled!==true)return {
    schemaVersion:'executionkit-decision-adapter/v1',status:'DISABLED',
    advisoryOnly:true,localOnly:true,hotPathCalls:false
  };
  const status=decisionOSStatus(root,config);
  return isV5(config)?status:{...status,compatibility:'V4_BUNDLED_LOCAL',externalCheckout:false};
}
export function executeDecisionAdapter(root,config,{action='advise',request=null}={}){
  if(!isV5(config)&&config.decisionOS?.enabled!==true)return decisionAdapterStatus(root,config);
  const result=executeBundledDecision(root,config,{action,request});
  return isV5(config)?result:{...result,compatibility:'V4_BUNDLED_LOCAL',externalCheckout:false};
}

export function validateDecisionSource(root,{sourceRoot,sourceCommit}={}){
  if(typeof sourceRoot!=='string'||! /^[a-f0-9]{40}$/.test(sourceCommit??''))throw Error('DECISION_EXACT_SOURCE_REQUIRED');
  throw Error('DECISION_EXTERNAL_SOURCE_RETIRED');
}
