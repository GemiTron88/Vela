import fs from 'node:fs';
import path from 'node:path';
import { digest, git, loadVisualConfig, readJSON, safeVisualPath, STATES } from './visual-contract.mjs';

const SKIP=new Set(['.git','.executionkit','node_modules','vendor','.dart_tool','build','dist','coverage','storage','docs','tests','test','templates','examples']);
const SOURCE=/\.(?:php|html?|css|scss|sass|js|mjs|cjs|ts|tsx|jsx|vue|svelte|dart)$/;
// Shared byte limits keep both source census paths bounded. Hitting a limit is
// incomplete evidence, never an empty source or successful non-UI classification.
export const VISUAL_SOURCE_MAX_BYTES=2*1024*1024;
export const VISUAL_SOURCE_TOTAL_BYTES=32*1024*1024;
export function readBoundedVisualSource(file,{budget={bytes:0},maxBytes=VISUAL_SOURCE_MAX_BYTES}={}){
  const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));
  try{
    const stat=fs.fstatSync(fd);
    if(!stat.isFile()||stat.size>maxBytes)throw Error('VISUAL_SOURCE_FILE_BUDGET');
    if(budget.bytes+stat.size>VISUAL_SOURCE_TOTAL_BYTES)throw Error('VISUAL_SOURCE_TOTAL_BUDGET');
    const bytes=Buffer.alloc(stat.size+1);let used=0;
    while(used<bytes.length){const n=fs.readSync(fd,bytes,used,bytes.length-used,null);if(!n)break;used+=n;}
    if(used!==stat.size||fs.fstatSync(fd).size!==stat.size)throw Error('VISUAL_SOURCE_CHANGED_DURING_READ');
    budget.bytes+=used;
    return bytes.subarray(0,used).toString('utf8');
  }finally{fs.closeSync(fd);}
}
export function readVisualSourceDirectory(dir,remaining=100000){
  const entries=[],handle=fs.opendirSync(dir);
  try{
    let entry;
    while((entry=handle.readSync())){
      if(entries.length>=remaining)throw Error('VISUAL_SOURCE_ENTRY_BUDGET');
      entries.push(entry);
    }
  }finally{handle.closeSync();}
  return entries.sort((a,b)=>a.name.localeCompare(b.name));
}
function filesAt(root,maxFiles){
  if(!Number.isSafeInteger(maxFiles)||maxFiles<1||maxFiles>100000)throw Error('Visual maxFiles must be between 1 and 100000');
  const out=[],issues=[];let complete=true,visited=0;
  function stop(code,rel){complete=false;issues.push({code,path:rel});}
  function walk(dir,depth=0){
    if(depth>64){stop('VISUAL_SOURCE_DEPTH_BUDGET',path.relative(root,dir));return;}
    let entries;try{entries=readVisualSourceDirectory(dir,100000-visited);}
    catch(error){stop(error.message.startsWith('VISUAL_')?error.message:'VISUAL_SOURCE_READ_FAILED',path.relative(root,dir));return;}
    for(const e of entries){
      if(++visited>100000){stop('VISUAL_SOURCE_ENTRY_BUDGET',path.relative(root,dir));return;}
      const full=path.join(dir,e.name),rel=path.relative(root,full).split(path.sep).join('/');
      if(SKIP.has(e.name)||e.name.startsWith('.'))continue;
      if(e.isSymbolicLink()){stop('VISUAL_SOURCE_SYMLINK',rel);continue;}
      if(e.isDirectory())walk(full,depth+1);
      else if(SOURCE.test(e.name)){
        if(out.length>=maxFiles){stop('VISUAL_CENSUS_TRUNCATED',rel);return;}
        out.push(rel);
      }
      if(visited>100000||out.length>=maxFiles&&!complete)return;
    }
  }
  if(fs.lstatSync(root).isSymbolicLink())stop('VISUAL_SOURCE_SYMLINK','.');else walk(root);
  return {files:out,complete,issues};
}
function inferStates(body){const states=['loaded'];for(const [pattern,state] of [[/<form\b|\bForm\s*\(/,'validation-error'],[/<form\b|\bForm\s*\(/,'form-filled'],[/<form\b|\bForm\s*\(/,'saving'],[/\b(?:dialog|Dialog|showDialog)\b/,'modal-open'],[/\b(?:Drawer|drawer|showModalBottomSheet)\b/,'drawer-open'],[/\b(?:loading|isLoading|skeleton|Skeleton)\b/,'loading'],[/\b(?:empty|isEmpty|EmptyState)\b/,'empty'],[/\b(?:search|SearchBar|SearchInput)\b/,'zero-results'],[/\b(?:forbidden|permissionDenied|403)\b/,'permission-denied'],[/\b(?:dropdown|DropdownButton|MenuAnchor)\b/,'dropdown-open'],[/\b(?:pagination|Paginator|paginate)\b/,'pagination'],[/\b(?:offline|isOffline|OfflineState)\b/,'offline'],[/\b(?:serverError|ServerError|ErrorState|hasError)\b/,'server-error']])if(pattern.test(body))states.push(state);return states;}
function controls(body){return [...new Set((body.match(/<(?:button|form|input|select|details|dialog)\b|\b(?:TextField|DropdownButton|TabBar|Drawer|AlertDialog|ElevatedButton|showModalBottomSheet)\s*\(/g)??[]).map(x=>x.replace(/[<\s(]/g,'')))];}
const slug=x=>x.replace(/[^a-zA-Z0-9._-]+/g,'.').replace(/^\.|\.$/g,'');

// Runtime Laravel route exports are authoritative for dynamic groups/prefixes.
// Static discovery retains unresolved surfaces; it never invents auth or URLs.
export function discoverVisualSurfaces(root,{config=null,maxFiles=10000}={}){
  root=path.resolve(root);
  const cfg=config??loadVisualConfig(root),scan=filesAt(root,maxFiles),issues=[...scan.issues],candidates=[],bodies=new Map(),budget={bytes:0};
  for(const p of scan.files)try{bodies.set(p,readBoundedVisualSource(path.join(root,p),{budget}));}
  catch(error){scan.complete=false;issues.push({code:error.message.startsWith('VISUAL_')?error.message:'VISUAL_SOURCE_READ_FAILED',path:p});}
  let head=null;try{head=git(root,['rev-parse','HEAD']);}catch{}
  let routeRows=[],surfaceRows=[];
  if(cfg.discovery?.routeExport){const ex=readJSON(safeVisualPath(root,cfg.discovery.routeExport,{mustExist:true,file:true}));if(ex.gitSha!==head||!Array.isArray(ex.routes))issues.push({code:'VISUAL_ROUTE_EXPORT_STALE',path:cfg.discovery.routeExport});else routeRows=ex.routes;}
  if(cfg.discovery?.surfaceExport){const ex=readJSON(safeVisualPath(root,cfg.discovery.surfaceExport,{mustExist:true,file:true}));if(ex.gitSha!==head||!Array.isArray(ex.surfaces))issues.push({code:'VISUAL_SURFACE_EXPORT_STALE',path:cfg.discovery.surfaceExport});else surfaceRows=ex.surfaces;}
  const runtimePaths=new Set();
  for(const r of routeRows){
    if(!String(r.method??'GET').split('|').includes('GET')||r.visual===false||/^api(?:\/|$)/.test(r.uri??''))continue;
    const sources=Array.isArray(r.sourcePaths)?r.sourcePaths:[];sources.forEach(p=>runtimePaths.add(p));
    candidates.push({surfaceId:r.name?`web.${r.name}`:`web.route.${slug(r.uri||'home')}`,route:'/'+String(r.uri??'').replace(/^\//,''),platform:'web',sourcePaths:sources,routeMetadata:{name:r.name??null,middleware:r.middleware??[],action:r.action??null},discovery:'runtime-route-export'});
  }
  for(const s of surfaceRows){
    if(!s||typeof s.surfaceId!=='string'||!Array.isArray(s.sourcePaths)||!s.sourcePaths.length)continue;
    s.sourcePaths.forEach(p=>runtimePaths.add(p));
    candidates.push({surfaceId:s.surfaceId,route:s.route??null,platform:s.platform??'flutter',sourcePaths:s.sourcePaths,states:Array.isArray(s.states)?s.states:undefined,discovery:'runtime-surface-export'});
  }
  for(const [p,body] of bodies){
    if(/\.blade\.php$/.test(p)&&!/\/(?:components|layouts|partials|emails|mail|vendor)\//.test(p)&&!runtimePaths.has(p))candidates.push({surfaceId:'web.view.'+slug(p.replace(/\.blade\.php$/,'')),route:null,platform:'web',sourcePaths:[p],discovery:'blade-page'});
    else if(/(?:^|\/)(?:app\/.*\/page\.[jt]sx?|pages\/.*\.[jt]sx?|index\.html)$/.test(p)&&!/(?:^|\/)(?:api|_app|_document)(?:\/|\.)/.test(p)){
      let route=null;if(/(?:^|\/)app\//.test(p))route='/'+p.split('/app/').at(-1).replace(/^app\//,'').replace(/\/?page\.[jt]sx?$/,'').replace(/\([^/]+\)\//g,'');else if(/(?:^|\/)pages\//.test(p))route='/'+p.split('/pages/').at(-1).replace(/^pages\//,'').replace(/\.[jt]sx?$/,'').replace(/\/?index$/,'');else route='/';
      candidates.push({surfaceId:'web.page.'+slug(p),route:route.replace(/\/$/,'')||'/',platform:'web',sourcePaths:[p],discovery:'file-route'});
    }
    if(/\.(?:vue|svelte)$/.test(p)&&/(?:^|\/)(?:pages|views|screens|tabs|dialogs|modals|sheets|details|forms)\//.test(p))candidates.push({surfaceId:'web.view.'+slug(p),route:null,platform:'web',sourcePaths:[p],discovery:'component-page'});
    if(/\.dart$/.test(p)&&!runtimePaths.has(p)&&(/(?:_screen|_page|_view|_shell|_tab|_detail|_details|_dialog|_sheet|_bottom_sheet|_modal|_form)\.dart$|\/(?:screens?|pages?|views?|shells?|tabs?|details?|dialogs?|sheets?|bottom_sheets?|modals?|forms?)\//.test(p)||/\b(?:Scaffold|CupertinoPageScaffold|showDialog|showModalBottomSheet|TabBarView)\s*\(/.test(body))&&/package:flutter|extends\s+(?:StatelessWidget|StatefulWidget)|\b(?:Scaffold|CupertinoPageScaffold|showDialog|showModalBottomSheet|TabBarView)\s*\(/.test(body))candidates.push({surfaceId:'flutter.'+slug(p.replace(/\.dart$/,'')),route:null,platform:'flutter',sourcePaths:[p],discovery:'flutter-screen'});
    if(/\.(?:[cm]?[jt]sx?|vue|svelte)$/.test(p)&&!/(?:^|\/)(?:components|lib)\//.test(p))for(const m of body.matchAll(/(?:<Route[^>]*\bpath\s*=\s*["']([^"']+)["']|\bpath\s*:\s*["']([^"']+)["'])/g))candidates.push({surfaceId:'web.route.'+slug(m[1]??m[2]),route:m[1]??m[2],platform:'web',sourcePaths:[p],discovery:'literal-router'});
  }
  const consumed=new Set(),result=[];
  for(const candidate of candidates){
    const byId=cfg.surfaces.filter(o=>o.surfaceId===candidate.surfaceId||o.discoveryId===candidate.surfaceId),byRoute=cfg.surfaces.filter(o=>o.route&&o.route===candidate.route);
    const overrides=byId.length?byId:byRoute.length?byRoute:cfg.surfaces.filter(o=>(!candidate.route||!o.route)&&o.sourcePaths?.some(p=>candidate.sourcePaths.includes(p)));
    if(overrides.length>1){issues.push({code:'VISUAL_AMBIGUOUS_SURFACE_MAPPING',surface:candidate.surfaceId});continue;}
    const o=overrides[0]??{};if(overrides.length)consumed.add(o);
    const sourcePaths=[...new Set([...candidate.sourcePaths,...(o.sourcePaths??[])])],body=sourcePaths.map(p=>bodies.get(p)??'').join('\n');
    result.push({...candidate,...o,sourcePaths,states:[...new Set([...inferStates(body).map(s=>s==='loaded'?o.primaryState??'loaded':s),...(o.states??[])])],controls:controls(body)});
  }
  for(const o of cfg.surfaces)if(!consumed.has(o)){if(!o.sourcePaths?.length||o.sourcePaths.some(p=>!bodies.has(p)))issues.push({code:'VISUAL_SURFACE_WITHOUT_SOURCE',surface:o.surfaceId});else result.push({...o,discovery:'explicit-source-binding',states:[...new Set([...inferStates(o.sourcePaths.map(p=>bodies.get(p)).join('\n')).map(s=>s==='loaded'?o.primaryState??'loaded':s),...(o.states??[])])],controls:controls(o.sourcePaths.map(p=>bodies.get(p)).join('\n'))});}
  const merged=new Map();for(const s of result){const old=merged.get(s.surfaceId);merged.set(s.surfaceId,old?{...s,sourcePaths:[...new Set([...old.sourcePaths,...s.sourcePaths])],states:[...new Set([...old.states,...s.states])],controls:[...new Set([...old.controls,...s.controls])]}:s);}
  const surfaces=[...merged.values()].sort((a,b)=>a.surfaceId.localeCompare(b.surfaceId));
  // Overrides can merge several discovered views into one routed surface. Every
  // source remains in the census denominator through the merged sourcePaths.
  for(const s of surfaces){
    if(!s.surfaceId||!['web','flutter','android','ios'].includes(s.platform)||!s.owner||!['critical','high','normal'].includes(s.criticality)||!Array.isArray(s.personas)||!s.personas.length||s.authentication===undefined||!Array.isArray(s.permissions)||!s.entryMethod)issues.push({code:'VISUAL_SURFACE_METADATA_REQUIRED',surface:s.surfaceId});
    if(!s.route||/[{[]/.test(s.route))issues.push({code:'VISUAL_SURFACE_ENTRY_UNRESOLVED',surface:s.surfaceId});
    const middleware=s.routeMetadata?.middleware??[];const guarded=middleware.some(m=>/^(?:auth|verified|can|permission|role)(?::|$)/.test(m));
    if(guarded&&s.authentication===false)issues.push({code:'VISUAL_AUTH_METADATA_MISMATCH',surface:s.surfaceId});
    for(const persona of s.personas??[]){const metadata=cfg.personas?.find(p=>p.id===persona);if(cfg.personas&&!metadata||metadata&&guarded&&!metadata.authenticated||metadata&&s.permissions.some(p=>!metadata.permissions.includes(p)))issues.push({code:'VISUAL_PERSONA_PERMISSION_MISMATCH',surface:s.surfaceId,persona});}
    if(s.states.some(x=>!STATES.includes(x)))issues.push({code:'VISUAL_UNKNOWN_STATE',surface:s.surfaceId});
    for(const p of s.sourcePaths)if(!bodies.has(p))issues.push({code:'VISUAL_SURFACE_SOURCE_MISSING',surface:s.surfaceId,path:p});
  }
  if(!cfg.discovery?.routeExport&&[...bodies].some(([p,b])=>/^routes\/.*\.php$/.test(p)&&/Route::(?:get|view|resource|controller|group)/.test(b)))issues.push({code:'VISUAL_LARAVEL_RUNTIME_ROUTES_REQUIRED',message:'Export current GET routes with sourcePaths and middleware; static views cannot establish the complete routed denominator.'});
  if(!scan.complete)issues.push({code:'VISUAL_CENSUS_TRUNCATED',limit:maxFiles});
  const census={schemaVersion:'executionkit-visual-census/v2',gitSha:head,complete:scan.complete&&issues.length===0,discovered:surfaces.length,surfaces,issues,sourceHashes:Object.fromEntries([...bodies].map(([p,b])=>[p,digest(b)]))};
  return {...census,censusDigest:digest(census)};
}

export function impactedVisualSurfaces(root,census,changedFiles){
  const changed=new Set(changedFiles.map(p=>p.replaceAll('\\','/'))),reasons={};
  // Shared design/localization/layout/navigation changes conservatively fan out.
  const shared=[...changed].filter(p=>/(?:^|\/)(?:components|layouts|tokens|themes|locales|lang|navigation|routes)(?:\/|\.)|\.(?:css|scss|sass)$|executionkit\.(?:visual|design|components)\.json/.test(p));
  for(const s of census.surfaces){
    const direct=s.sourcePaths.filter(p=>changed.has(p));
    const depend=s.dependencies??[];
    const dependency=depend.filter(p=>changed.has(p));
    if(shared.length||direct.length||dependency.length)reasons[s.surfaceId]={shared,direct,dependency};
  }
  // An unknown source edit may affect dynamically wired UI. Fail conservatively
  // rather than publish an empty impact certificate.
  if(!Object.keys(reasons).length&&[...changed].some(p=>/\.(?:php|dart|[cm]?js|tsx?|jsx?|vue|html?)$/.test(p)))for(const s of census.surfaces)reasons[s.surfaceId]={conservative:[...changed]};
  return {surfaceIds:Object.keys(reasons),reasons};
}
function pairs(row){const out=[];const keys=Object.keys(row);for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++)out.push(JSON.stringify([keys[i],row[keys[i]],keys[j],row[keys[j]]]));return out;}
export function pairwiseVisualRows(dimensions,{maxCandidates=25000}={}){
  const keys=Object.keys(dimensions);let candidates=[{}];
  for(const key of keys){if(!dimensions[key]?.length)throw new Error('Empty visual dimension: '+key);if(candidates.length*dimensions[key].length>maxCandidates)throw new Error('VISUAL_MATRIX_CANDIDATE_BUDGET: narrow surface-specific dimensions');candidates=candidates.flatMap(row=>dimensions[key].map(v=>({...row,[key]:v})));}
  if(keys.length<2)return candidates;
  const all=new Set(candidates.flatMap(pairs)),selected=[];
  while(all.size){let winner=null,score=0;for(const c of candidates){const n=pairs(c).filter(p=>all.has(p)).length;if(n>score){score=n;winner=c;}}if(!winner)throw new Error('VISUAL_PAIRWISE_COVERAGE_FAILED');selected.push(winner);pairs(winner).forEach(p=>all.delete(p));}
  return selected;
}
export function planVisualMatrix(root,{mode='full',changedFiles=[],base=null,config=null}={}){
  if(!['full','impact'].includes(mode))throw new Error('Visual mode must be full or impact');
  const cfg=config??loadVisualConfig(root),census=discoverVisualSurfaces(root,{config:cfg});
  const projectFile=safeVisualPath(root,'execution.config.json');
  const mobileFirst=fs.existsSync(projectFile)&&/^[45]\./.test(String(readJSON(projectFile).standardVersion));
  if(mode==='impact'&&base)changedFiles=git(root,['diff','--name-only',base,'HEAD']).split('\n').filter(Boolean);
  if(mode==='impact'&&!base&&!changedFiles.length)throw new Error('Impact mode requires --base or explicit changed files');
  const impact=mode==='impact'?impactedVisualSurfaces(root,census,changedFiles):{surfaceIds:census.surfaces.map(s=>s.surfaceId),reasons:{}};
  const cells=[],issues=[...census.issues];
  for(const s of census.surfaces.filter(s=>impact.surfaceIds.includes(s.surfaceId))){
    const locales=(s.locales??cfg.locales.map(x=>x.locale)).map(l=>cfg.locales.find(x=>x.locale===l));
    if(locales.some(x=>!x)){issues.push({code:'VISUAL_SURFACE_LOCALE_UNKNOWN',surface:s.surfaceId});continue;}
    const viewports=(s.viewports??cfg.viewports.map(x=>x.id)).map(id=>cfg.viewports.find(x=>x.id===id));
    if(viewports.some(x=>!x)){issues.push({code:'VISUAL_SURFACE_VIEWPORT_UNKNOWN',surface:s.surfaceId});continue;}
    if(mobileFirst&&s.platform==='web'&&!viewports.some(viewport=>viewport.width<=480)){issues.push({code:'VISUAL_MOBILE_FIRST_COVERAGE_REQUIRED',surface:s.surfaceId});continue;}
    if(mobileFirst)viewports.sort((a,b)=>a.width-b.width);
    const dims={persona:s.personas??['UNRESOLVED'],locale:locales.map(x=>x.locale),theme:s.themes??cfg.themes,viewport:viewports.map(x=>x.id),state:s.states};
    let rows;try{rows=pairwiseVisualRows(dims);}catch(e){issues.push({code:'VISUAL_MATRIX_BUDGET',surface:s.surfaceId,message:e.message});continue;}
    const addRequired=row=>{if(!rows.some(x=>digest(x)===digest(row)))rows.push(row);};
    const primaryState=s.primaryState??'loaded';
    if(s.criticality==='critical')for(const persona of dims.persona)for(const viewport of dims.viewport)for(const locale of dims.locale)for(const theme of dims.theme)addRequired({persona,locale,theme,viewport,state:primaryState});
    else if(s.criticality==='high')for(const persona of dims.persona)for(const viewport of dims.viewport)addRequired({persona,locale:dims.locale[0],theme:dims.theme[0],viewport,state:primaryState});
    const required=s.requiredCells??[];for(const r of required){if(Object.keys(dims).some(k=>!dims[k].includes(r[k])))throw new Error('Invalid mandatory visual cell');if(!rows.some(x=>digest(x)===digest(r)))rows.push(r);}
    if(rows.length>cfg.budgets.maxCellsPerSurface)issues.push({code:'VISUAL_SURFACE_CELL_BUDGET',surface:s.surfaceId,required:rows.length,budget:cfg.budgets.maxCellsPerSurface});
    for(const r of rows){const cell={surfaceId:s.surfaceId,route:s.route,platform:s.platform,...r,direction:locales.find(x=>x.locale===r.locale).direction,viewport:viewports.find(x=>x.id===r.viewport),dataState:s.dataStates?.[r.state]??'production-shaped',entryMethod:s.entryMethod,criticality:s.criticality};cells.push({...cell,cellId:digest(cell).slice(0,24)});}
  }
  if(cells.length>cfg.budgets.maxCells)issues.push({code:'VISUAL_TOTAL_CELL_BUDGET',required:cells.length,budget:cfg.budgets.maxCells});
  const plan={schemaVersion:'executionkit-visual-plan/v2',mode,base,changedFiles,status:issues.length?'BLOCKED':'PLANNED',censusDigest:census.censusDigest,configDigest:digest(cfg),gitSha:census.gitSha,expectedSurfaces:impact.surfaceIds,expectedCells:cells.length,cells,impact,issues};
  return {...plan,planDigest:digest(plan),census};
}
