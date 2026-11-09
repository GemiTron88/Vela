import fs from 'node:fs';
import path from 'node:path';

const INSTALL_RECEIPT_REL='.executionkit/installation.json';
export const UPGRADE_REVALIDATION_STATUS_REL='.executionkit/upgrade-revalidation.json';
function readJson(file){if(!fs.existsSync(file))return null;try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}}

export function upgradeRevalidationStatus(root){
  root=path.resolve(root);
  const statusFile=path.join(root,...UPGRADE_REVALIDATION_STATUS_REL.split('/'));
  if(!fs.existsSync(statusFile)){
    const installed=fs.existsSync(path.join(root,...INSTALL_RECEIPT_REL.split('/')));
    return installed
      ? {schemaVersion:'executionkit-v4-upgrade-revalidation-status/v1',status:'PENDING',required:true,blocking:true,reason:'LEGACY_INVARIANT_BASELINE_MISSING',requiredChecks:[],invariantIds:[],currentInvariantFingerprint:null,statusPath:UPGRADE_REVALIDATION_STATUS_REL}
      : {schemaVersion:'executionkit-v4-upgrade-revalidation-status/v1',status:'NOT_INSTALLED',required:false,blocking:false,statusPath:UPGRADE_REVALIDATION_STATUS_REL};
  }
  const rv=readJson(statusFile);
  if(!rv||rv.schemaVersion!=='executionkit-v4-upgrade-revalidation-receipt/v1')return {schemaVersion:'executionkit-v4-upgrade-revalidation-status/v1',status:'INVALID',required:true,blocking:true,reason:'UPGRADE_REVALIDATION_RECEIPT_INVALID',requiredChecks:[],invariantIds:[],statusPath:UPGRADE_REVALIDATION_STATUS_REL};
  const status=rv.status??'PENDING';
  return {
    schemaVersion:'executionkit-v4-upgrade-revalidation-status/v1',
    status,
    required:rv.required===true,
    blocking:rv.required===true&&!['PASS','NOT_REQUIRED'].includes(status),
    reason:rv.reason??null,
    invariantIds:rv.invariantIds??[],
    requiredChecks:rv.requiredChecks??[],
    previousInvariantFingerprint:rv.previousInvariantFingerprint??null,
    currentInvariantFingerprint:rv.currentInvariantFingerprint??null,
    maxCost:rv.maxCost??'NONE',
    acceptedHistoryCount:rv.acceptedHistoryCount??0,
    releaseHistory:rv.releaseHistory===true,
    certifiedAt:rv.certifiedAt??null,
    gatePath:rv.gatePath??null,
    statusPath:UPGRADE_REVALIDATION_STATUS_REL,
  };
}

export function isUpgradeRevalidationTask(task){
  return String(task?.meta?.['Upgrade Revalidation']??'').trim().toLowerCase()==='true';
}
