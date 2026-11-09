// Project plan stays local. Only abstract drift booleans reach the generic engine.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {resolveDerivedPath} from '../derived-state.mjs';
import {taskOwnership} from '../parallel-execution.mjs';
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function activeDecisionTaskId(root){
  const file=resolveDerivedPath(root,'.executionkit/decision/active-plan.json','Decision active context',{file:true});
  if(!fs.existsSync(file))return null;
  if(fs.statSync(file).size>4096)throw Error('DECISION_ACTIVE_CONTEXT_INVALID');
  const value=JSON.parse(fs.readFileSync(file,'utf8'));
  if(value.schemaVersion!==1||typeof value.taskId!=='string')throw Error('DECISION_ACTIVE_CONTEXT_INVALID');
  return value.taskId;
}
function safeScope(value){return typeof value==='string'&&!/[\s\\]/.test(value)&&!value.startsWith('/')&&!value.split('/').includes('..')&&(value==='.'||/^[A-Za-z0-9._/*-]+$/.test(value));}
function matchScope(rel,scope){
  if(scope==='.'||rel===scope||rel.startsWith(scope+'/'))return true;
  if(scope.includes('*')){
    const regexStr='^'+scope.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*\*\//g,'\0').replace(/\*\*/g,'\x01').replace(/\*/g,'[^/]*').replace(/\0/g,'(?:.*/)?').replace(/\x01/g,'.*')+'(?:/.*)?$';
    return new RegExp(regexStr).test(rel);
  }
  return false;
}
function taskObjective(task){
  const lines=String(task?.body??'').replaceAll('\r\n','\n').split('\n');
  const start=lines.findIndex(line=>/^\s*Objective:/.test(line));
  if(start>=0){
    const objective=[lines[start].replace(/^\s*Objective:[ \t]*/, '')];
    for(const line of lines.slice(start+1)){
      if(/^\s*(?:<!--|#{1,6}\s|-\s+[A-Za-z][^:\n]*:)/.test(line))break;
      objective.push(line);
    }
    const parsed=objective.map(line=>line.trim()).join('\n').trim();
    if(parsed)return parsed;
  }
  return String(task?.objective??task?.description??'').trim();
}
export function inspectDecisionPlan(root,{task=null,files=[],capture=false,accept=false,expectedGoal=null,required=false}={}){
  if(!task)return required?{status:'REVIEW_REQUIRED',blocking:true,reasons:['PLAN_TASK_CONTEXT_REQUIRED'],nextCommand:'executionkit start .'}:{status:'NOT_APPLICABLE',blocking:false,reason:'NO_ACTIVE_CANONICAL_TASK'};
  const objective=taskObjective(task);
  const ownership=task.meta?.['Decision Scope']?String(task.meta['Decision Scope']).split(/[,;\n]/).map(p=>p.trim().replace(/^`+|`+$/g,'').trim()).filter(Boolean):taskOwnership(task);
  const scopes=ownership.filter(safeScope).map(s=>s==='.'?'.':s.replace(/^\.\//,'').replace(/\/\*\*$/,'').replace(/\/$/,''));
  const goalDigest=hash({title:task.title,objective,contract:task.meta?.Contract??null,depends:task.meta?.Depends??null,constraints:task.meta?.Constraints??null,ownership});
  const file=resolveDerivedPath(root,'.executionkit/decision/plan-'+hash(task.id).slice(0,20)+'.json','Decision plan baseline',{file:true,createParents:capture||accept});
  let previous=null;
  if(fs.existsSync(file)){if(fs.statSync(file).size>4096)throw Error('DECISION_PLAN_RECEIPT_OVERSIZED');previous=JSON.parse(fs.readFileSync(file,'utf8'));if(previous.schemaVersion!==1||previous.taskId!==task.id||! /^[a-f0-9]{64}$/.test(previous.goalDigest??''))throw Error('DECISION_PLAN_RECEIPT_INVALID');}
  const changed=previous&&previous.goalDigest!==goalDigest;
  const unknownScope=scopes.length===0||scopes.length!==ownership.length;
  const outside=files.filter(rel=>!rel.startsWith('.executionkit/')&&rel!==(task.sourcePath??'TODO.md')&&rel!=='TODO.md'&&!scopes.some(scope=>matchScope(rel,scope)));
  if(accept&&expectedGoal!==goalDigest)throw Error('Decision plan approval requires the exact current goal digest');
  if((capture&&!previous||accept)&&!unknownScope){fs.writeFileSync(file,JSON.stringify({schemaVersion:1,taskId:task.id,goalDigest,capturedAt:new Date().toISOString()})+'\n',{mode:0o600});previous={goalDigest};}
  if(capture||accept){const active=resolveDerivedPath(root,'.executionkit/decision/active-plan.json','Decision active context',{file:true,createParents:true});fs.writeFileSync(active,JSON.stringify({schemaVersion:1,taskId:task.id})+'\n',{mode:0o600});}
  const reasons=[...(unknownScope?['PLAN_SCOPE_UNCLEAR']:[]),...(!previous?['PLAN_PREFLIGHT_BASELINE_REQUIRED']:[]),...(changed&&!accept?['PLAN_GOAL_CHANGED']:[]),...(outside.length&&!unknownScope?['PLAN_SCOPE_EXCEEDED']:[])];
  return {schemaVersion:'executionkit-decision-plan/v1',status:reasons.length?'REVIEW_REQUIRED':'PASS',blocking:reasons.length>0,taskId:task.id,goalDigest,reasons,outsideFiles:outside.slice(0,30),outsideFileCount:outside.length,semanticAlignment:'REQUIRES_HUMAN_REVIEW',requiresOwnerReview:reasons.length>0,nextCommand:reasons.length?'executionkit decision align . --task '+task.id:null};
}
