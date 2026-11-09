import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './execution-model.mjs';
import { auditUiConformance, designDrift, validateComponentSystem } from './component-model.mjs';
import {inspectLighthouseGate} from './lighthouse-gate.mjs';
import { validateQuality } from './quality-model.mjs';
import { inspectVisualEvidence } from './visual-audit.mjs';
import { inspectVisualProduction } from './visual-production.mjs';
import { isV5 } from './v5-config.mjs';
import {readBoundedVisualSource,readVisualSourceDirectory} from './visual-surface.mjs';

const IGNORE = new Set(['.git','.executionkit','node_modules','vendor','.dart_tool','build','dist','coverage','storage','docs','tests','test','templates','examples']);
const UI_FILE = /\.(?:blade\.php|html?|css|scss|sass|js|mjs|cjs|ts|tsx|jsx|vue|svelte|astro|mdx|dart)$/i;

function normalizeScopeRoot(value){
  const raw=String(value??'').trim().replaceAll('\\\\','/');
  if(!raw||raw==='.')return '.';
  if(path.posix.isAbsolute(raw)||/^[a-zA-Z]:/.test(raw)||raw.includes('\\')||raw.split('/').some((part)=>part==='..'))throw new Error('Visual OS surfaceScope roots must be safe project-relative paths: '+value);
  return raw.replace(/^\.\//,'').replace(/\/+$/,'');
}
function normalizeSurfaceScope(raw={}){
  const includeRoots=Array.isArray(raw.includeRoots)?raw.includeRoots.map(normalizeScopeRoot):[];
  const excludeRoots=Array.isArray(raw.excludeRoots)?raw.excludeRoots.map(normalizeScopeRoot):[];
  const out={includeRoots:[...new Set(includeRoots)],excludeRoots:[...new Set(excludeRoots)]};
  if(Array.isArray(raw.partitions)){
    const seenIds=new Set();
    out.partitions=raw.partitions.map((p)=>{
      if(!p||typeof p!=='object'||typeof p.id!=='string'||!/^[a-zA-Z0-9_.-]{1,64}$/.test(p.id)||seenIds.has(p.id))throw new Error('Visual OS surfaceScope partitions require unique valid ids');
      seenIds.add(p.id);
      const pInc=Array.isArray(p.includeRoots)&&p.includeRoots.length?p.includeRoots.map(normalizeScopeRoot):[];
      if(!pInc.length)throw new Error('Visual OS surfaceScope partition requires includeRoots: '+p.id);
      const pExc=Array.isArray(p.excludeRoots)?p.excludeRoots.map(normalizeScopeRoot):[];
      return {id:p.id,includeRoots:[...new Set(pInc)],excludeRoots:[...new Set(pExc)]};
    });
  }
  return out;
}
function classifySurfaceSignals(rel,body){
  let kind='primary-screen';
  if(/(?:_sheet|_bottom_sheet)\.[a-z.]+$|\/(?:sheets?|bottom_sheets?)\//i.test(rel)||(/\b(?:showModalBottomSheet|showBottomSheet|BottomSheet)\s*\(/.test(body)&&!/(?:_screen|_page|_view|_shell)\.[a-z.]+$/i.test(rel)))kind='bottom-sheet';
  else if(/(?:_dialog|_modal)\.[a-z.]+$|\/(?:dialogs?|modals?)\//i.test(rel)||((/\b(?:showDialog|showGeneralDialog|AlertDialog|SimpleDialog|Dialog)\s*\(|<dialog\b/.test(body))&&!/(?:_screen|_page|_view|_shell)\.[a-z.]+$/i.test(rel)))kind='dialog';
  else if(/(?:_tab)\.[a-z.]+$|\/tabs?\//i.test(rel)||((/\b(?:TabBar|TabBarView)\s*\(|role\s*=\s*["']tabpanel["']/.test(body))&&!/(?:_screen|_page|_view|_shell)\.[a-z.]+$/i.test(rel)))kind='tab';
  else if(/(?:_detail|_details)\.[a-z.]+$|\/details?\//i.test(rel))kind='detail';
  else if(/(?:_form)\.[a-z.]+$|\/forms?\//i.test(rel))kind='form';
  else if(/(?:_subview|_step|_drawer|_panel)\.[a-z.]+$|\/(?:subviews?|steps?|drawers?|panels?)\//i.test(rel))kind='secondary-screen';
  const subSurfaces=[];
  if(/\b(?:TabBar|TabBarView|CupertinoSegmentedControl)\b|role\s*=\s*["']tab(?:list|panel)?["']/i.test(body))subSurfaces.push('tabs');
  if(/\b(?:showDialog|showGeneralDialog|AlertDialog|SimpleDialog|Dialog)\s*\(|<dialog\b|role\s*=\s*["']dialog["']/i.test(body))subSurfaces.push('dialogs');
  if(/\b(?:showModalBottomSheet|showBottomSheet|BottomSheet|DraggableScrollableSheet)\s*\(/.test(body))subSurfaces.push('bottom-sheets');
  if(/<form\b|\b(?:Form|TextFormField)\s*\(/i.test(body))subSurfaces.push('forms');
  if(/<details\b|\b(?:ExpansionTile|ExpansionPanelList)\s*\(/i.test(body))subSurfaces.push('details');
  if(/\b(?:ListView\.builder|GridView\.builder|SliverList|FutureBuilder|StreamBuilder)\b|\b(?:@foreach|v-for|\.map\s*\()/i.test(body))subSurfaces.push('dynamic-content');
  const states=['default'];
  if(/\b(?:empty|isEmpty|EmptyState|noResults|zeroResults)\b/i.test(body))states.push('empty');
  if(/\b(?:loading|isLoading|skeleton|Skeleton|CircularProgressIndicator|LinearProgressIndicator|Shimmer)\b/i.test(body))states.push('loading');
  if(/\b(?:offline|isOffline|OfflineState|Connectivity|noConnection)\b/i.test(body))states.push('offline');
  if(/\b(?:error|hasError|ErrorState|serverError|ServerError|ErrorWidget)\b/i.test(body))states.push('error');
  if(/\b(?:forbidden|permissionDenied|unauthorized|AccessDenied|403)\b/i.test(body))states.push('forbidden');
  if(subSurfaces.includes('dynamic-content'))states.push('dynamic');
  return {kind,subSurfaces,states};
}
function matchesScopeRoot(rel,root){
  const normalized=String(rel??'').replaceAll('\\\\','/');
  if(root==='.')return true;
  return normalized===root||normalized.startsWith(root+'/');
}
function pathInScope(rel,scope){
  if(!rel)return true;
  if(scope.excludeRoots.some((root)=>matchesScopeRoot(rel,root)))return false;
  return scope.includeRoots.length===0||scope.includeRoots.some((root)=>matchesScopeRoot(rel,root));
}
function scopedStartDirs(root,scope){
  const roots=scope.includeRoots.length?scope.includeRoots:['.'];
  return roots.map((rel)=>{
    const full=rel==='.'?root:path.resolve(root,rel);
    const delta=path.relative(root,full);
    if(delta.startsWith('..')||path.isAbsolute(delta))throw new Error('Visual OS surfaceScope escapes project: '+rel);
    let cursor=root;
    if(fs.lstatSync(cursor).isSymbolicLink())throw Error('VISUAL_SOURCE_SYMLINK: project root');
    for(const part of delta.split(path.sep).filter(Boolean)){
      cursor=path.join(cursor,part);
      if(fs.lstatSync(cursor).isSymbolicLink())throw Error('VISUAL_SOURCE_SYMLINK: '+rel);
    }
    if(!fs.existsSync(full)||!fs.statSync(full).isDirectory())throw new Error('Visual OS surfaceScope root is missing or not a directory: '+rel);
    return full;
  });
}

// Configurable limit to bound file traversal
function walk(root, dir=root, out=[], limit=5000, scope={includeRoots:[],excludeRoots:[]},scan={issues:[],visited:0,seen:new Set()},depth=0) {
  if(depth>64){scan.issues.push({code:'VISUAL_SOURCE_DEPTH_BUDGET',path:path.relative(root,dir)});return out;}
  if (out.length >= limit || !fs.existsSync(dir)||scan.visited>100000) return out;
  let entries;try{entries=readVisualSourceDirectory(dir,100000-scan.visited);}
  catch(error){scan.issues.push({code:error.message.startsWith('VISUAL_')?error.message:'VISUAL_SOURCE_READ_FAILED',path:path.relative(root,dir)});return out;}
  for (const entry of entries) {
    if (out.length >= limit) break;
    if(++scan.visited>100000){scan.issues.push({code:'VISUAL_SOURCE_ENTRY_BUDGET'});break;}
    if (entry.isSymbolicLink()) {if(!IGNORE.has(entry.name))scan.issues.push({code:'VISUAL_SOURCE_SYMLINK',path:path.relative(root,path.join(dir,entry.name))});continue;}
    const full=path.join(dir,entry.name);
    const rel=path.relative(root,full).split(path.sep).join('/');
    if (!pathInScope(rel,scope) && scope.includeRoots.length===0) continue;
    if (entry.isDirectory()) {
      if (rel.split('/').some((part)=>IGNORE.has(part)||(part.startsWith('.')&&!scope.includeRoots.some((inc)=>matchesScopeRoot(rel,inc))))) continue;
      if (scope.excludeRoots.some((scopeRoot)=>matchesScopeRoot(rel,scopeRoot))) continue;
      walk(root,full,out,limit,scope,scan,depth+1);
    } else if (entry.isFile() && pathInScope(rel,scope) && (UI_FILE.test(entry.name) || entry.name === 'pubspec.yaml')&&!scan.seen.has(rel)){scan.seen.add(rel);out.push({full,rel});}
  }
  return out;
}


export function detectVisualSurfaces(root, limit=5000, rawScope={}) {
  root=path.resolve(root);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit>100000) throw new Error('Visual maxFiles must be a positive integer');
  const scope=normalizeSurfaceScope(rawScope);
  const collected=[],scan={issues:[],visited:0,seen:new Set()};
  for(const start of scopedStartDirs(root,scope)) walk(root,start,collected,limit+1,scope,scan);
  if(scope.partitions)for(const part of scope.partitions)scopedStartDirs(root,part);
  const deduped=[...new Map(collected.map((file)=>[file.rel,file])).values()];
  const discovered=deduped;
  const files=discovered.slice(0,limit),bodies=new Map(),budget={bytes:0};
  for(const file of files)try{bodies.set(file.full,readBoundedVisualSource(file.full,{budget}));}
  catch(error){scan.issues.push({code:error.message.startsWith('VISUAL_')?error.message:'VISUAL_SOURCE_READ_FAILED',path:file.rel});}
  const complete=discovered.length<=limit&&scan.issues.length===0;
  const read=file=>bodies.get(file)??'';
  const flutterRoots=files.filter((file)=>file.rel.endsWith('pubspec.yaml') && /^\s*sdk:\s*flutter\s*(?:#.*)?$/m.test(read(file.full))).map((file)=>path.dirname(file.full));
  const stacks=new Set(), surfaces=[], signals={responsive:new Map(),genericRisks:[]};
  const addResponsive=(stack,path)=>{ if(!signals.responsive.has(stack))signals.responsive.set(stack,[]); signals.responsive.get(stack).push(path); };
  const addGenericRisk=(path,reason)=>{ if(!signals.genericRisks.some((item)=>item.path===path&&item.reason===reason))signals.genericRisks.push({path,reason}); };
  for(const file of files) {
    const body=read(file.full), rel=file.rel;
    if (/\.blade\.php$/i.test(rel)) {
      stacks.add('blade');
      surfaces.push({path:rel,stack:'blade',...classifySurfaceSignals(rel,body)});
      if (/\b(?:sm|md|lg|xl|2xl):[\w[\]-]+|@media\s*\(|@container\s*\(/.test(body)) addResponsive('blade',rel);
      if (/\bx-data(?:=|\s)|\bx-show(?:=|\s)|\bx-transition\b/.test(body)) stacks.add('alpine');
      if (/\b(?:grid|flex)\b/.test(body)&&/\b(?:rounded-(?:xl|2xl|3xl)|shadow-(?:lg|xl|2xl))\b/.test(body)) addGenericRisk(rel,'WEB_UTILITY_CARD_COMPOSITION');
      if (/\b(?:sm|md|lg|xl|2xl):/.test(body)) stacks.add('tailwind');
    } else if (/\.dart$/i.test(rel) && /(?:^|\/)lib\//.test(rel) && (flutterRoots.some((dir)=>file.full.startsWith(path.join(dir,'lib')+path.sep)) || /package:flutter\//.test(body))) {
      stacks.add('flutter');
      const isPrimaryFlutterSurface=/(?:_screen|_page|_view|_shell)\.dart$|\/(?:screens?|pages?|views?|shells?)\//i.test(rel)||/\bScaffold\s*\(/.test(body);
      const isSecondaryFlutterSurface=/(?:_tab|_detail|_details|_dialog|_sheet|_bottom_sheet|_modal|_form|_step|_drawer)\.dart$|\/(?:tabs?|details?|dialogs?|sheets?|bottom_sheets?|modals?|forms?|steps?|drawers?)\//i.test(rel)||/\b(?:CupertinoPageScaffold|showDialog|showGeneralDialog|AlertDialog|SimpleDialog|showModalBottomSheet|showBottomSheet|BottomSheet|TabBarView)\s*\(/.test(body);
      if (isPrimaryFlutterSurface||isSecondaryFlutterSurface) surfaces.push({path:rel,stack:'flutter',...classifySurfaceSignals(rel,body)});
      if (/\b(?:LayoutBuilder|MediaQuery|OrientationBuilder|Responsive|Breakpoint|Expanded|Flexible)\b/.test(body)) addResponsive('flutter',rel);

      const rawScaffoldCount=(body.match(/\bScaffold\s*\(/g)??[]).length;
      const rawAppBarCount=(body.match(/\bAppBar\s*\(/g)??[]).length;
      const rawCardCount=(body.match(/\bCard\s*\(/g)??[]).length;
      const rawListTileCount=(body.match(/\bListTile\s*\(/g)??[]).length;
      const rawAlertDialogCount=(body.match(/\bAlertDialog\s*\(/g)??[]).length;
      const rawFrameworkNavCount=(body.match(/\b(?:BottomNavigationBar|NavigationBar|NavigationRail)\s*\(/g)??[]).length;

      if (isPrimaryFlutterSurface && rawScaffoldCount>0 && rawAppBarCount>0) addGenericRisk(rel,'FLUTTER_DEFAULT_SCAFFOLD_APPBAR_SHELL');
      if (isPrimaryFlutterSurface && rawFrameworkNavCount>0) addGenericRisk(rel,'FLUTTER_DEFAULT_PRIMARY_NAVIGATION');
      if (rawCardCount>=3 && rawListTileCount>=3) addGenericRisk(rel,'FLUTTER_CARD_LISTTILE_STACK');
      if (isPrimaryFlutterSurface && rawAlertDialogCount>=2) addGenericRisk(rel,'FLUTTER_RAW_DIALOG_DENSITY');
    } else if (/\.(?:js|mjs|cjs|ts|tsx|jsx|vue|svelte|astro|mdx|html?)$/i.test(rel)) {
      const frontendPath=/(?:^|\/)(?:src|resources|app|pages|components|public)\//.test(rel) || /^(?:index|app)\.html?$/i.test(rel);
      const customElement=/customElements\.define\s*\(/.test(body);
      const frontendSignals=customElement||/<[a-z][^>]*>|\b(?:document|window)\.|\b(?:React|Vue|Alpine|Astro)\b|\b(?:className|jsx|tsx)\b/i.test(body);
      if(frontendPath&&frontendSignals){
        stacks.add('javascript');
        if(customElement) stacks.add('web-components');
        surfaces.push({path:rel,stack:customElement?'web-components':'javascript',...classifySurfaceSignals(rel,body)});
        if(/@media\s*\(|@container\s*\(|matchMedia\s*\(|ResizeObserver\b|\b(?:sm|md|lg|xl|2xl):/.test(body)) addResponsive(customElement?'web-components':'javascript',rel);
        if(/\bx-data(?:=|\s)|\bAlpine\.(?:data|store|bind)\b/.test(body)) stacks.add('alpine');
        if(/\b(?:sm|md|lg|xl|2xl):/.test(body)) stacks.add('tailwind');
      }
    } else if (/\.(?:css|scss|sass)$/i.test(rel)) {
      if (/@media\s*\(|@container\s*\(/.test(body)) addResponsive('css',rel);
      if (/--[\w-]+\s*:/.test(body)) stacks.add('css');
    }
  }
  if (flutterRoots.length) stacks.add('flutter');
  if (['tailwind.config.js','tailwind.config.cjs','tailwind.config.mjs','tailwind.config.ts'].some((p)=>fs.existsSync(path.join(root,p)))) stacks.add('tailwind');
  let surfaceScanComplete=surfaces.length<=1000;
  let partitionSummary=null;
  if(scope.partitions?.length){
    const covered=new Set();
    partitionSummary=[];
    surfaceScanComplete=surfaces.length<=10000;
    for(const part of scope.partitions){
      const members=surfaces.filter((s)=>pathInScope(s.path,part));
      for(const m of members)covered.add(m.path);
      if(members.length>1000){surfaceScanComplete=false;scan.issues.push({code:'VISUAL_PARTITION_SURFACE_BUDGET',partition:part.id,count:members.length});}
      partitionSummary.push({id:part.id,surfaceCount:members.length,complete:members.length<=1000});
    }
    const uncovered=surfaces.filter((s)=>!covered.has(s.path));
    if(uncovered.length){surfaceScanComplete=false;scan.issues.push({code:'VISUAL_PARTITION_COVERAGE_GAP',uncoveredCount:uncovered.length,sample:uncovered[0].path});}
  }
  const webStacks=[...stacks].filter((s)=>['blade','javascript','web-components','tailwind','alpine'].includes(s));
  const uiBearing=stacks.has('flutter')||surfaces.length>0||webStacks.length>0;
  return {
    schemaVersion:'executionkit-visual-discovery/v1',
    uiBearing,
    scan:{complete:complete&&surfaceScanComplete,fileScanComplete:complete,surfaceScanComplete,limit,scannedFiles:files.length,discoveredSurfaceCount:surfaces.length,scope,issues:scan.issues,sourceBytes:budget.bytes,...(partitionSummary?{partitions:partitionSummary}:{})},
    stacks:[...stacks].sort(),
    surfaces:scope.partitions?.length?surfaces.slice(0,10000):surfaces.slice(0,1000),
    responsiveEvidence:Object.fromEntries([...signals.responsive].map(([k,v])=>[k,v.slice(0,100)])),
    genericRiskSignals:signals.genericRisks.length,
    genericRiskDetails:signals.genericRisks.slice(0,200),
  };
}

function configuredVisual(config) {
  return {
    enabled: config.v4?.systems?.visual?.enabled !== false,
    profile: String(config.v4?.systems?.visual?.profile ?? config.premiumExperience?.qualityProfile ?? 'PREMIUM').toUpperCase(),
    requireResponsive: true,
    requireComponentSystem: true,
    requireDesignAuthority: true,
    requireRenderedReview: true,
    requireProductionShapedData: config.v4?.systems?.visual?.requireProductionShapedData !== false,
    requireAccessibility: true,
    requireIndependentReview: true,
    surfaceScope: normalizeSurfaceScope(config.v4?.systems?.visual?.surfaceScope??config.visual?.surfaceScope??{}),
  };
}

export function inspectVisualOS(root,{boundary='task',config=null}={}) {
  root=path.resolve(root);
  const loaded=config??loadConfig(root).config;
  const policy=configuredVisual(loaded);
  const limit = loaded.visual?.maxFiles ?? loaded.v4?.systems?.visual?.maxFiles ?? 5000;
  const discovery=detectVisualSurfaces(root, limit, policy.surfaceScope);
  if(!discovery.scan.complete) return {schemaVersion:'executionkit-visual-os/v1',system:'visual-os',status:'FAIL',boundary,policy,discovery,findings:[{code:discovery.scan.surfaceScanComplete?'VISUAL_DISCOVERY_INCOMPLETE':'VISUAL_SURFACE_CENSUS_INCOMPLETE',severity:'HIGH',message:'Visual discovery reached source/file or screen limit; full surface inventory required before visual release acceptance.'}],requiredTestEvidence:[]};
  if(!discovery.uiBearing) return {schemaVersion:'executionkit-visual-os/v1',system:'visual-os',status:'NOT_APPLICABLE',boundary,policy,discovery,findings:[],requiredTestEvidence:[]};

  const findings=[];
  if(!policy.enabled) findings.push({code:'VISUAL_OS_DISABLED_WITH_UI',severity:'CRITICAL',message:'UI-bearing project cannot disable Visual OS in v4.'});
  if(policy.profile!=='PREMIUM') findings.push({code:'VISUAL_PROFILE_NOT_PREMIUM',severity:'HIGH',message:'UI-bearing v4 products require PREMIUM Visual OS profile.'});

  const evidenceBoundary=['wave','phase','release'].includes(boundary);
  let quality={enabled:false,errors:[{code:'VISUAL_QUALITY_CONTRACT_MISSING',message:'quality.contractPath is required for UI-bearing projects'}]};
  if(loaded.quality?.contractPath) quality=validateQuality(root,loaded,{release:evidenceBoundary});
  for(const error of quality.errors??[]) findings.push({code:error.code??'VISUAL_QUALITY_FAILED',severity:'HIGH',message:error.message??String(error)});

  const components=validateComponentSystem(root);
  if(policy.requireComponentSystem && ['NOT_CONFIGURED','FAIL'].includes(components.status)) {
    findings.push({code:'VISUAL_COMPONENT_SYSTEM_REQUIRED',severity:'HIGH',message:'Premium UI requires a non-empty reusable component contract/catalog.',detail:components.status});
  }
  for(const item of components.findings??[]) findings.push({...item,code:item.code??'VISUAL_COMPONENT_FINDING'});

  const design=designDrift(root);
  if(policy.requireDesignAuthority && design.status==='NOT_CONFIGURED') findings.push({code:'VISUAL_DESIGN_AUTHORITY_REQUIRED',severity:'HIGH',message:'Premium UI requires configured design/token authority.'});
  for(const item of design.findings??[]) findings.push({...item,code:item.code??'VISUAL_DESIGN_FINDING'});

  const rawAudit=auditUiConformance(root,{boundary:boundary==='task'?'ad-hoc':boundary});
  const scopedAuditFindings=(rawAudit.findings??[]).filter((item)=>!item.path||pathInScope(item.path,policy.surfaceScope));
  const scopedAuditSurfaces=(rawAudit.surfaces??[]).filter((item)=>pathInScope(item.path,policy.surfaceScope));
  const scopedBlocking=scopedAuditFindings.filter((item)=>['CRITICAL','HIGH'].includes(item.severity));
  const scopedReview=scopedAuditFindings.filter((item)=>item.severity==='REVIEW');
  const scopedPlatforms=[...new Set(scopedAuditSurfaces.map((item)=>item.platform).filter((item)=>item!=='other'))];
  const audit={
    ...rawAudit,
    surfaceCount:scopedAuditSurfaces.length,
    surfaces:scopedAuditSurfaces,
    findings:scopedAuditFindings,
    mechanicalStatus:scopedBlocking.length?'FAIL':scopedReview.length?'REVIEW_REQUIRED':'PASS',
    renderedReviewRequired:rawAudit.profile==='premium'&&scopedPlatforms.length>0,
    summary:{blocking:scopedBlocking.length,review:scopedReview.length,platforms:scopedPlatforms},
    scope:policy.surfaceScope,
  };
  for(const item of audit.findings??[]) findings.push(item);

  if(policy.requireResponsive) {
    const responsive=discovery.responsiveEvidence;
    if(discovery.stacks.includes('flutter') && !(responsive.flutter?.length)) findings.push({code:'VISUAL_FLUTTER_RESPONSIVE_EVIDENCE_MISSING',severity:'HIGH',message:'Flutter UI detected without mechanical responsive-layout evidence.'});
    const web=discovery.stacks.some((s)=>['blade','javascript','web-components','tailwind','alpine','css'].includes(s));
    const webResponsive=['blade','javascript','web-components','tailwind','alpine','css'].some((s)=>responsive[s]?.length);
    if(web && !webResponsive) findings.push({code:'VISUAL_WEB_RESPONSIVE_EVIDENCE_MISSING',severity:'HIGH',message:'Web UI detected without responsive breakpoint/media/container evidence.'});
  }

  // Generate/render/research belongs to the host, never to this deterministic gate.
  const production=inspectVisualProduction(root,{
    boundary,surfaces:discovery.surfaces,mandatory:isV5(loaded),
  });
  if(production.required)for(const finding of production.findings)findings.push(finding);
  if(discovery.genericRiskSignals>0) findings.push({code:'VISUAL_GENERIC_PATTERN_REVIEW_REQUIRED',severity:'REVIEW',message:'Heuristic generic/basic UI signals were detected; rendered product-specific review is required.',count:discovery.genericRiskSignals,details:discovery.genericRiskDetails??[]});

  const requiredTestEvidence=[];
  const web=discovery.stacks.some((s)=>['blade','javascript','web-components','tailwind','alpine','css'].includes(s));
  if(web) requiredTestEvidence.push('browser-responsive','visual-regression','accessibility','keyboard-navigation','performance');
  if(web&&evidenceBoundary){const lighthouse=inspectLighthouseGate(root,{boundary});if(lighthouse.status!=='PASS')findings.push({code:'VISUAL_MOBILE_LIGHTHOUSE_REQUIRED',severity:'HIGH',message:lighthouse.reason,nextCommand:lighthouse.nextCommand});}
  if(discovery.stacks.includes('flutter')) requiredTestEvidence.push('flutter-goldens','flutter-semantics','flutter-responsive','device-or-emulator');

  const renderedEvidenceRequired=policy.requireRenderedReview&&evidenceBoundary;
  const qualityEvidenceCurrent=quality.enabled===true&&(quality.errors??[]).length===0;
  const visualEvidence=evidenceBoundary?inspectVisualEvidence(root,{boundary}):{status:'DEFERRED_TO_BOUNDARY'};
  if(evidenceBoundary){
    for(const error of visualEvidence.errors??[])findings.push({code:error.code??'VISUAL_RENDERED_AUDIT_FAILED',severity:'HIGH',message:error.message??'Rendered visual evidence failed audit',cellId:error.cellId});
    for(const finding of visualEvidence.unresolved??[])findings.push({...finding,code:'VISUAL_RENDERED_'+finding.category,severity:finding.severity==='P0'?'CRITICAL':finding.severity==='P1'?'HIGH':'REVIEW',message:finding.reason??'Rendered visual finding requires resolution'});
    if(['FAIL','MISSING','BLOCKED'].includes(visualEvidence.status)&&!(visualEvidence.errors??[]).length&&!(visualEvidence.unresolved??[]).length)findings.push({code:'VISUAL_RENDERED_AUDIT_FAILED',severity:'HIGH',message:'Required rendered visual audit is '+visualEvidence.status});
  }
  const blocking=findings.filter((f)=>['CRITICAL','HIGH'].includes(f.severity));
  const reviews=findings.filter((f)=>f.severity==='REVIEW');
  const actualRenderedReview=['PASS','VALIDATED'].includes(visualEvidence.status);
  const independentReviewProven=actualRenderedReview;
  const antiGenericReviewProven=actualRenderedReview;
  const renderedEvidenceProven=renderedEvidenceRequired&&qualityEvidenceCurrent&&actualRenderedReview;
  const renderedUnproven=renderedEvidenceRequired&&!renderedEvidenceProven;
  const heuristicReviewCodes=new Set(['VISUAL_GENERIC_PATTERN_REVIEW_REQUIRED','AI_GENERIC_UI_SIGNAL']);
  const activeReviews=reviews.filter((finding)=>!heuristicReviewCodes.has(finding.code)||!antiGenericReviewProven);
  const status=blocking.length?'FAIL':(activeReviews.length||renderedUnproven)?'REVIEW_REQUIRED':'PASS';
  return {
    schemaVersion:'executionkit-visual-os/v1',
    system:'visual-os',
    status,
    boundary,
    policy,
    discovery,
    quality:{enabled:quality.enabled,profile:quality.profile??null,errors:quality.errors??[],warnings:quality.warnings??[]},
    components,
    design,
    audit,
    findings,
    requiredTestEvidence,
    visualEvidence,
    production,
    renderedEvidence:{
      required:renderedEvidenceRequired,
      proven:renderedEvidenceProven,
      independentReviewRequired:policy.requireIndependentReview,
      independentReviewProven,
      antiGenericReviewRequired:reviews.some((finding)=>heuristicReviewCodes.has(finding.code)),
      antiGenericReviewProven,
      evidencePath:quality.evidencePath??loaded.quality?.contractPath??null,
    },
    authority:'Test OS drives behavioral journeys. Visual OS captures rendered quality. Audit OS independently recomputes census, image/review integrity and certification.',
    limitations:['Static heuristics cannot certify premium quality. Rendered images must participate in a signed vision request and independent audit. Model judgment remains fallible; operator-owned separate attestation keys and trusted project hooks are required.'],
  };
}
