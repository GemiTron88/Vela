import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { canonicalState, declaredAuditBoundary, declaredExecutionAction, isPendingEvidence, loadConfig, loadTasks, parseTaskBlocks, unresolvedDependencies } from './execution-model.mjs';
import { extractTaskPathReferences, sealTaskEvidence, validateTaskProof } from './task-proof.mjs';
import { parseTodoShardManifest, renderTodoShardManifest, TODO_SHARDS_END, TODO_SHARDS_START, todoShardPathSafe, todoShardSources } from './todo-shards.mjs';
import { spawnPortableSync } from './portable-process.mjs';
import { resolveDerivedPath } from './derived-state.mjs';
import { writeStateCheckpoint } from './state-model.mjs';
import { captureV4FastWorktreeIdentity } from './v4-gate-identity.mjs';
import { emitBoundaryExecutionSignalSync } from './execution-signals.mjs';

function normalize(value){return String(value).split(path.sep).join('/');}
function bytes(value){return Buffer.byteLength(String(value),'utf8');}
function safePhase(value){const phase=String(value??'').trim();if(!/^[A-Za-z0-9._-]+$/.test(phase))throw new Error('Unsafe or missing task Phase for sharding: '+(phase||'MISSING'));return phase;}
function taskBlocks(markdown,sourcePath){
  const parsed=parseTaskBlocks(markdown,sourcePath);
  if(parsed.errors.length)return {blocks:[],errors:parsed.errors};
  const byId=new Map(parsed.tasks.map((task)=>[task.id,task])),blocks=[],re=/<!--\s*TASK:([A-Za-z0-9._-]+)\s*-->[\s\S]*?<!--\s*\/TASK\s*-->/g;let match;
  while((match=re.exec(markdown))!==null){const task=byId.get(match[1]);if(!task)continue;blocks.push({task,raw:match[0].trim()});}
  return {blocks,errors:[]};
}
function legacyChecklistFieldKey(value){
  const key=String(value??'').trim().toLowerCase().replace(/[ _-]+/g,' ');
  const aliases={
    dep:'Depends',depends:'Depends',dependencies:'Depends',phase:'Phase',priority:'Priority',
    contract:'Contract',verification:'Verification',evidence:'Evidence',action:'Action',
    boundary:'Audit Boundary','audit boundary':'Audit Boundary',blocker:'Blocker',
    reason:'Reason',tags:'Tags',tag:'Tags'
  };
  return aliases[key]??null;
}
function legacyChecklistPhase(id,heading){
  const h=String(heading??'').trim();
  if(/^post[- ]launch\b/i.test(h))return 'POST_LAUNCH';
  const headingPhase=h.match(/^(EK\d+|P\d{2})\b/i)?.[1];
  if(headingPhase)return headingPhase.toUpperCase();
  const idPhase=String(id).match(/(?:^|-)(EK\d+|P\d{2})(?:-|$)/i)?.[1];
  if(idPhase)return idPhase.toUpperCase();
  if(/(?:^|-)PL(?:-|$)/i.test(String(id)))return 'POST_LAUNCH';
  return 'NATIVE';
}
function legacyChecklistBlocks(markdown,sourcePath){
  const lines=String(markdown).split(/\r?\n/),blocks=[],errors=[],seen=new Set(),previousByPhase=new Map();
  const states={' ':'PLANNED',x:'ACCEPTED',X:'ACCEPTED','~':'IMPLEMENTED',R:'REVIEW_REQUIRED',r:'REVIEW_REQUIRED','!':'CORRECTION_REQUIRED',B:'BLOCKED',b:'BLOCKED','?':'BLOCKED'};
  let heading='',fence=false,order=0;
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(/^\s*(?:```|~~~)/.test(line)){fence=!fence;continue;}
    if(fence)continue;
    const h=line.match(/^#\s+(.+?)\s*#*\s*$/);if(h){heading=h[1].trim();continue;}
    const match=line.match(/^\s*[-*+]\s+\[([^\]])\]\s+([A-Z][A-Z0-9._-]*-[A-Z0-9._-]+)\s+(.+)$/);
    if(!match)continue;
    const marker=match[1],id=match[2];
    if(!(marker in states)){errors.push({code:'LEGACY_CHECKLIST_MARKER_UNKNOWN',message:sourcePath+':'+(i+1)+' unsupported checklist marker ['+marker+']'});continue;}
    if(seen.has(id)){errors.push({code:'DUPLICATE_TASK_ID',message:sourcePath+':'+(i+1)+' duplicate legacy checklist task '+id});continue;}
    seen.add(id);
    let tail=match[3].trim(),fields={};
    tail=tail.replace(/<!--\s*([A-Za-z][A-Za-z0-9 _/-]*):\s*(.*?)\s*-->/g,(_,key,value)=>{const canonical=legacyChecklistFieldKey(key);if(canonical)fields[canonical]=String(value).trim();return '';}).trim();
    const segments=tail.split('|').map((part)=>part.trim()).filter(Boolean),title=segments.shift()??id;
    for(const segment of segments){
      const colon=segment.indexOf(':');if(colon<0)continue;
      const canonical=legacyChecklistFieldKey(segment.slice(0,colon));if(canonical)fields[canonical]=segment.slice(colon+1).trim();
    }
    const phase=safePhase(fields.Phase??legacyChecklistPhase(id,heading));
    let depends=String(fields.Depends??'NONE').trim();
    if(/^prev$/i.test(depends))depends=previousByPhase.get(phase)??'NONE';
    const status=states[marker],evidence=String(fields.Evidence??'').trim();
    const legacyAcceptance=status==='ACCEPTED'&&isPendingEvidence(evidence);
    const meta={
      Status:status,Phase:phase,Priority:fields.Priority??'P2',Depends:depends||'NONE',
      Contract:fields.Contract??'NONE',
      Verification:fields.Verification??'Preserved from legacy checklist; verify through current ExecutionKit phase/system gates.',
      Evidence:legacyAcceptance?'LEGACY_STATUS_ONLY':(evidence||'PENDING')
    };
    const action=String(fields.Action??'').trim().toLowerCase();
    if(['audit','document','deploy'].includes(action))meta.Action=action;
    else if(action)meta['Legacy Action']=fields.Action;
    if(fields['Audit Boundary']){
      if(action==='audit')meta['Audit Boundary']=fields['Audit Boundary'];
      else meta['Legacy Boundary']=fields['Audit Boundary'];
    }
    for(const key of ['Blocker','Reason','Tags'])if(fields[key])meta[key]=fields[key];
    if(legacyAcceptance)meta['Legacy Acceptance']='true';
    const body=[
      '<!-- TASK:'+id+' -->',
      '### '+id+' — '+title,
      ...Object.entries(meta).map(([key,value])=>'- '+key+': '+value),
      'Objective: '+title,
      '<!-- /TASK -->'
    ].join('\n');
    const parsed=parseTaskBlocks(body,sourcePath);
    if(parsed.errors.length){errors.push(...parsed.errors);continue;}
    const task=parsed.tasks[0];task.order=order++;
    blocks.push({task,raw:body});
    previousByPhase.set(phase,id);
  }
  return {blocks,errors};
}
function migrationBlocks(markdown,sourcePath){
  const canonical=taskBlocks(markdown,sourcePath);
  if(canonical.errors.length||canonical.blocks.length)return canonical;
  return legacyChecklistBlocks(markdown,sourcePath);
}
function isLegacyAcceptanceOnly(task){
  return String(task?.meta?.['Legacy Acceptance']??'').trim().toLowerCase()==='true'
    && String(task?.meta?.Evidence??'').trim().toUpperCase()==='LEGACY_STATUS_ONLY';
}
function shardHeader(phase){return '# Phase '+phase+' — active canonical tasks\n\n';}
function archiveHeader(phase,part){return '# Phase '+phase+' — terminal archive '+String(part).padStart(4,'0')+'\n\nTerminal history only. This file is not executable backlog.\n\n';}
function pack(blocks,{maxTasks,maxBytes,header}){
  const chunks=[];let current=[],size=bytes(header);
  for(const block of blocks){const cost=bytes(block.raw)+2;if(current.length&&(current.length>=maxTasks||size+cost>maxBytes)){chunks.push(current);current=[];size=bytes(header);}current.push(block);size+=cost;}
  if(current.length)chunks.push(current);return chunks;
}
function renderBlocks(header,blocks){return header+(blocks.length?blocks.map((b)=>b.raw).join('\n\n')+'\n':'');}
function manifestContent(entries){return renderTodoShardManifest(entries);}
function residualNotes(markdown){
  return String(markdown)
    .replace(/<!--\s*TASK:[\s\S]*?<!--\s*\/TASK\s*-->/g,'')
    .replace(/^\s*[-*+]\s+\[[^\]]\]\s+[A-Z][A-Z0-9._-]*-[A-Z0-9._-]+\b.*$/gm,'')
    .replace(TODO_SHARDS_START,'').replace(TODO_SHARDS_END,'').trim();
}
function phasePath(root,phase,index,total,shardRoot){
  if(total===1)return normalize(path.posix.join(shardRoot,phase+'.md'));
  return normalize(path.posix.join(shardRoot,phase,String(index+1).padStart(3,'0')+'.md'));
}
function archiveParts(root,phase,archiveRoot){
  const dir=todoShardPathSafe(root,path.posix.join(archiveRoot,phase));if(!dir||!fs.existsSync(dir))return [];
  return fs.readdirSync(dir,{withFileTypes:true}).filter((e)=>e.isFile()&&/^\d{4}\.md$/.test(e.name)).map((e)=>normalize(path.relative(root,path.join(dir,e.name)))).sort();
}
function existingArchiveBlocks(root,rel){const full=todoShardPathSafe(root,rel);if(!full||!fs.existsSync(full))return [];const parsed=taskBlocks(fs.readFileSync(full,'utf8'),rel);if(parsed.errors.length)throw new Error(parsed.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));return parsed.blocks;}
function appendArchiveWrites(root,phase,blocks,authority,writes){
  if(!blocks.length)return [];
  const archiveRoot=authority.archiveRoot??'todo/archive',maxTasks=Math.max(1,Number(authority.archiveMaxTasksPerFile??100)),maxBytes=Math.max(4096,Number(authority.archiveMaxBytesPerFile??524288));
  const existing=archiveParts(root,phase,archiveRoot);
  const archivedIds=new Set();
  for(const archiveRel of existing)for(const block of existingArchiveBlocks(root,archiveRel))archivedIds.add(block.task.id);
  for(const block of blocks)if(archivedIds.has(block.task.id))throw new Error('Task '+block.task.id+' already exists in terminal archive for phase '+phase);
  let part=existing.length?Number(path.basename(existing.at(-1),'.md')):1;
  let rel=existing.at(-1)??normalize(path.posix.join(archiveRoot,phase,String(part).padStart(4,'0')+'.md'));
  let current=existing.length?existingArchiveBlocks(root,rel):[];
  const touched=[];
  for(const block of blocks){
    const candidate=[...current,block],content=renderBlocks(archiveHeader(phase,part),candidate);
    if(current.length&&(current.length>=maxTasks||bytes(content)>maxBytes)){writes.set(rel,renderBlocks(archiveHeader(phase,part),current));touched.push(rel);part+=1;rel=normalize(path.posix.join(archiveRoot,phase,String(part).padStart(4,'0')+'.md'));current=[];}
    current.push(block);
  }
  if(current.length){writes.set(rel,renderBlocks(archiveHeader(phase,part),current));touched.push(rel);}return touched;
}
function applyTransaction(root,writes,deletes){
  const touched=[...new Set([...writes.keys(),...deletes])],before=new Map();
  for(const rel of touched){const full=todoShardPathSafe(root,rel);if(!full)throw new Error('TODO maintenance path escapes project: '+rel);if(fs.existsSync(full)&&fs.lstatSync(full).isSymbolicLink())throw new Error('TODO maintenance refuses symlink: '+rel);before.set(rel,fs.existsSync(full)?{exists:true,data:fs.readFileSync(full),mode:fs.statSync(full).mode&0o777}:{exists:false,data:null,mode:0o644});}
  const temps=[];
  try{
    for(const [rel,content] of writes){const full=todoShardPathSafe(root,rel);fs.mkdirSync(path.dirname(full),{recursive:true});const tmp=full+'.executionkit-'+process.pid+'.tmp';fs.writeFileSync(tmp,content,{flag:'wx'});temps.push(tmp);}
    for(const [rel] of writes){const full=todoShardPathSafe(root,rel),tmp=full+'.executionkit-'+process.pid+'.tmp';fs.renameSync(tmp,full);}
    for(const rel of deletes){const full=todoShardPathSafe(root,rel);if(fs.existsSync(full))fs.rmSync(full,{force:true});}
  }catch(error){
    for(const rel of [...touched].reverse()){const full=todoShardPathSafe(root,rel),prior=before.get(rel);try{if(prior.exists){fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,prior.data,{mode:prior.mode});}else fs.rmSync(full,{force:true});}catch{}}
    throw error;
  }finally{for(const tmp of temps)try{if(fs.existsSync(tmp))fs.rmSync(tmp,{force:true});}catch{}}
}
function eligibleTerminal(root,block,config){
  const state=canonicalState(block.task,config),terminal=new Set((config.archiveTerminalStates??[]).map((x)=>canonicalState(x,config)));
  if(!terminal.has(state))return {eligible:false,terminal:false,reason:null};
  if(state!=='CANCELLED'&&config.requireEvidenceForVerified&&isPendingEvidence(block.task.meta.Evidence)&&!isLegacyAcceptanceOnly(block.task))return {eligible:false,terminal:true,reason:'terminal task lacks non-pending evidence'};
  if(state!=='CANCELLED'&&!isLegacyAcceptanceOnly(block.task)){
    const proofIssues=validateTaskProof(root,block.task,config);
    if(proofIssues.length)return {eligible:false,terminal:true,reason:proofIssues.map((item)=>'['+item.code+'] '+item.message).join('; ')};
  }
  return {eligible:true,terminal:true,reason:isLegacyAcceptanceOnly(block.task)?'legacy acceptance archived as historical non-proof':null};
}

export function todoMaintenanceStatus(root,config){
  root=path.resolve(root);const authority=config.todoAuthority??{};
  if((authority.mode??'single-file')!=='sharded')return {schemaVersion:'executionkit-todo-maintenance/v1',status:'NOT_APPLICABLE',needed:false,reasons:[],counts:{}};
  const manifestFull=todoShardPathSafe(root,config.todoPath??'TODO.md');
  if(!manifestFull||!fs.existsSync(manifestFull))return {schemaVersion:'executionkit-todo-maintenance/v1',status:'BLOCKED',needed:true,reasons:[{code:'TODO_MANIFEST_MISSING',message:'Canonical TODO manifest file is missing'}],counts:{}};
  const text=fs.readFileSync(manifestFull,'utf8'),parsedManifest=parseTodoShardManifest(text,config.todoPath??'TODO.md');
  if(parsedManifest.status==='MISSING'){
    const parsed=migrationBlocks(text,config.todoPath??'TODO.md');
    return {schemaVersion:'executionkit-todo-maintenance/v1',status:parsed.errors.length?'BLOCKED':'MIGRATION_REQUIRED',needed:true,reasons:parsed.errors.length?parsed.errors:[{code:'TODO_SHARD_MIGRATION_REQUIRED',message:'Monolithic canonical TODO must be normalized and partitioned into phase shards'}],counts:{monolithicTasks:parsed.blocks.length}};
  }
  if(parsedManifest.errors.length)return {schemaVersion:'executionkit-todo-maintenance/v1',status:'BLOCKED',needed:true,reasons:parsedManifest.errors,counts:{}};
  const loaded=loadTasks(root,config);
  if(loaded.errors.length)return {schemaVersion:'executionkit-todo-maintenance/v1',status:'BLOCKED',needed:true,reasons:loaded.errors,counts:{}};
  const reasons=[],counts={activeShards:parsedManifest.entries.length,terminalCandidates:0,blockedTerminal:0,oversizedShards:0};
  const maxTasks=Math.max(1,Number(authority.maxTasksPerShard??60)),maxBytes=Math.max(4096,Number(authority.maxShardBytes??262144));
  for(const entry of parsedManifest.entries){const full=todoShardPathSafe(root,entry.path);if(!full||!fs.existsSync(full)){reasons.push({code:'TODO_SHARD_MISSING',path:entry.path,message:'Declared active shard is missing'});continue;}const parsed=taskBlocks(fs.readFileSync(full,'utf8'),entry.path);if(parsed.errors.length){reasons.push(...parsed.errors);continue;}let live=0;for(const block of parsed.blocks){const e=eligibleTerminal(root,block,config);if(e.eligible)counts.terminalCandidates++;else if(e.terminal){counts.blockedTerminal++;reasons.push({code:'TODO_TERMINAL_ARCHIVE_BLOCKED',taskId:block.task.id,message:e.reason});}else live++;}if(live>maxTasks||(live>1&&bytes(fs.readFileSync(full))>maxBytes)){counts.oversizedShards++;reasons.push({code:'TODO_SHARD_OVERSIZED',path:entry.path,message:'Active TODO shard exceeds configured task/byte budget and can be split safely'});}}
  if(bytes(text)>Number(authority.maxRootBytes??65536))reasons.push({code:'TODO_ROOT_OVERSIZED',message:'TODO.md index exceeds configured root byte budget'});
  if(counts.terminalCandidates)reasons.push({code:'TODO_ARCHIVE_REQUIRED',message:counts.terminalCandidates+' terminal task(s) should be moved to archive shards'});
  const blocked=reasons.some((r)=>['TODO_TERMINAL_ARCHIVE_BLOCKED','TODO_SHARD_MISSING','UNBALANCED_TASK_MARKERS','TASK_ID_MISMATCH'].includes(r.code));
  return {schemaVersion:'executionkit-todo-maintenance/v1',status:blocked?'BLOCKED':reasons.length?'MAINTENANCE_REQUIRED':'CURRENT',needed:reasons.length>0,reasons,counts};
}

export function planTodoMaintenance(root,config){
  root=path.resolve(root);const authority=config.todoAuthority??{};if((authority.mode??'single-file')!=='sharded')return {status:'NOT_APPLICABLE',writes:new Map(),deletes:new Set(),summary:{}};
  const manifestRel=config.todoPath??'TODO.md',manifestFull=todoShardPathSafe(root,manifestRel);if(!manifestFull||!fs.existsSync(manifestFull))throw new Error('Canonical TODO missing: '+manifestRel);
  const text=fs.readFileSync(manifestFull,'utf8'),parsedManifest=parseTodoShardManifest(text,manifestRel),writes=new Map(),deletes=new Set(),summary={migrated:false,archived:[],split:[],notesPath:null};
  const maxTasks=Math.max(1,Number(authority.maxTasksPerShard??60)),maxBytes=Math.max(4096,Number(authority.maxShardBytes??262144)),shardRoot=authority.shardRoot??'todo';
  let entries=[];
  if(parsedManifest.status==='MISSING'){
    const canonical=taskBlocks(text,manifestRel),parsed=canonical.blocks.length||canonical.errors.length?canonical:legacyChecklistBlocks(text,manifestRel);
    if(parsed.errors.length)throw new Error(parsed.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
    if(!parsed.blocks.length)throw new Error('Sharded TODO migration found no canonical task blocks or unambiguous legacy checklist tasks');
    if(canonical.blocks.length){
      const legacyConfig={...config,todoAuthority:{...(config.todoAuthority??{}),mode:'single-file'}};
      const legacyLoaded=loadTasks(root,legacyConfig);
      if(legacyLoaded.errors.length)throw new Error(legacyLoaded.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
    }
    const activeByPhase=new Map(),archiveByPhase=new Map();
    for(const block of parsed.blocks){const phase=safePhase(block.task.meta?.Phase);const eligibility=eligibleTerminal(root,block,config);const map=eligibility.eligible?archiveByPhase:activeByPhase;if(eligibility.terminal&&!eligibility.eligible)throw new Error('Cannot migrate terminal task '+block.task.id+': '+eligibility.reason);if(!map.has(phase))map.set(phase,[]);map.get(phase).push(block);}
    for(const [phase,blocks] of activeByPhase.entries()){const chunks=pack(blocks,{maxTasks,maxBytes,header:shardHeader(phase)});chunks.forEach((chunk,index)=>{const rel=phasePath(root,phase,index,chunks.length,shardRoot);if(fs.existsSync(todoShardPathSafe(root,rel)))throw new Error('TODO shard migration target already exists: '+rel);writes.set(rel,renderBlocks(shardHeader(phase),chunk));entries.push({phase,path:rel});});}
    for(const [phase,blocks] of archiveByPhase) {appendArchiveWrites(root,phase,blocks,authority,writes);summary.archived.push(...blocks.map((b)=>b.task.id));}
    writes.set(manifestRel,manifestContent(entries));
    const notes=residualNotes(text);if(notes){const notesRel=normalize(path.posix.join(shardRoot,'README.md'));if(!fs.existsSync(todoShardPathSafe(root,notesRel)))writes.set(notesRel,'# Legacy TODO notes — non-authoritative reference\n\n'+notes+'\n');summary.notesPath=notesRel;}
    summary.migrated=true;return {status:'PLANNED',writes,deletes,summary,entries};
  }
  if(parsedManifest.errors.length)throw new Error(parsedManifest.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
  const loaded=loadTasks(root,config);if(loaded.errors.length)throw new Error(loaded.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
  const archiveByPhase=new Map();
  const reservedPaths=new Set(parsedManifest.entries.map((e)=>e.path));
  const nextShardRel=(phase)=>{
    let n=1;
    for(;;){
      const candidate=normalize(path.posix.join(shardRoot,phase,String(n++).padStart(3,'0')+'.md'));
      if(!reservedPaths.has(candidate)&&!writes.has(candidate)&&!fs.existsSync(todoShardPathSafe(root,candidate))){
        reservedPaths.add(candidate);
        return candidate;
      }
    }
  };
  for(const entry of parsedManifest.entries){
    const full=todoShardPathSafe(root,entry.path);if(!full||!fs.existsSync(full))throw new Error('Declared TODO shard missing: '+entry.path);const parsed=taskBlocks(fs.readFileSync(full,'utf8'),entry.path);if(parsed.errors.length)throw new Error(parsed.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
    const keep=[],archive=[];for(const block of parsed.blocks){const e=eligibleTerminal(root,block,config);if(e.terminal&&!e.eligible)throw new Error('Cannot archive terminal task '+block.task.id+': '+e.reason);(e.eligible?archive:keep).push(block);}if(archive.length){if(!archiveByPhase.has(entry.phase))archiveByPhase.set(entry.phase,[]);archiveByPhase.get(entry.phase).push(...archive);}
    if(!keep.length){deletes.add(entry.path);continue;}
    const chunks=pack(keep,{maxTasks,maxBytes,header:shardHeader(entry.phase)});
    if(chunks.length===1){writes.set(entry.path,renderBlocks(shardHeader(entry.phase),chunks[0]));entries.push(entry);}
    else{
      const keepFirstInPlace=/\/\d{3}\.md$/.test(entry.path);
      if(!keepFirstInPlace)deletes.add(entry.path);
      summary.split.push(entry.path);
      chunks.forEach((chunk,index)=>{
        const rel=(index===0&&keepFirstInPlace)?entry.path:nextShardRel(entry.phase);
        writes.set(rel,renderBlocks(shardHeader(entry.phase),chunk));
        entries.push({phase:entry.phase,path:rel});
      });
    }
  }
  for(const [phase,blocks] of archiveByPhase){appendArchiveWrites(root,phase,blocks,authority,writes);summary.archived.push(...blocks.map((b)=>b.task.id));}
  if(!summary.archived.length&&!summary.split.length)return {status:'UP_TO_DATE',writes:new Map(),deletes:new Set(),summary,entries:parsedManifest.entries};
  writes.set(manifestRel,manifestContent(entries));
  return {status:'PLANNED',writes,deletes,summary,entries};
}

export function maintainTodoAuthority(root,config,{apply=false}={}){
  const plan=planTodoMaintenance(root,config),changes=[...plan.writes.keys()].map((path)=>({path,operation:'write'})).concat([...plan.deletes].map((path)=>({path,operation:'delete'})));
  if(!apply)return {schemaVersion:'executionkit-todo-maintenance/v1',status:plan.status,apply:false,changes,summary:plan.summary};
  if(plan.status==='NOT_APPLICABLE'||plan.status==='UP_TO_DATE')return {schemaVersion:'executionkit-todo-maintenance/v1',status:plan.status,apply:true,changes:[],summary:plan.summary};
  applyTransaction(path.resolve(root),plan.writes,plan.deletes);
  fs.rmSync(path.join(path.resolve(root),'.executionkit','todo','archive-index.json'),{force:true});
  const status=todoMaintenanceStatus(root,config);
  if(status.status==='BLOCKED'||status.status==='MIGRATION_REQUIRED')throw new Error('TODO maintenance post-check failed: '+status.reasons.map((r)=>'['+r.code+'] '+r.message).join('; '));
  return {schemaVersion:'executionkit-todo-maintenance/v1',status:'APPLIED',apply:true,changes,summary:plan.summary,postStatus:status};
}

export function parsePortableCommandLine(commandLine){
  const raw=String(commandLine??'').trim();
  if(!raw)throw new Error('Verification command cannot be empty');
  if(/[;&|<>`$\r\n]/.test(raw))throw new Error('Verification command contains forbidden shell metacharacters; provide a single direct command');
  const tokens=[];
  let current='',quote=null;
  for(let i=0;i<raw.length;i++){
    const ch=raw[i];
    if(quote){
      if(ch===quote)quote=null;
      else if(ch==='\\'&&quote==='"'&&i+1<raw.length)current+=raw[++i];
      else current+=ch;
    }else if(ch==='"'||ch==="'"){
      quote=ch;
    }else if(/\s/.test(ch)){
      if(current){tokens.push(current);current='';}
    }else{
      current+=ch;
    }
  }
  if(quote)throw new Error('Unterminated quote in verification command');
  if(current)tokens.push(current);
  if(!tokens.length)throw new Error('Verification command produced no executable token');
  return {command:tokens[0],args:tokens.slice(1)};
}

