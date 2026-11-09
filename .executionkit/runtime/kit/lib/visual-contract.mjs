import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveProjectPathSafe } from './derived-state.mjs';
import { visualConfigSchema, validateVisualSchema } from './visual-schema.mjs';
export { STATES, DIMENSIONS } from './visual-enums.mjs';

// A generic language accepts regional rendering; an explicit region must match.
export function visualLocaleMatches(observed,required){
  const o=String(observed??'').trim().replace(/_/g,'-').toLowerCase();
  const r=String(required??'').trim().replace(/_/g,'-').toLowerCase();
  if(!/^[a-z]{2}(?:-[a-z0-9]{2,8})*$/.test(o)||!/^[a-z]{2}(?:-[a-z0-9]{2,8})*$/.test(r))return false;
  return o===r||!r.includes('-')&&o.startsWith(r+'-');
}
export const VISUAL_CONFIG = 'executionkit.visual.json';
export const VISUAL_ROOT = '.executionkit/visual';
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
export const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b))) : v);
export const digest = value => sha256(canonical(value));
export const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export const safeVisualPath = (root, rel, options={}) => resolveProjectPathSafe(root, rel, 'Visual OS path', options);
export function writeJSON(file, value, exclusive=false) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  const content=JSON.stringify(value,null,2)+'\n';
  if(exclusive){fs.writeFileSync(file,content,{flag:'wx'});return;}
  const temporary=file+'.'+crypto.randomUUID()+'.tmp';try{fs.writeFileSync(temporary,content,{flag:'wx'});fs.renameSync(temporary,file);}finally{fs.rmSync(temporary,{force:true});}
}
export function git(root,args,{trim=true}={}) {
  const r=spawnSync('git',['-C',root,...args],{encoding:'utf8',timeout:10000,maxBuffer:16*1024*1024,windowsHide:true});
  if(r.error||r.status!==0)throw new Error('Visual provenance Git operation failed: '+String(r.stderr||r.error?.message).trim());
  return trim?r.stdout.trim():r.stdout;
}
export function sourceIdentity(root) {
  const gitSha=git(root,['rev-parse','HEAD']);
  if(!/^[a-f0-9]{40}$/.test(gitSha))throw new Error('Visual capture needs a real Git commit');
  if(git(root,['status','--porcelain','--untracked-files=normal']))throw new Error('VISUAL_DIRTY_SOURCE: commit source changes before capturing certification evidence');
  return {gitSha,gitTree:git(root,['rev-parse','HEAD^{tree}'])};
}
export function loadVisualConfig(root) {
  const file=safeVisualPath(root,VISUAL_CONFIG,{mustExist:true,file:true});
  const cfg=validateVisualSchema(visualConfigSchema,readJSON(file));
  if(cfg.schemaVersion!=='executionkit-visual-config/v2')throw new Error('VISUAL_CONFIG_SCHEMA');
  if(!cfg.app?.identity||/^\[|TODO|UNRESOLVED/i.test(cfg.app.identity)||!['test','staging','production'].includes(cfg.app.environment))throw new Error('Visual app identity/environment required');
  if(cfg.app.environment==='production')throw new Error('Production evidence is excluded from the reusable capture engine; use an explicitly authorized private adapter');
  for(const [key,min,max] of [['maxCells',1,10000],['maxCellsPerSurface',1,120],['timeoutMs',1000,1800000],['maxReviewCalls',1,10000]]){
    if(!Number.isSafeInteger(cfg.budgets?.[key])||cfg.budgets[key]<min||cfg.budgets[key]>max)throw new Error('Invalid visual budget: '+key);
  }
  if(!Array.isArray(cfg.surfaces)||!Array.isArray(cfg.locales)||!cfg.locales.length||!Array.isArray(cfg.themes)||!cfg.themes.length||!Array.isArray(cfg.viewports)||!cfg.viewports.length)throw new Error('Visual dimensions and surface overrides required');
  if(cfg.locales.some(x=>!x.locale||!['rtl','ltr'].includes(x.direction))||cfg.themes.some(x=>!['light','dark'].includes(x)))throw new Error('Invalid locale/direction/theme dimensions');
  for(const v of cfg.viewports)if(!v.id||!Number.isSafeInteger(v.width)||!Number.isSafeInteger(v.height)||v.width<240||v.width>3840||v.height<240||v.height>3840)throw new Error('Invalid viewport');
  if(!cfg.capture?.producerId||!cfg.critic?.reviewerId||cfg.capture.producerId===cfg.critic.reviewerId)throw new Error('Independent capture/reviewer identities required');
  if(cfg.capture.dataPolicy!=='synthetic-fixtures')throw new Error('Use production-shaped synthetic fixtures; real customer data is forbidden');
  if(cfg.maxEvidenceAgeHours!==undefined&&(!Number.isFinite(cfg.maxEvidenceAgeHours)||cfg.maxEvidenceAgeHours<.05||cfg.maxEvidenceAgeHours>72))throw new Error('Evidence age must be between .05 and 72 hours');
  const allowedHttp={'validation-error':[400,422],'permission-denied':[401,403],'server-error':[404,500,502,503],offline:[502,503,504]};
  for(const [state,statuses] of Object.entries(cfg.expectedHttpStatuses??{}))if(statuses.some(s=>!allowedHttp[state]?.includes(s)))throw new Error('Unexpected HTTP failures cannot be waived on healthy states: '+state);
  for(const rel of [cfg.capture.hook,cfg.discovery?.routeExport].filter(Boolean))safeVisualPath(root,rel,{mustExist:true,file:true});
  return cfg;
}
function attestationKey(kind) {
  const name=kind==='capture'?'EXECUTIONKIT_VISUAL_CAPTURE_KEY':kind==='audit'?'EXECUTIONKIT_VISUAL_AUDIT_KEY':'EXECUTIONKIT_VISUAL_REVIEW_KEY';
  const key=process.env[name];
  if(!key||Buffer.byteLength(key)<32)throw new Error(name+' needs an operator-owned secret of at least 32 bytes');
  if(kind!=='capture'&&key===process.env.EXECUTIONKIT_VISUAL_CAPTURE_KEY||kind==='audit'&&key===process.env.EXECUTIONKIT_VISUAL_REVIEW_KEY)throw new Error('Capture, review and audit attestation keys must differ');
  return key;
}
export function signVisual(value,kind) {return crypto.createHmac('sha256',attestationKey(kind)).update(canonical(value)).digest('hex');}
export function verifyVisualSignature(value,signature,kind) {
  const expected=signVisual(value,kind);
  return /^[a-f0-9]{64}$/.test(signature??'')&&crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(signature,'hex'));
}
export function sealVisual(value,kind='capture'){const {signature,...body}=value;return {...body,signature:signVisual(body,kind)};}
export function verifySealed(value,kind='capture'){const {signature,...body}=value??{};return verifyVisualSignature(body,signature,kind);}
export function scrubRuntime(value) {
  return String(value).replace(/([?&](?:token|key|secret|password|email|phone|session|code)=)[^&\s]+/gi,'$1[REDACTED]').replace(/Bearer\s+\S+/gi,'Bearer [REDACTED]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[EMAIL]');
}
export function runDirectory(root,runId) {
  if(!/^[a-f0-9-]{36}$/.test(runId??''))throw new Error('Expected a capture run UUID');
  return safeVisualPath(root,`${VISUAL_ROOT}/runs/${runId}`,{mustExist:true});
}
