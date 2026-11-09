#!/usr/bin/env node
// Project-local disk inventory only. Never scan parent, home, other projects,
// external mount points, or symlink targets. No deletion or hot-path calls.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const categories=[
  ['PROJECT_KIT_RUNTIME',parts=>parts.includes('.executionkit')&&(parts.includes('runtime')||parts.includes('source'))],
  ['PROJECT_AGENT_RULES',parts=>parts.includes('.agents')||parts.includes('.agent')],
  ['BUILD_DEPENDENCIES',parts=>parts.some(p=>['node_modules','vendor','.gradle','.pub-cache','.dart_tool','pods'].includes(p))],
  ['CACHES',parts=>parts.some(p=>['.npm','.cache','.pnpm-store','.yarn','.composer','cache','caches'].includes(p))],
  ['GIT_DATA',parts=>parts.includes('.git')],
  ['BUILD_OUTPUT',parts=>parts.some(p=>['build','dist','.next','target','coverage'].includes(p))],
  ['EVIDENCE_AND_IMAGES',parts=>parts.some(p=>['screenshots','evidence','artifacts','test-results','playwright-report'].includes(p))],
  ['AGENT_SESSION_DATA',parts=>parts.some(p=>['.gemini','.antigravity','brain','sessions'].includes(p))],
];
function classify(rel){
 const parts=rel.split(path.sep).map(x=>x.toLowerCase());
 return categories.find(([,pred])=>pred(parts))?.[0]??'OTHER';
}
export function inspectWorkspaceFootprint(root,{maxEntries=60000,maxDepth=32,top=15}={}){
 if(!Number.isSafeInteger(maxEntries)||maxEntries<1||maxEntries>200000
   ||!Number.isSafeInteger(maxDepth)||maxDepth<1||maxDepth>64
   ||!Number.isSafeInteger(top)||top<1||top>50)throw new Error('WORKSPACE_SCAN_LIMIT_INVALID');
 if(typeof root!=='string'||!root.trim())throw new Error('WORKSPACE_ROOT_REQUIRED');
 const base=path.resolve(root);
 if(base===path.parse(base).root)throw new Error('WORKSPACE_FILESYSTEM_ROOT_FORBIDDEN');
 const st=fs.lstatSync(base);
 if(!st.isDirectory()||st.isSymbolicLink()||fs.realpathSync(base)!==base)throw new Error('WORKSPACE_ROOT_NOT_REAL_DIRECTORY');
 // The explicit project authority is mandatory: an arbitrary home directory,
 // sibling checkout, or inferred parent is never a valid workspace scope.
 const marker=path.join(base,'execution.config.json'),markerStat=fs.lstatSync(marker,{throwIfNoEntry:false});
 if(!markerStat||!markerStat.isFile()||markerStat.isSymbolicLink()||markerStat.size>262144)
   throw new Error('PROJECT_ROOT_EXECUTION_CONFIG_REQUIRED');
 let config;
 try{config=JSON.parse(fs.readFileSync(marker,'utf8'));}catch{throw new Error('PROJECT_ROOT_EXECUTION_CONFIG_INVALID');}
 if(!config||typeof config!=='object'||Array.isArray(config)||
    typeof config.standardVersion!=='string'||!/^\d+(?:\.\d+){1,2}(?:[-.][a-zA-Z0-9.-]+)?$/.test(config.standardVersion))
   throw new Error('PROJECT_ROOT_EXECUTION_CONFIG_INVALID');
 const totals=new Map(),byTop=new Map(),stack=[{full:base,rel:'',depth:0}];
 let entries=0,files=0,dirs=0,symlinks=0,allocatedBytes=0,logicalBytes=0,complete=true,errors=0;
 const add=(map,key,size,logical)=>{
   const obj=map.get(key)??{allocatedBytes:0,logicalBytes:0,files:0};
   obj.allocatedBytes+=size;obj.logicalBytes+=logical;obj.files++;
   map.set(key,obj);
 };
 while(stack.length){
   if(entries>=maxEntries){complete=false;break;}
   const item=stack.pop();
   let stat;try{stat=fs.lstatSync(item.full);}catch{errors++;complete=false;continue;}
   entries++;
   if(stat.isSymbolicLink()){symlinks++;continue;}
   // Do not cross an external filesystem or mounted directory inside the project.
   if(stat.dev!==st.dev){complete=false;continue;}
   const allocated=Number.isFinite(stat.blocks)&&(stat.blocks>0||stat.size===0)?stat.blocks*512:stat.size;
   if(stat.isFile()){
     files++;allocatedBytes+=allocated;logicalBytes+=stat.size;
     const head=item.rel.split(path.sep)[0]||'[ROOT_FILES]';
     add(byTop,head,allocated,stat.size);add(totals,classify(item.rel),allocated,stat.size);
   }else if(stat.isDirectory()){
     dirs++;
     if(item.depth>=maxDepth){complete=false;continue;}
     let children;try{children=fs.readdirSync(item.full).sort();}catch{errors++;complete=false;continue;}
     // Sorting gives stable bounded receipts; never follow links or inspect bytes.
     for(let i=children.length-1;i>=0;i--)stack.push({
       full:path.join(item.full,children[i]),rel:item.rel?path.join(item.rel,children[i]):children[i],depth:item.depth+1
     });
   }
 }
 const topDirectories=[...byTop].sort((a,b)=>b[1].allocatedBytes-a[1].allocatedBytes).slice(0,top)
   .map(([name,values])=>({name,...values}));
 const byCategory=Object.fromEntries([...totals].sort((a,b)=>b[1].allocatedBytes-a[1].allocatedBytes));
 return {schemaVersion:'executionkit-workspace-footprint/v1',
   status:complete?'COMPLETE':'INCOMPLETE',scope:'PROJECT_ROOT_ONLY',readOnly:true,root:base,
   totals:{allocatedBytes,logicalBytes,files,dirs,symlinks,scannedEntries:entries,errors},
   limits:{maxEntries,maxDepth},topDirectories,byCategory,
   notes:['NO_FILES_DELETED','SYMLINKS_NOT_FOLLOWED','CROSS_DEVICE_MOUNTS_NOT_TRAVERSED','PARENT_HOME_NOT_SCANNED','PARTIAL_VALUES_IF_INCOMPLETE',
     'Logical files and allocated block estimates do not include snapshots/deduplication or deleted-open file handles']};
}
export function runProjectWorkspaceAuditCli(){
 const args=process.argv.slice(2);
 // Always and only inspect the current project's root. Never resolve a parent
 // or permit arbitrary filesystem paths through this CLI.
 const targets=args.filter(x=>!x.startsWith('--'));
 if(targets.length>1||(targets.length===1&&targets[0]!=='.'))
   throw new Error('WORKSPACE_SCAN_PROJECT_ONLY: run at the project root; only "." is permitted');
 const root=process.cwd();
 const known=['max-entries','max-depth','top'];
 for(const arg of args.filter(x=>x.startsWith('--'))){
   if(!known.some(k=>arg.startsWith('--'+k+'=')))throw new Error('WORKSPACE_AUDIT_OPTION_INVALID');
 }
 const take=(key,fallback)=>{
  const hit=args.find(x=>x.startsWith('--'+key+'='));
  return hit?Number(hit.slice(key.length+3)):fallback;
 };
 const report=inspectWorkspaceFootprint(root,{maxEntries:take('max-entries',60000),maxDepth:take('max-depth',32),top:take('top',15)});
 process.stdout.write(JSON.stringify(report)+'\n');
 if(report.status!=='COMPLETE')process.exitCode=2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{runProjectWorkspaceAuditCli();}catch(error){console.error(JSON.stringify({status:'FAIL',code:String(error?.message??error).slice(0,180)}));process.exitCode=1;}
}
