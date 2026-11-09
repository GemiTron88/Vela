import fs from 'node:fs';
import path from 'node:path';

export const TODO_SHARDS_START='<!-- EXECUTIONKIT_TODO_SHARDS:START -->';
export const TODO_SHARDS_END='<!-- EXECUTIONKIT_TODO_SHARDS:END -->';

function normalize(value){return String(value).split(path.sep).join('/');}
function inside(root,rel){
  if(typeof rel!=='string'||!rel.trim()||path.isAbsolute(rel)||rel.includes('\\'))return null;
  const full=path.resolve(root,rel),delta=path.relative(root,full);
  if(!delta||delta.startsWith('..')||path.isAbsolute(delta))return null;
  let cursor=root;
  for(const part of delta.split(path.sep)){cursor=path.join(cursor,part);if(fs.existsSync(cursor)&&fs.lstatSync(cursor).isSymbolicLink())return null;}
  return full;
}
function under(rel,prefix){const r=normalize(rel).replace(/^\.\//,''),p=normalize(prefix).replace(/^\.\//,'').replace(/\/$/,'');return r===p||r.startsWith(p+'/');}
function markdownFiles(root,rel){
  const base=inside(root,rel);if(!base||!fs.existsSync(base))return [];
  const out=[];
  const walk=(dir)=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const full=path.join(dir,entry.name);if(entry.isSymbolicLink())continue;if(entry.isDirectory())walk(full);else if(entry.isFile()&&/\.md$/i.test(entry.name))out.push(normalize(path.relative(root,full)));}};
  walk(base);return out;
}