function updateTaskBlockFields(rawBlock,{targetStatus,evidence}){
  let updated=String(rawBlock);
  if(/^- Status:/m.test(updated)){
    updated=updated.replace(/^- Status:\s*.*$/m,()=>'- Status: '+targetStatus);
  }else{
    updated=updated.replace(/^(###\s+.+)$/m,(line)=>line+'\n- Status: '+targetStatus);
  }
  if(evidence){
    if(/^- Evidence:/m.test(updated)){
      updated=updated.replace(/^- Evidence:\s*.*$/m,()=>'- Evidence: '+evidence);
    }else if(/^- Verification:/m.test(updated)){
      updated=updated.replace(/^- Verification:.*$/m,(line)=>line+'\n- Evidence: '+evidence);
    }else{
      updated=updated.replace(/^- Status:.*$/m,(line)=>line+'\n- Evidence: '+evidence);
    }
  }
  return updated;
}

export function completeCanonicalTask(root,config=null,{
  taskId,
  verifyCommand=null,
  targetStatus='ACCEPTED',
  evidence=null,
  apply=true,
  runReconcile=true,
  reconcileFn=null,
}={}){
  root=path.resolve(root);
  const id=String(taskId??'').trim();
  if(!id)throw new Error('todo complete requires --task <id>');
  if(!config||!config.taskModel?.adapter)config=loadConfig(root).config;
  const normalizedStatus=String(targetStatus??'ACCEPTED').trim().toUpperCase();
  if(!['ACCEPTED','VERIFIED','IMPLEMENTED'].includes(normalizedStatus)){
    throw new Error('todo complete --status must be ACCEPTED, VERIFIED or IMPLEMENTED');
  }
  const loaded=loadTasks(root,config,{archiveMode:'index'});
  if(loaded.errors.length)throw new Error(loaded.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
  const task=loaded.tasks.find((item)=>item.id===id&&!item.isArchive);
  if(!task)throw new Error('Unknown active canonical task: '+id);

  const unresolved=unresolvedDependencies(task,loaded.tasks,config,loaded.taskIndex);
  if(unresolved.length){
    return {
      schemaVersion:'executionkit-todo-complete/v1',
      ok:false,
      status:'DEPENDENCY_BLOCKED',
      apply:false,
      taskId:id,
      targetStatus:normalizedStatus,
      sourcePath:task.sourcePath,
      unresolvedDependencies:unresolved,
    };
  }
  const declaredAction=declaredExecutionAction(task);
  const auditBoundary=declaredAuditBoundary(task);
  if(declaredAction==='audit'&&['wave','phase','release'].includes(auditBoundary)){
    return {
      schemaVersion:'executionkit-todo-complete/v1',
      ok:false,
      status:'BOUNDARY_GATE_TASK_FORBIDDEN',
      apply:false,
      taskId:id,
      targetStatus:normalizedStatus,
      sourcePath:task.sourcePath,
      nextCommand:auditBoundary==='release'?'executionkit launch release .':'executionkit boundary '+auditBoundary+' .',
    };
  }
  if(declaredAction==='deploy'){
    return {
      schemaVersion:'executionkit-todo-complete/v1',
      ok:false,
      status:'DEPLOY_TASK_FORBIDDEN',
      apply:false,
      taskId:id,
      targetStatus:normalizedStatus,
      sourcePath:task.sourcePath,
      nextCommand:'executionkit launch release .',
    };
  }

  const safeTask=id.replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'task';
  const verifyRel='.executionkit/evidence/raw/todo-complete-'+safeTask+'.json';
  let verification=null;

  if(verifyCommand){
    const parsedCmd=parsePortableCommandLine(verifyCommand);
    const startedAt=Date.now();
    const {result,invocation}=spawnPortableSync(parsedCmd.command,parsedCmd.args,{
      cwd:root,
      encoding:'utf8',
      timeout:120000,
      maxBuffer:8*1024*1024,
      windowsHide:true
    });
    const durationMs=Date.now()-startedAt;
    verification={
      schemaVersion:'executionkit-task-verification/v1',
      taskId:id,
      command:parsedCmd.command,
      args:parsedCmd.args,
      strategy:invocation.strategy,
      exitCode:result.status,
      ok:!result.error&&result.status===0,
      durationMs,
      stdoutTail:String(result.stdout??'').slice(-1200),
      stderrTail:String(result.stderr??'').slice(-1200),
      error:result.error?.message??null,
      observedAt:new Date().toISOString(),
      artifactPath:verifyRel,
    };
    const verifyFull=resolveDerivedPath(root,verifyRel,'task completion verification receipt',{createParents:true});
    fs.writeFileSync(verifyFull,JSON.stringify(verification,null,2)+'\n');
    if(!verification.ok){
      let signals=null;
      try{
        let headSha=null;
        try{headSha=captureV4FastWorktreeIdentity(root).head;}catch{}
        if(!/^[a-f0-9]{40}$/i.test(String(headSha??'')))headSha='0'.repeat(40);
        signals=emitBoundaryExecutionSignalSync(root,{
          config,
          type:'execution.test.failed',
          taskId:id,
          boundary:'task',
          boundaryKey:'task-verification-failed:'+id+':'+headSha.slice(0,12),
          commitSha:headSha,
          evidenceRef:verifyRel,
          lifecycleStatus:'BLOCKED',
          projectCompleted:false,
          blockerReason:'Task verification failed for '+id,
          summary:'Task verification failed for '+id
        });
      }catch(error){
        signals={status:'SKIPPED',ioPerformed:false,error:error.message};
      }
      return {
        schemaVersion:'executionkit-todo-complete/v1',
        ok:false,
        status:'VERIFICATION_FAILED',
        apply:false,
        taskId:id,
        targetStatus:normalizedStatus,
        sourcePath:task.sourcePath,
        verification,
        signals,
        collaboration:signals?.collaboration??{status:'DISABLED',authority:'UNTRUSTED_ADVISORY_ONLY',messages:[]},
      };
    }
  }

  let reconciliation=null;
  if(runReconcile&&typeof reconcileFn==='function'){
    const rec=reconcileFn(root,{boundary:'task',taskId:id});
    reconciliation={
      status:rec.status,
      gatePath:rec.gatePath??'.executionkit/gates/reconcile-task.json',
      blockingSystems:rec.blockingSystems??[],
      reconciledAt:rec.reconciledAt??new Date().toISOString(),
    };
    if(rec.status!=='PASS'){
      let signals=null;
      try{
        let headSha=null;
        try{headSha=captureV4FastWorktreeIdentity(root).head;}catch{}
        if(!/^[a-f0-9]{40}$/i.test(String(headSha??'')))headSha='0'.repeat(40);
        signals=emitBoundaryExecutionSignalSync(root,{
          config,
          type:rec.status==='REVIEW_REQUIRED'?'execution.visual.review_required':'execution.task.blocked',
          taskId:id,
          boundary:'task',
          boundaryKey:'task-reconcile-blocked:'+id+':'+headSha.slice(0,12),
          commitSha:headSha,
          evidenceRef:reconciliation.gatePath,
          lifecycleStatus:rec.status==='REVIEW_REQUIRED'?'WAITING_REVIEW':'BLOCKED',
          projectCompleted:false,
          blockerReason:'Task reconciliation '+rec.status+' for '+id,
          summary:'Task reconciliation '+rec.status+' for '+id
        });
      }catch(error){
        signals={status:'SKIPPED',ioPerformed:false,error:error.message};
      }
      return {
        schemaVersion:'executionkit-todo-complete/v1',
        ok:false,
        status:'RECONCILIATION_BLOCKED',
        apply:false,
        taskId:id,
        targetStatus:normalizedStatus,
        sourcePath:task.sourcePath,
        verification,
        reconciliation,
        signals,
        collaboration:signals?.collaboration??{status:'DISABLED',authority:'UNTRUSTED_ADVISORY_ONLY',messages:[]},
      };
    }
  }

  const resolvedEvidence=String(evidence??'').trim()
    || (String(task.meta?.Evidence??'').trim()&&!isPendingEvidence(task.meta?.Evidence)?String(task.meta.Evidence).trim():'')
    || ('Verified canonical task '+id+(verifyCommand?' via `'+verifyCommand+'`':'')+' at '+new Date().toISOString());

  if(!apply){
    return {
      schemaVersion:'executionkit-todo-complete/v1',
      ok:true,
      status:'PLANNED',
      apply:false,
      taskId:id,
      targetStatus:normalizedStatus,
      sourcePath:task.sourcePath,
      evidence:resolvedEvidence,
      verification,
      reconciliation,
    };
  }

  const sourceFull=todoShardPathSafe(root,task.sourcePath);
  if(!sourceFull||!fs.existsSync(sourceFull))throw new Error('Task source file missing or unsafe: '+task.sourcePath);
  const beforeText=fs.readFileSync(sourceFull,'utf8');
  const escaped=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const blockRe=new RegExp('(<!--\\s*TASK:'+escaped+'\\s*-->[\\s\\S]*?<!--\\s*\\/TASK\\s*-->)');
  const match=beforeText.match(blockRe);
  if(!match)throw new Error('Canonical task block not found in '+task.sourcePath+': '+id);
  const updatedBlock=updateTaskBlockFields(match[1],{targetStatus:normalizedStatus,evidence:resolvedEvidence});
  const afterText=beforeText.replace(match[1],()=>updatedBlock);

  const candidateRefs=[
    ...extractTaskPathReferences(resolvedEvidence).filter((rel)=>{
      const full=path.resolve(root,rel);
      return fs.existsSync(full)&&fs.statSync(full).isFile();
    }),
  ];
  if(verification?.artifactPath&&fs.existsSync(path.resolve(root,verification.artifactPath))){
    candidateRefs.push(verification.artifactPath);
  }
  const gateRel=reconciliation?.gatePath??'.executionkit/gates/reconcile-task.json';
  if(runReconcile!==false&&fs.existsSync(path.resolve(root,gateRel))){
    candidateRefs.push(gateRel);
  }
  if(!candidateRefs.length){
    const receiptFull=resolveDerivedPath(root,verifyRel,'task completion receipt',{createParents:true});
    fs.writeFileSync(receiptFull,JSON.stringify({
      schemaVersion:'executionkit-task-completion-evidence/v1',
      taskId:id,
      targetStatus:normalizedStatus,
      sourcePath:task.sourcePath,
      evidence:resolvedEvidence,
      completedAt:new Date().toISOString(),
    },null,2)+'\n');
    candidateRefs.push(verifyRel);
  }

  let proof=null;
  applyTransaction(root,new Map([[task.sourcePath,afterText]]),new Set());
  try{
    if(['ACCEPTED','RELEASED'].includes(canonicalState({meta:{Status:normalizedStatus}},config))){
      const sealed=sealTaskEvidence(root,{
        taskId:id,
        apply:true,
        sourceRefs:[...new Set(candidateRefs)],
        extra:{targetStatus:normalizedStatus,evidenceSummary:resolvedEvidence}
      });
      proof={
        status:sealed.status,
        receiptPath:sealed.receiptPath,
        proofRoot:sealed.proofRoot,
        artifactCount:sealed.artifacts?.length??0,
      };
      const gitProbe=spawnSync('git',['-C',root,'rev-parse','--is-inside-work-tree'],{encoding:'utf8',timeout:10000,windowsHide:true});
      if(gitProbe.status===0&&String(gitProbe.stdout??'').trim()==='true'){
        spawnSync('git',['-C',root,'add','--',sealed.proofRoot,task.sourcePath],{encoding:'utf8',timeout:15000,windowsHide:true});
      }
    }
  }catch(error){
    try{applyTransaction(root,new Map([[task.sourcePath,beforeText]]),new Set());}catch{}
    throw error;
  }

  try{
    const activePlanFile=path.join(root,'.executionkit','decision','active-plan.json');
    if(fs.existsSync(activePlanFile)){
      const activePlan=JSON.parse(fs.readFileSync(activePlanFile,'utf8'));
      if(activePlan?.taskId===id)fs.rmSync(activePlanFile,{force:true});
    }
  }catch{}

  const gateFull=path.resolve(root,gateRel);
  if(runReconcile!==false&&fs.existsSync(gateFull)){
    try{
      const gateJson=JSON.parse(fs.readFileSync(gateFull,'utf8'));
      const postIdentity=captureV4FastWorktreeIdentity(root);
      gateJson.head=postIdentity.head;
      gateJson.worktreeFingerprint=postIdentity.worktreeFingerprint;
      gateJson.changedFiles=postIdentity.changedFiles;
      fs.writeFileSync(gateFull,JSON.stringify(gateJson,null,2)+'\n');
    }catch{}
  }

  let checkpoint=null;
  try{
    const cp=writeStateCheckpoint(root,{
      fast:true,
      reason:'todo-complete',
      note:'Completed canonical task '+id+' ('+normalizedStatus+')',
      nextSafeAction:'resolve-next-live-action',
      contextHealth:'HEALTHY',
      evidenceRefs:proof?.receiptPath?[proof.receiptPath]:candidateRefs,
    });
    checkpoint={status:'WRITTEN',snapshotPath:cp?.snapshotPath??'.executionkit/state/latest.json'};
  }catch(error){
    checkpoint={status:'SKIPPED',error:error.message};
  }

  let signals=null;
  try{
    let headSha=null;
    try{headSha=captureV4FastWorktreeIdentity(root).head;}catch{}
    if(!/^[a-f0-9]{40}$/i.test(String(headSha??'')))headSha='0'.repeat(40);
    const evRef=proof?.receiptPath||candidateRefs[0]||'TODO.md';
    signals=emitBoundaryExecutionSignalSync(root,{
      config,
      type:['ACCEPTED','VERIFIED'].includes(normalizedStatus)?'execution.task.completed':'execution.task.started',
      taskId:id,
      boundary:'task',
      boundaryKey:'task-completed:'+id+':'+headSha.slice(0,12),
      commitSha:headSha,
      evidenceRef:evRef,
      receipt:{status:normalizedStatus,commitSha:headSha},
      lifecycleStatus:'ACTIVE',
      projectCompleted:false,
      summary:'Completed canonical task '+id+' ('+normalizedStatus+')'
    });
  }catch(error){
    signals={status:'SKIPPED',ioPerformed:false,error:error.message};
  }

  return {
    schemaVersion:'executionkit-todo-complete/v1',
    ok:true,
    status:'COMPLETED',
    apply:true,
    taskId:id,
    targetStatus:normalizedStatus,
    sourcePath:task.sourcePath,
    evidence:resolvedEvidence,
    verification,
    reconciliation,
    proof,
    checkpoint,
    signals,
    collaboration:signals?.collaboration??{status:'DISABLED',authority:'UNTRUSTED_ADVISORY_ONLY',messages:[]},
  };
}

