import {loadConfig} from './execution-model.mjs';
export const RECONCILE_BUDGETS=Object.freeze({task:30000,wave:300000,phase:600000,release:900000});
export function reconciliationBudget(root,{boundary='task',timeoutMs=null}={}){
  if(!Object.hasOwn(RECONCILE_BUDGETS,boundary))throw Error('Unknown reconciliation boundary');
  const {config}=loadConfig(root);
  const configured=config.v4?.reconcile?.[boundary+'TimeoutMs'];
  const selected=Number(timeoutMs??configured??RECONCILE_BUDGETS[boundary]);
  const minimum=boundary==='task'?1000:60000;
  if(!Number.isFinite(selected)||selected<minimum||selected>3600000)throw Error('Reconciliation timeout must be '+minimum+'..3600000ms');
  return selected;
}