export function parseTodoShardManifest(markdown,sourcePath='TODO.md'){
  const text=String(markdown??''),start=text.indexOf(TODO_SHARDS_START),end=text.indexOf(TODO_SHARDS_END),errors=[],entries=[];
  if(start<0&&end<0)return {status:'MISSING',entries,errors};
  if(start<0||end<0||end<start)return {status:'INVALID',entries,errors:[{code:'TODO_SHARD_MANIFEST_MALFORMED',message:sourcePath+' has malformed shard markers'}]};
  const body=text.slice(start+TODO_SHARDS_START.length,end);
  const seenPaths=new Set();let order=0;
  for(const raw of body.split(/\r?\n/)){
    const line=raw.trim();if(!line||line.startsWith('<!--'))continue;
    const match=line.match(/^[-*]\s+([A-Za-z0-9._-]+)\s*:\s*`?([^`\s]+\.md)`?\s*$/);
    if(!match){errors.push({code:'TODO_SHARD_ENTRY_INVALID',message:sourcePath+' invalid shard entry: '+line});continue;}
    const phase=match[1],rel=normalize(match[2]).replace(/^\.\//,'');
    if(seenPaths.has(rel)){errors.push({code:'TODO_SHARD_PATH_DUPLICATE',message:'Duplicate TODO shard path: '+rel});continue;}
    seenPaths.add(rel);entries.push({phase,path:rel,order:order++});
  }
  return {status:errors.length?'INVALID':'CURRENT',entries,errors};
}

export function renderTodoShardManifest(entries,{title='# TODO — Canonical execution index'}={}){
  const lines=[title,'','This file is the **single execution entrypoint**. Canonical task bodies are partitioned into declared shards; do not duplicate task state here.','',TODO_SHARDS_START];
  for(const entry of entries)lines.push('- '+entry.phase+': `'+normalize(entry.path)+'`');
  lines.push(TODO_SHARDS_END,'','Agents must resolve the live task graph through ExecutionKit. Archive files are terminal history and are never executable backlog.','');
  return lines.join('\n');
}

function indexedArchivePaths(root,archiveRoot='todo/archive'){
  const file=path.join(path.resolve(root),'.executionkit','todo','archive-index.json');
  if(!fs.existsSync(file))return null;
  try{
    const value=JSON.parse(fs.readFileSync(file,'utf8'));
    if(value.schemaVersion!=='executionkit-todo-archive-index/v1'||!Array.isArray(value.signatures))return null;
    const paths=[...new Set(value.signatures.map((item)=>normalize(item?.path??'')).filter(Boolean))].sort();
    const live=markdownFiles(root,archiveRoot);
    if(live.length!==paths.length||live.some((rel,idx)=>rel!==paths[idx]))return null;
    return paths;
  }catch{return null;}
}

export function todoShardSources(root,config,{archiveMode='full'}={}){
  root=path.resolve(root);const authority=config.todoAuthority??{},mode=authority.mode??'single-file',errors=[];
  if(mode!=='sharded')return {mode:'single-file',manifestPath:config.todoPath,active:[{phase:null,path:config.todoPath,order:0}],archives:[...(config.taskArchivePaths??[])],errors};
  const manifestPath=config.todoPath??'TODO.md',manifestFull=inside(root,manifestPath);
  if(!manifestFull)return {mode,manifestPath,active:[],archives:[],errors:[{code:'TODO_MANIFEST_OUTSIDE_PROJECT',message:'todoPath escapes project: '+manifestPath}]};
  if(!fs.existsSync(manifestFull))return {mode,manifestPath,active:[],archives:[],errors:[{code:'TODO_MISSING',message:'Canonical TODO manifest not found: '+manifestPath}]};
  const parsed=parseTodoShardManifest(fs.readFileSync(manifestFull,'utf8'),manifestPath);errors.push(...parsed.errors);if(parsed.status==='MISSING')errors.push({code:'TODO_SHARD_MANIFEST_MISSING',message:manifestPath+' does not declare the required ExecutionKit shard manifest'});
  const shardRoot=authority.shardRoot??'todo',archiveRoot=authority.archiveRoot??'todo/archive';
  for(const entry of parsed.entries){
    if(!under(entry.path,shardRoot)||under(entry.path,archiveRoot))errors.push({code:'TODO_SHARD_PATH_POLICY',message:'Active shard must stay under '+shardRoot+' and outside '+archiveRoot+': '+entry.path});
    const full=inside(root,entry.path);
    if(!full)errors.push({code:'TODO_SHARD_OUTSIDE_PROJECT',message:'TODO shard escapes project: '+entry.path});
    else if(!fs.existsSync(full))errors.push({code:'TODO_SHARD_MISSING',message:'Declared TODO shard missing: '+entry.path});
    else if(!fs.statSync(full).isFile())errors.push({code:'TODO_SHARD_NOT_FILE',message:'Declared TODO shard is not a file: '+entry.path});
  }
  const indexed=archiveMode==='index'?indexedArchivePaths(root,archiveRoot):null;
  const discovered=indexed??markdownFiles(root,archiveRoot);
  const archives=[...new Set([...(config.taskArchivePaths??[]),...discovered])].sort();
  return {mode,manifestPath,active:parsed.entries,archives,errors,archiveSource:indexed!==null?'INDEX':'SCAN'};
}

export function assembleTodoMarkdown(root,config,{includeArchives=false}={}){
  const sources=todoShardSources(root,config);if(sources.errors.length)return {status:'INVALID',markdown:'',sources,errors:sources.errors};
  const parts=[];
  if(sources.mode==='single-file'){
    const full=inside(root,config.todoPath);return {status:'CURRENT',markdown:full&&fs.existsSync(full)?fs.readFileSync(full,'utf8'):'',sources,errors:[]};
  }
  for(const entry of sources.active){const full=inside(root,entry.path);parts.push('<!-- SOURCE: '+entry.path+' -->\n'+fs.readFileSync(full,'utf8').trim()+'\n<!-- /SOURCE -->');}
  if(includeArchives)for(const rel of sources.archives){const full=inside(root,rel);if(full&&fs.existsSync(full))parts.push('<!-- ARCHIVE: '+rel+' -->\n'+fs.readFileSync(full,'utf8').trim()+'\n<!-- /ARCHIVE -->');}
  return {status:'CURRENT',markdown:parts.join('\n\n')+'\n',sources,errors:[]};
}

export function todoShardPathSafe(root,rel){return inside(path.resolve(root),rel);}
export function todoPathUnder(rel,prefix){return under(rel,prefix);}
