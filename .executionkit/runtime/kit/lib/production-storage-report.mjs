// Explicit bounded read-only inspection of release and producer-artifact disk use.
// Never run this traversal during task start/status/deploy hot paths.
import fs from 'node:fs';
import path from 'node:path';

const absent=p=>fs.lstatSync(p,{throwIfNoEntry:false});
function realRoot(p){
 if(typeof p!=='string'||!path.isAbsolute(p)||path.normalize(p)!==p)return null;
 const st=absent(p);
 if(!st)return null;
 if(!st.isDirectory()||st.isSymbolicLink()||fs.realpathSync(p)!==p)throw new Error('STORAGE_ROOT_NOT_SAFE');
 return p;
}
function json(file){
 const st=absent(file);if(!st||!st.isFile()||st.isSymbolicLink()||st.size>1048576)return null;
 try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}
}
export function inspectProductionStorage(root,{maxEntries=25000,maxItems=12}={}){
 if(!Number.isSafeInteger(maxEntries)||maxEntries<1||maxEntries>100000||!Number.isSafeInteger(maxItems)||maxItems<1||maxItems>50)throw new Error('STORAGE_AUDIT_LIMIT_INVALID');
 const project=path.resolve(root),cfg=json(path.join(project,'execution.config.json'))?.deployment??null;
 const target=cfg?.target??{},r=target.type==='local-release-root'?realRoot(target.releaseRoot):null;
 if(!r)return {schemaVersion:'executionkit-production-storage/v1',status:'UNCONFIGURED',readOnly:true,complete:true,scannedEntries:0,warnings:['NO_VERIFIED_RELEASE_ROOT']};
 const a=cfg.artifactRoot??'.executionkit/deployment';
 if(typeof a!=='string'||path.isAbsolute(a)||a.split(/[\/\\]/).some(s=>!s||s==='.'||s==='..'))throw new Error('STORAGE_ARTIFACT_ROOT_INVALID');
 const producer=path.join(project,a,'artifacts');
 const registry=json(path.join(r,'.executionkit-release-retention.json'));
 const state=json(path.join(project,a,'production-state.json'));
 const warnings=[],policy=cfg.retention??{},current=target.currentLink;
 let active=null;
 if(typeof current==='string'&&path.isAbsolute(current)&&absent(current)?.isSymbolicLink()){
   try{active=fs.realpathSync(current);}catch{warnings.push('CURRENT_LINK_UNRESOLVED');}
 }else warnings.push('CURRENT_LINK_UNVERIFIED');
 let scannedEntries=0,complete=true;
 function measure(entry){
   const stack=[[entry,0]],seen=new Set();let bytes=0,files=0;
   while(stack.length){
     if(scannedEntries>=maxEntries){complete=false;return {bytes,files,complete:false};}
     const [name,depth]=stack.pop(),st=absent(name);scannedEntries++;
     if(!st||st.isSymbolicLink())continue;
     if(st.isFile()){bytes+=st.size;files++;continue;}
     if(!st.isDirectory()||depth>=32){complete=false;continue;}
     const real=fs.realpathSync(name);
     if(seen.has(real)){complete=false;continue;}
     seen.add(real);
     for(const child of fs.readdirSync(name))stack.push([path.join(name,child),depth+1]);
   }
   return {bytes,files,complete:true};
 }
 function collect(directory,scope){
   const verified=realRoot(directory);if(!verified)return {bytes:0,count:0,largest:[]};
   const list=fs.readdirSync(verified).sort(),entries=[];
   for(const name of list){
     if(scannedEntries>=maxEntries){complete=false;break;}
     const target=path.join(verified,name),stat=absent(target),size=measure(target);
     const role=scope==='releases'?(target===active?'CURRENT':target===state?.previousReleaseDir?'ROLLBACK':'INACTIVE_OR_UNVERIFIED'): 'PRODUCER_COPY';
     entries.push({id:name,role,bytes:size.bytes,files:size.files,complete:size.complete,kind:stat?.isSymbolicLink()?'SYMLINK':stat?.isDirectory()?'DIRECTORY':'OTHER'});
   }
   return {bytes:entries.reduce((n,x)=>n+x.bytes,0),count:list.length,largest:entries.sort((x,y)=>y.bytes-x.bytes).slice(0,maxItems)};
 }
 const releases=collect(path.join(r,'releases'),'releases'),artifacts=collect(producer,'artifacts');
 if(policy.enabled===false)warnings.push('RETENTION_DISABLED');
 if(policy.keepRollbacks===0&&!(policy.workerUsers??[]).length)warnings.push('CURRENT_ONLY_REQUIRES_RUNTIME_WORKER_PROOF');
 const last=registry?.lastCleanup??null;
 if(last?.status==='DEFERRED'||last?.status==='FAILED')warnings.push('CLEANUP_UNFINISHED');
 if(state?.artifactRetention?.status==='DEFERRED'||state?.artifactRetention?.status==='FAILED')warnings.push('PRODUCER_CACHE_CLEANUP_UNFINISHED');
 if(last?.untrackedPreserved?.length||last?.legacyPreserved?.length)warnings.push('UNVERIFIED_HISTORY_PRESERVED');
 // Report source-control/agent/runtime pollution in the active deployed tree.
 // Deliberately do not delete anything; customer-owned files may be present.
 const unexpected=[];
 if(active&&active.startsWith(path.join(r,'releases')+path.sep)){
   for(const rel of ['.agents','.agent','.executionkit','.git','.github','docs','tests','test','node_modules','coverage','reports','public/.agents','public/.executionkit','public/.git','public/docs','public/tests','public/node_modules']){
     const location=path.join(active,rel),found=absent(location);
     if(found)unexpected.push(rel);
   }
 }
 if(unexpected.length)warnings.push('PRODUCTION_DEV_TREE_DETECTED');
 if(!complete)warnings.push('BOUNDED_SCAN_INCOMPLETE');
 return {schemaVersion:'executionkit-production-storage/v1',status:warnings.length?'REVIEW':'PASS',readOnly:true,complete,scannedEntries,
   totals:{releaseBytes:releases.bytes,artifactCacheBytes:artifacts.bytes,measuredBytes:releases.bytes+artifacts.bytes},
   releases,artifacts,productionPollution:{inspected:Boolean(active&&active.startsWith(path.join(r,'releases')+path.sep)),paths:unexpected},retention:{enabled:policy.enabled??false,keepRollbacks:policy.keepRollbacks??null,artifactKeepRollbacks:policy.artifactKeepRollbacks??policy.keepRollbacks??null,lastStatus:last?.status??'NOT_RUN',skippedCount:last?.skipped?.length??0},
   backups:{status:'OPERATOR_MANAGED_NOT_AUTODELETED',receiptConfigured:Boolean(cfg.backupReceiptPath)},warnings};
}
