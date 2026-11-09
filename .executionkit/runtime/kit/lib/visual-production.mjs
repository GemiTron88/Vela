// Visual OS v5: project-generic mandatory image/illustration production inventory.
// Only reads bounded local, exact source files at wave/phase/release. Never generates media,
// calls remote AI, trusts a prompt as an image, or certifies live server availability.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {inspectMediaBytes,inspectSafeSVG,loadMediaDecodeCache,saveMediaDecodeCache} from './media-integrity.mjs';
import {verifySealed,canonical} from './visual-contract.mjs';

export const VISUAL_PRODUCTION_FILE='executionkit.media.json';
export const REQUIRED_VISUAL_ROLES=Object.freeze([
  'hero','banner','background','illustration','icon','empty','dynamic',
]);
const ROLES=new Set(REQUIRED_VISUAL_ROLES);
const PALETTE=/^[a-z][a-z0-9_-]{0,39}$/;
const ID=/^[a-z][a-z0-9_.-]{1,79}$/;
const SHA=/^[a-f0-9]{64}$/;
const DOC_MAX=1024*1024,ASSET_MAX=12*1024*1024,ASSETS_MAX=750,SURFACES_MAX=1000;
const readBudgets=new Map();
const TOTAL_MEDIA_BYTES=256*1024*1024,MEDIA_BUDGET_MS=30000;
const BOUNDARIES=new Set(['wave','phase','release']);
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function safePath(root,rel,{file=true}={}){
  if(typeof rel!=='string'||!rel||rel.length>320||path.isAbsolute(rel)||rel.includes('\\')||
    rel.split('/').some(x=>!x||x==='.'||x==='..')||! /^[a-zA-Z0-9_./@-]+$/.test(rel))
      throw Error('VISUAL_MEDIA_INVALID_PATH');
  const full=path.resolve(root,rel),r=path.relative(root,full);
  if(r.startsWith('..')||path.isAbsolute(r))throw Error('VISUAL_MEDIA_PATH_ESCAPE');
  // Files may be outside the Git index during generation but never follow symlinks.
  let ptr=root;
  for(const part of rel.split('/')){
    ptr=path.join(ptr,part);
    if(fs.existsSync(ptr)&&fs.lstatSync(ptr).isSymbolicLink())throw Error('VISUAL_MEDIA_SYMLINK');
  }
  if(file&&(!fs.existsSync(full)||!fs.statSync(full).isFile()))throw Error('VISUAL_MEDIA_FILE_MISSING');
  return full;
}
function failure(code,message,surface=null){
  return {code,severity:'HIGH',message,...(surface?{path:surface}:{})};
}
function formatOf(buffer){
  if(buffer.length>=12&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP')return 'image/webp';
  if(buffer.length>=12&&buffer.toString('ascii',4,8)==='ftyp'&&['avif','avis'].includes(buffer.toString('ascii',8,12)))return 'image/avif';
  if(buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))return 'image/png';
  if(buffer.length>=3&&buffer.subarray(0,3).equals(Buffer.from('ffd8ff','hex')))return 'image/jpeg';
  if(buffer.length>=7&&/^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)?<svg\b/i.test(buffer.toString('utf8',0,256).replace(/^\uFEFF/,'').trimStart()))return 'image/svg+xml';
  if(buffer.length>=4&&buffer.toString('ascii',0,4)==='wOF2')return 'font/woff2';
  if(buffer.length>=4&&buffer.toString('ascii',0,4)==='wOFF')return 'font/woff';
  if(buffer.length>=4&&buffer.toString('ascii',0,4)==='OTTO')return 'font/otf';
  if(buffer.length>=4&&(buffer.readUInt32BE(0)===0x00010000||buffer.toString('ascii',0,4)==='true'))return 'font/ttf';
  if(buffer.length>=16&&/^\{[\s\S]*"v"\s*:[\s\S]*"layers"\s*:\s*\[/.test(buffer.toString('utf8',0,Math.min(buffer.length,4096)).trimStart()))return 'application/lottie+json';
  return null;
}
const VECTOR_GENERATORS=new Set([
  'local-svg-code','flutter-custom-painter','css-drawing','html-canvas',
  'procedural-graphics','native-chart-primitives','licensed-icon-system',
]);
function checkedProofFile(root,rel,{json=true,maxBytes=65536}={}){
  const full=safePath(root,rel),fd=fs.openSync(full,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));
  let body;
  try{
    const stat=fs.fstatSync(fd),budget=readBudgets.get(root);
    if(budget){
      if(Date.now()-budget.started>MEDIA_BUDGET_MS||budget.bytes+stat.size>TOTAL_MEDIA_BYTES)throw Error('VISUAL_MEDIA_AGGREGATE_BUDGET');
      budget.bytes+=stat.size;
    }
    if(!stat.isFile()||stat.size<16||stat.size>maxBytes)throw Error('VISUAL_PROOF_SIZE_INVALID');
    const buffer=Buffer.alloc(stat.size+1);let used=0;
    while(used<buffer.length){const n=fs.readSync(fd,buffer,used,buffer.length-used,null);if(!n)break;used+=n;}
    const after=fs.fstatSync(fd),current=fs.lstatSync(safePath(root,rel));
    if(used!==stat.size||after.size!==stat.size||current.ino!==stat.ino||current.dev!==stat.dev)throw Error('VISUAL_PROOF_CHANGED_DURING_READ');
    body=buffer.subarray(0,used);
  }finally{fs.closeSync(fd);}
  return json?JSON.parse(body.toString('utf8')):body;
}
function sourceDigest(root,rel){return crypto.createHash('sha256').update(checkedProofFile(root,rel,{json:false,maxBytes:2*1024*1024})).digest('hex');}
function authenticatedProof(root,ref,kind='review'){
  const proof=checkedProofFile(root,ref);
  if(!verifySealed(proof,kind))throw Error('VISUAL_PROOF_SIGNATURE_INVALID');
  return proof;
}
function verifyReceiptContext(root,spec,proof){
  const expectedProject=spec.projectIdentity??null;
  if(expectedProject!==null&&proof.projectIdentity!==expectedProject||
    proof.projectIdentity!==undefined&&expectedProject!==null&&proof.projectIdentity!==expectedProject)
    throw Error('VISUAL_PROOF_PROJECT_MISMATCH');
  if(proof.projectIdentity!==undefined&&expectedProject===null){
    const visualCfgPath=path.join(root,'executionkit.visual.json');
    if(fs.existsSync(visualCfgPath)){
      const vcfg=checkedProofFile(root,'executionkit.visual.json',{maxBytes:DOC_MAX});
      if(vcfg?.app?.identity&&proof.projectIdentity!==vcfg.app.identity)throw Error('VISUAL_PROOF_PROJECT_MISMATCH');
    }
  }
  if(spec.gitSha&&proof.gitSha!==spec.gitSha)throw Error('VISUAL_PROOF_CANDIDATE_MISMATCH');
  const runId=proof.visualRunId??spec.visualRunId??null;
  if(runId!==null){
    if(typeof runId!=='string'||!/^[a-f0-9-]{36}$/.test(runId)||(spec.visualRunId&&proof.visualRunId!==spec.visualRunId))
      throw Error('VISUAL_PROOF_RUN_CELL_MISMATCH');
    const runManifest=checkedProofFile(root,`.executionkit/visual/runs/${runId}/manifest.json`,{maxBytes:DOC_MAX});
    if(!verifySealed(runManifest,'capture')||runManifest.runId!==runId)throw Error('VISUAL_PROOF_RUN_CELL_MISMATCH');
    if(proof.reviewCell){
      const entry=(runManifest.entries??[]).find(e=>e.cellId===proof.reviewCell||e.surfaceId===proof.reviewCell);
      if(!entry||proof.screenshot?.sha256&&entry.image?.sha256&&proof.screenshot.sha256!==entry.image.sha256)
        throw Error('VISUAL_PROOF_RUN_CELL_MISMATCH');
    }
  }
}
export function visualAssetIdentity(asset){
  return crypto.createHash('sha256').update(canonical({id:asset.id,source:asset.source,role:asset.role,kind:asset.kind,themeAware:asset.themeAware,delivery:asset.delivery,provenance:asset.provenance,variants:asset.variants})).digest('hex');
}
function boundAssetProof(root,asset,ref,schema,kind='review',spec={}){
  const proof=authenticatedProof(root,ref,kind);
  if(proof.schemaVersion!==schema||proof.assetIdentity!==visualAssetIdentity(asset)||proof.assetId!==asset.id||proof.source!==asset.source||
    proof.sourceSha256!==sourceDigest(root,asset.source)||
    !Array.isArray(proof.variantSha256)||proof.variantSha256.length!==asset.variants.length||
    !asset.variants.every(v=>proof.variantSha256.includes(v.sha256)))throw Error('VISUAL_PROOF_ASSET_MISMATCH');
  verifyReceiptContext(root,spec,proof);
  return proof;
}
function matchesAssetTarget(bindingPath,reference,asset){
  const clean=reference.replace(/^\//,'');
  if(asset.variants.some(v=>v.path===clean||v.path==='public/'+clean||path.posix.normalize(path.posix.join(path.posix.dirname(bindingPath),clean))===v.path))return true;
  const codePath=asset.provenance?.sourceCode?.path;
  if(codePath&&(clean===codePath||path.posix.normalize(path.posix.join(path.posix.dirname(bindingPath),clean))===codePath||asset.provenance?.sourceCode?.symbol&&reference===asset.provenance.sourceCode.symbol))return true;
  return false;
}
function verifiedReview(root,asset,origin,spec={}){
  const proof=boundAssetProof(root,asset,origin.reviewEvidenceRef,'executionkit-visual-artwork-review/v2','review',spec);
  if(!isObject(proof)||proof.schemaVersion!=='executionkit-visual-artwork-review/v2'||
    proof.assetId!==asset.id||proof.source!==asset.source||
    proof.reviewerId!==origin.reviewerId||proof.producerId!==origin.producerId||typeof proof.producerId!=='string'||proof.producerId.length<3||proof.producerId===proof.reviewerId||proof.verdict!=='PASS'||
    !Array.isArray(proof.variantSha256)||
    proof.variantSha256.length!==asset.variants.length||
    !asset.variants.every(v=>proof.variantSha256.includes(v.sha256))||
    !isObject(proof.screenshot)||!SHA.test(proof.screenshot.sha256??''))throw Error('VISUAL_REVIEW_NOT_BOUND_TO_ARTWORK');
  if(asset.themeAware!==true&&proof.neutralThemeApproved!==true)throw Error('VISUAL_NEUTRAL_THEME_UNREVIEWED');
  const bindings=proof.uiBindings;
  if(!Array.isArray(bindings)||!bindings.length||bindings.length>32)throw Error('VISUAL_UI_REFERENCE_REQUIRED');
  for(const binding of bindings){
    if(!isObject(binding)||binding.path!==asset.source||! /\.(?:php|html?|[mc]?jsx?|tsx?|vue|svelte|astro|mdx|dart)$/.test(binding.path)||typeof binding.reference!=='string'||!binding.reference||binding.sourceSha256!==sourceDigest(root,binding.path))throw Error('VISUAL_UI_REFERENCE_INVALID');
    const screenBody=checkedProofFile(root,binding.path,{json:false,maxBytes:2*1024*1024}).toString('utf8');
    if(binding.componentPath!==undefined){
      if(typeof binding.componentPath!=='string'||!/\.(?:php|html?|[mc]?jsx?|tsx?|vue|svelte|astro|mdx|dart|css|scss)$/.test(binding.componentPath)||
        binding.componentSha256!==sourceDigest(root,binding.componentPath))throw Error('VISUAL_UI_REFERENCE_INVALID');
      const componentBody=checkedProofFile(root,binding.componentPath,{json:false,maxBytes:2*1024*1024}).toString('utf8');
      const componentHint=typeof binding.componentSymbol==='string'&&binding.componentSymbol.trim()?binding.componentSymbol.trim():path.posix.basename(binding.componentPath).replace(/\.[^.]+$/,'');
      if(!screenBody.includes(componentHint)&&!screenBody.includes(binding.componentPath)||
        !componentBody.includes(binding.reference)||!matchesAssetTarget(binding.componentPath,binding.reference,asset))
        throw Error('VISUAL_UI_REFERENCE_INVALID');
    }else if(!screenBody.includes(binding.reference)||!matchesAssetTarget(binding.path,binding.reference,asset)){
      throw Error('VISUAL_UI_REFERENCE_INVALID');
    }
  }
  const bytes=checkedProofFile(root,proof.screenshot.path,{json:false,maxBytes:10*1024*1024});
  inspectMediaBytes(bytes,formatOf(bytes));
  if(!['image/png','image/webp','image/jpeg'].includes(formatOf(bytes))||
    crypto.createHash('sha256').update(bytes).digest('hex')!==proof.screenshot.sha256)
    throw Error('VISUAL_REVIEW_SCREENSHOT_INVALID');
}
function verifiedRoleExemption(root,surface,role,entry,spec={}){
  const receipt=authenticatedProof(root,entry.reviewEvidenceRef);
  if(!isObject(receipt)||receipt.schemaVersion!=='executionkit-visual-role-exemption/v2'||
    receipt.sourceSha256!==sourceDigest(root,surface.source)||typeof receipt.producerId!=='string'||receipt.producerId===receipt.reviewerId||
    receipt.source!==surface.source||receipt.role!==role||
    receipt.reviewCell!==entry.reviewCell||receipt.verdict!=='NOT_APPLICABLE'||
    receipt.reason!==entry.reason||
    typeof receipt.reviewerId!=='string'||receipt.reviewerId.length<3||
    !isObject(receipt.screenshot)||!SHA.test(receipt.screenshot.sha256??''))
    throw Error('VISUAL_EXEMPTION_NOT_BOUND_TO_SURFACE_ROLE');
  verifyReceiptContext(root,spec,receipt);
  const bytes=checkedProofFile(root,receipt.screenshot.path,{json:false,maxBytes:10*1024*1024});
  inspectMediaBytes(bytes,formatOf(bytes));
  if(!['image/png','image/webp','image/jpeg'].includes(formatOf(bytes))||
    crypto.createHash('sha256').update(bytes).digest('hex')!==receipt.screenshot.sha256)
    throw Error('VISUAL_EXEMPTION_SCREENSHOT_INVALID');
}
function originalVectorSource(root,origin){
  if(!checkedProofFile(root,origin.designSpecRef,{json:false}).length)
    throw Error('VISUAL_VECTOR_DESIGN_MISSING');
  if(origin.generator==='local-svg-code'||origin.sourceSvg){
    const source=origin.sourceSvg;
    if(!isObject(source)||!SHA.test(source.sha256??''))throw Error('VISUAL_ORIGINAL_VECTOR_MISSING');
    const bytes=checkedProofFile(root,source.path,{json:false,maxBytes:ASSET_MAX});
    if(formatOf(bytes)!=='image/svg+xml'||crypto.createHash('sha256').update(bytes).digest('hex')!==source.sha256)
      throw Error('VISUAL_ORIGINAL_VECTOR_INVALID');
    safeSvg(bytes);
    return;
  }
  const code=origin.sourceCode;
  if(!isObject(code)||typeof code.path!=='string'||!SHA.test(code.sha256??''))throw Error('VISUAL_ORIGINAL_VECTOR_MISSING');
  const bytes=checkedProofFile(root,code.path,{json:false,maxBytes:2*1024*1024});
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==code.sha256)throw Error('VISUAL_ORIGINAL_VECTOR_INVALID');
  const text=bytes.toString('utf8');
  const patterns={
    'flutter-custom-painter':/\b(?:CustomPainter|CustomPaint|Canvas|Paint|Path)\b/,
    'css-drawing':/(?:linear-gradient|radial-gradient|conic-gradient|clip-path|@keyframes|box-shadow|border-radius)/i,
    'html-canvas':/\b(?:getContext\s*\(\s*['"](?:2d|webgl2?)['"]|<canvas\b|Path2D)\b/i,
    'procedural-graphics':/\b(?:CustomPainter|Path2D|svg|canvas|shader|gradient|polygon|bezier)/i,
    'native-chart-primitives':/\b(?:CustomPainter|LineChart|BarChart|PieChart|Sparkline|Canvas|Chart|polyline|path)\b/i,
    'licensed-icon-system':/\b(?:IconData|Icons\.|CupertinoIcons\.|Lucide|Heroicons|MaterialIcons|<svg\b)/i,
  };
  const rule=patterns[origin.generator];
  if(!rule||!rule.test(text))throw Error('VISUAL_ORIGINAL_VECTOR_INVALID');
}
function safeSvg(bytes){ return inspectSafeSVG(bytes); }
function checkThemeAuthority(root,spec,findings){
  for(const candidate of ['executionkit.design.json','design/tokens.json']){
    const full=path.join(root,candidate);
    if(!fs.existsSync(full)||fs.lstatSync(full).isSymbolicLink())continue;
    try{
      const design=checkedProofFile(root,candidate,{maxBytes:DOC_MAX});
      const palettes=Array.isArray(design?.palettes)?design.palettes.map(p=>typeof p==='string'?p:p?.id).filter(Boolean):
        Array.isArray(design?.paletteIds)?design.paletteIds:
        isObject(design?.palettes)?Object.keys(design.palettes):[];
      const modes=Array.isArray(design?.modes)?design.modes:Array.isArray(design?.themes)?design.themes:[];
      if(palettes.some(p=>!spec.theme.paletteIds.includes(p))||modes.filter(m=>['light','dark'].includes(m)).some(m=>!spec.theme.modes.includes(m))){
        findings.push(failure('VISUAL_PRODUCTION_THEME_CENSUS_MISMATCH','Media manifest theme palettes or modes omit project design authority declarations in '+candidate));
      }
    }catch{}
  }
  const vcfgFile=path.join(root,'executionkit.visual.json');
  if(fs.existsSync(vcfgFile)&&!fs.lstatSync(vcfgFile).isSymbolicLink()){
    try{
      const vcfg=checkedProofFile(root,'executionkit.visual.json',{maxBytes:DOC_MAX});
      const vThemes=Array.isArray(vcfg?.themes)?vcfg.themes.filter(m=>['light','dark'].includes(m)):[];
      if(vThemes.some(m=>!spec.theme.modes.includes(m)))
        findings.push(failure('VISUAL_PRODUCTION_THEME_CENSUS_MISMATCH','Media manifest theme modes omit themes declared in executionkit.visual.json'));
    }catch{}
  }
}

export function inspectVisualProduction(root,{boundary='release',surfaces=[],mandatory=true}={}){
  const findings=[],required=BOUNDARIES.has(boundary)&&mandatory;
  const output=(status,extra={})=>{
    if(required&&root)saveMediaDecodeCache(root);
    readBudgets.delete(root);
    return ({
      schemaVersion:'executionkit-visual-production/v1',status,required,boundary,
      contract:VISUAL_PRODUCTION_FILE,findings,...extra,
    });
  };
  if(!required)return output('DEFERRED_TO_BOUNDARY');
  root=path.resolve(root);
  loadMediaDecodeCache(root);
  readBudgets.set(root,{bytes:0,started:Date.now()});
  if(fs.lstatSync(root).isSymbolicLink())return output('FAIL',{findings:[failure('VISUAL_MEDIA_SYMLINK','Project root must be a real directory.')]});
  const contractRel=!fs.existsSync(path.join(root,VISUAL_PRODUCTION_FILE))&&fs.existsSync(path.join(root,'.executionkit/visual/media-production.json'))?'.executionkit/visual/media-production.json':VISUAL_PRODUCTION_FILE;
  const file=path.join(root,contractRel);
  if(!fs.existsSync(file)){
    findings.push(failure('VISUAL_PRODUCTION_MANIFEST_REQUIRED',
      'UI project needs a complete real scene/banner/background/empty/icon/dynamic coverage inventory and verified media, not only prompts.'));
    return output('FAIL',{inventory:{requiredSurfaces:surfaces.length,documentedSurfaces:0,verifiedAssets:0}});
  }
  let spec;
  const maxSurfaces=Math.min(10000,Math.max(SURFACES_MAX,surfaces.length));
  const maxAssets=Math.min(5000,Math.max(ASSETS_MAX,surfaces.length*2));
  try{
    const st=fs.lstatSync(file);
    if(!st.isFile()||st.isSymbolicLink()||st.size>DOC_MAX)throw Error('VISUAL_MEDIA_MANIFEST_OVERSIZE_OR_UNSAFE');
    spec=checkedProofFile(root,contractRel,{maxBytes:DOC_MAX});
    if(!isObject(spec)||spec.schemaVersion!=='executionkit-media-production/v1'||
      !Array.isArray(spec.surfaces)||spec.surfaces.length<1||spec.surfaces.length>maxSurfaces||
      !Array.isArray(spec.assets)||spec.assets.length>maxAssets||
      !isObject(spec.theme)||!Array.isArray(spec.theme.paletteIds)||
      !Array.isArray(spec.theme.modes)||!spec.theme.modes.length)throw Error('VISUAL_MEDIA_MANIFEST_INVALID');
    if(spec.theme.paletteIds.length<1||spec.theme.paletteIds.length>16||
      new Set(spec.theme.paletteIds).size!==spec.theme.paletteIds.length||
      spec.theme.paletteIds.some(x=>typeof x!=='string'||!PALETTE.test(x))||
      new Set(spec.theme.modes).size!==spec.theme.modes.length||
      spec.theme.modes.some(x=>!['light','dark'].includes(x)))throw Error('VISUAL_MEDIA_THEME_INVALID');
  }catch(e){
    findings.push(failure('VISUAL_PRODUCTION_MANIFEST_INVALID',String(e.message).slice(0,160)));
    return output('FAIL',{inventory:{requiredSurfaces:surfaces.length,documentedSurfaces:0,verifiedAssets:0}});
  }
  checkThemeAuthority(root,spec,findings);
  const expected=new Set(surfaces.map(s=>s.path).filter(Boolean));
  const mapped=new Set(),idMap=new Map(),entries=new Map();
  for(const surface of spec.surfaces){
    if(!isObject(surface)||typeof surface.source!=='string'||mapped.has(surface.source)||
      !isObject(surface.roles)){
      findings.push(failure('VISUAL_PRODUCTION_SURFACE_INVALID','Duplicate or invalid surface mapping.'));continue;
    }
    mapped.add(surface.source);
    try{safePath(root,surface.source);}
    catch{findings.push(failure('VISUAL_PRODUCTION_SURFACE_SOURCE_MISSING','Surface source file not found or unsafe.',surface.source));}
    for(const role of REQUIRED_VISUAL_ROLES){
      const entry=surface.roles[role];
      if(!isObject(entry)||!['required','not_applicable'].includes(entry.state)){
        findings.push(failure('VISUAL_PRODUCTION_ROLE_UNMAPPED','Mandatory visual role '+role+' not accounted for.',surface.source));continue;
      }
      if(entry.state==='not_applicable'){
        if(typeof entry.reason!=='string'||entry.reason.trim().length<32||
          typeof entry.reviewCell!=='string'||!ID.test(entry.reviewCell)||
          typeof entry.reviewEvidenceRef!=='string'){
          findings.push(failure('VISUAL_PRODUCTION_EXEMPTION_UNREVIEWED',
            'An irrelevant role needs a specific rationale, independent review cell and real screenshot-bound proof.',surface.source));
        }else try{
          verifiedRoleExemption(root,surface,role,entry,spec);
        }catch(e){findings.push(failure('VISUAL_PRODUCTION_EXEMPTION_UNREVIEWED',e.message,surface.source));}
      }else if(!Array.isArray(entry.assetIds)||entry.assetIds.length===0||
        entry.assetIds.some(x=>typeof x!=='string'||!ID.test(x))){
        findings.push(failure('VISUAL_PRODUCTION_ASSET_COVERAGE_MISSING',
          'A required role needs at least one verifiable asset ID.',surface.source));
      }else for(const id of entry.assetIds){
        if(!entries.has(id))entries.set(id,new Set());
        entries.get(id).add(role+'@'+surface.source);
      }
    }
  }
  for(const p of expected)if(!mapped.has(p))
    findings.push(failure('VISUAL_PRODUCTION_SURFACE_UNMAPPED',
      'Discovered UI surface is absent from visual media inventory.',p));
  let verified=0;
  const binaryOwners=new Map(),referencedFiles=new Set();
  for(const asset of spec.assets){
    if(!isObject(asset)||typeof asset.id!=='string'||!ID.test(asset.id)||idMap.has(asset.id)||
      typeof asset.source!=='string'||!mapped.has(asset.source)||
      !ROLES.has(asset.role)||!['static','dynamic-category'].includes(asset.kind)||
      !Array.isArray(asset.variants)||!asset.variants.length||asset.variants.length>32||asset.variants.some(v=>!isObject(v))){
      findings.push(failure('VISUAL_PRODUCTION_ASSET_INVALID',
        'Invalid/duplicate asset, missing surface mapping or missing variants.'));continue;
    }
    idMap.set(asset.id,asset);
    if(!entries.get(asset.id)?.has(asset.role+'@'+asset.source))
      findings.push(failure('VISUAL_PRODUCTION_ASSET_UNREFERENCED','Asset is not referenced by its declared screen/role.',asset.source));
    // Generation quota exhaustion triggers host-owned licensed reference search/edit.
    // The Kit never fetches or edits online images and never treats similarity alone as rights.
    // This provenance contract applies to all approved image sources, not only web fallbacks.
    const origin=asset.provenance;
    const modes=new Set(['generated','owned-original','authored-vector','licensed-web-edited']);
    if(!isObject(origin)||!modes.has(origin.method)||!SHA.test(origin.promptSha256??'')||
      typeof origin.reviewerId!=='string'||origin.reviewerId.length<3||
      typeof origin.reviewEvidenceRef!=='string'||origin.reviewEvidenceRef.length<8){
      findings.push(failure('VISUAL_PRODUCTION_ORIGIN_UNVERIFIED',
        'Every image requires exact prompt identity, provenance and independent review reference.',asset.source));
    }else if(origin.method==='authored-vector'){
      if(origin.sourceSvg?.path)referencedFiles.add(origin.sourceSvg.path);
      if(origin.sourceCode?.path)referencedFiles.add(origin.sourceCode.path);
      const isSvgGenerator=origin.generator==='local-svg-code';
      const localVector=asset.delivery==='local'&&asset.variants.every(v=>isSvgGenerator?v.mime==='image/svg+xml':['image/svg+xml','image/png','image/webp','application/lottie+json'].includes(v.mime));
      const serverWebP=asset.delivery==='server-cached'&&asset.variants.every(v=>v.mime==='image/webp');
      if(!['static','dynamic-category'].includes(asset.kind)||!(localVector||serverWebP)||
        !VECTOR_GENERATORS.has(origin.generator)||
        typeof origin.designSpecRef!=='string'||origin.designSpecRef.length<8||
        origin.originalCompositionReviewed!==true){
        findings.push(failure('VISUAL_PRODUCTION_VECTOR_EVIDENCE_REQUIRED',
          'Hand-authored vector/procedural artwork requires a supported generator, real design spec, review and verified vector/rendered output.',asset.source));
      }else try{
        originalVectorSource(root,origin);
      }catch(e){findings.push(failure('VISUAL_PRODUCTION_VECTOR_EVIDENCE_REQUIRED',e.message,asset.source));}
    }else if(origin.method==='licensed-web-edited'){
      const approvedLicenses=new Set(['CC0-1.0','CC-BY-4.0','PUBLIC_DOMAIN_VERIFIED','COMMERCIAL_MODIFICATION_LICENSE']);
      const license=origin.license,source=origin.source;
      if(!isObject(source)||typeof source.url!=='string'||!/^https:\/\/[^\s@?#]+(?:\/[^\s?#]*)?$/.test(source.url)||
        !isObject(license)||!approvedLicenses.has(license.type)||
        license.commercialUseAllowed!==true||license.derivativesAllowed!==true||
        typeof license.evidenceRef!=='string'||license.evidenceRef.length<8||
        typeof origin.searchEvidenceRef!=='string'||origin.searchEvidenceRef.length<8||
        typeof origin.promptMatchReview!=='string'||origin.promptMatchReview.length<32||
        !Array.isArray(origin.edits)||!origin.edits.includes('crop_resize')||
        !origin.edits.includes('palette_adapt')||
        typeof origin.attribution!=='string'){
        findings.push(failure('VISUAL_PRODUCTION_WEB_LICENSE_UNVERIFIED',
          'Online image fallback requires commercial modification rights, exact source/license proof, prompt-match review, actual crop/color edits and attribution.',asset.source));
      }
    }
    if(asset.provenance?.method==='licensed-web-edited'&&asset.variants.some(v=>v.mime==='image/svg+xml'))
      findings.push(failure('VISUAL_PRODUCTION_WEB_VECTOR_NOT_ORIGINAL',
        'Do not misrepresent an edited online SVG as originally authored.',asset.source));
    // Review receipt must be a real local proof bound to every exact variant hash
    // and one actual independently captured raster screenshot, not a free-form string.
    if(isObject(origin)&&typeof origin.reviewEvidenceRef==='string')try{
      verifiedReview(root,asset,origin,spec);
    }catch(e){findings.push(failure('VISUAL_PRODUCTION_REVIEW_EVIDENCE_INVALID',e.message,asset.source));}
    if(isObject(origin)&&['generated','owned-original'].includes(origin.method))try{
      const production=boundAssetProof(root,asset,origin.productionEvidenceRef,'executionkit-visual-artwork-production/v1','capture',spec);
      if(production.method!==origin.method||production.promptSha256!==origin.promptSha256||production.producerId!==origin.producerId)throw Error('VISUAL_PRODUCTION_RECEIPT_MISMATCH');
    }catch(e){findings.push(failure('VISUAL_PRODUCTION_ORIGIN_UNVERIFIED',e.message,asset.source));}
    if(isObject(origin)&&origin.method==='licensed-web-edited'&&typeof origin.license?.evidenceRef==='string')try{
      const proof=boundAssetProof(root,asset,origin.license.evidenceRef,'executionkit-visual-license/v2','review',spec);
      if(typeof origin.source.author!=='string'||!origin.source.author.trim()||proof.author!==origin.source.author||!isObject(proof.original)||!isObject(proof.rightsSnapshot))throw Error('VISUAL_LICENSE_SOURCE_RECORD_REQUIRED');
      for(const record of [proof.original,proof.rightsSnapshot]){if(!SHA.test(record.sha256??'')||crypto.createHash('sha256').update(checkedProofFile(root,record.path,{json:false,maxBytes:ASSET_MAX})).digest('hex')!==record.sha256)throw Error('VISUAL_LICENSE_SOURCE_RECORD_INVALID');}
      if(proof.editsSha256!==crypto.createHash('sha256').update(JSON.stringify(origin.edits)).digest('hex')||proof.attribution!==origin.attribution)throw Error('VISUAL_LICENSE_TRANSFORM_MISMATCH');
      if(!isObject(proof)||proof.sourceUrl!==origin.source.url||
        proof.licenseType!==origin.license.type||proof.commercialUseAllowed!==true||
        proof.derivativesAllowed!==true)throw Error('VISUAL_LICENSE_PROOF_MISMATCH');
      const search=authenticatedProof(root,origin.searchEvidenceRef);
      if(!isObject(search)||search.sourceUrl!==origin.source.url||
        typeof search.promptMatchExplanation!=='string'||
        search.promptMatchExplanation.length<32)throw Error('VISUAL_SEARCH_PROOF_MISSING');
    }catch(e){findings.push(failure('VISUAL_PRODUCTION_WEB_LICENSE_UNVERIFIED',
      'License/search proof missing or not linked to original source: '+e.message,asset.source));}
    if(typeof asset.themeAware!=='boolean')findings.push(failure('VISUAL_PRODUCTION_THEME_DECLARATION_REQUIRED','Asset must explicitly declare theme awareness; neutral use needs signed review.',asset.source));
    const mustModes=asset.themeAware===true?spec.theme.modes:['neutral'];
    const mustPalettes=asset.themeAware===true?spec.theme.paletteIds:['neutral'];
    const keys=new Set();
    const allowedMimes=['image/webp','image/avif','image/png','image/jpeg','image/svg+xml','application/lottie+json','font/woff2','font/woff','font/ttf','font/otf'];
    for(const variant of asset.variants){
      if(!isObject(variant)) {findings.push(failure('VISUAL_PRODUCTION_VARIANT_INVALID','Invalid variant.',asset.source));continue;}
      const key=String(variant.palette)+'/'+String(variant.mode);
      if(keys.has(key)){findings.push(failure('VISUAL_PRODUCTION_DUPLICATE_VARIANT','Duplicate theme variant.',asset.source));continue;}
      keys.add(key);
      if(!mustPalettes.includes(variant.palette)||!mustModes.includes(variant.mode)||
        !SHA.test(variant.sha256??'')||!Number.isSafeInteger(variant.bytes)||
        variant.bytes<16||variant.bytes>ASSET_MAX||
        !allowedMimes.includes(variant.mime)){
        findings.push(failure('VISUAL_PRODUCTION_VARIANT_INVALID','Variant palette/mode/hash/size/mime invalid.',asset.source));continue;
      }
      referencedFiles.add(variant.path);
      const priorOwner=binaryOwners.get(variant.sha256);
      if(priorOwner&&priorOwner!==asset.id){
        if(asset.sharedFromAssetId!==priorOwner||typeof asset.sharedReuseReason!=='string'||asset.sharedReuseReason.trim().length<24){
          findings.push(failure('VISUAL_PRODUCTION_DUPLICATE_ASSET_BINARY',`Asset ${asset.id} reuses binary SHA256 from ${priorOwner} without explicit sharedFromAssetId and sharedReuseReason.`,asset.source));
        }
      }else if(!priorOwner)binaryOwners.set(variant.sha256,asset.id);
      try{
        const assetPath=safePath(root,variant.path);
        const st=fs.statSync(assetPath);
        if(st.size!==variant.bytes||st.size>ASSET_MAX)throw Error('VISUAL_MEDIA_BYTES_MISMATCH');
        const bytes=checkedProofFile(root,variant.path,{json:false,maxBytes:ASSET_MAX}),mime=formatOf(bytes);
        if(mime!==variant.mime||crypto.createHash('sha256').update(bytes).digest('hex')!==variant.sha256)
          throw Error('VISUAL_MEDIA_PROVENANCE_MISMATCH');
        if(asset.delivery==='server-cached'&&mime!=='image/webp')
          throw Error('VISUAL_SERVER_DELIVERY_WEBP_REQUIRED');
        const image=inspectMediaBytes(bytes,mime);
        if(variant.width!==undefined&&variant.width!==image.width||variant.height!==undefined&&variant.height!==image.height)throw Error('VISUAL_MEDIA_DIMENSIONS_MISMATCH');
        verified++;
      }catch(e){findings.push(failure('VISUAL_PRODUCTION_ARTIFACT_UNVERIFIED',e.message,asset.source));}
    }
    for(const p of mustPalettes)for(const m of mustModes)
      if(!keys.has(p+'/'+m))findings.push(failure('VISUAL_PRODUCTION_THEME_VARIANT_MISSING',
        'Expected '+p+'/'+m+' real image variant absent.',asset.source));
    if(!['local','server-cached'].includes(asset.delivery))
      findings.push(failure('VISUAL_PRODUCTION_DELIVERY_INVALID','Asset delivery must be local or server-cached.',asset.source));
    if(asset.delivery==='server-cached'){
      const webCache=asset.cache?.platform==='web';
      for(const [section,schema] of [['cache','executionkit-media-cache/v1'],['publication','executionkit-media-publication/v1']])try{
        const proof=boundAssetProof(root,asset,asset[section]?.evidenceRef,schema,'audit',spec);
        if(proof.verdict!=='PASS'||proof.reviewerId===origin?.producerId||typeof proof.reviewerId!=='string')throw Error('VISUAL_SERVER_PROOF_UNREVIEWED');
        if(section==='cache'&&(!(webCache?proof.httpCacheVerified===true:proof.offlineRestartTested===true)||!proof.authorizedScope||!proof.persistent||!proof.hashVerified))throw Error('VISUAL_CACHE_PROOF_INCOMPLETE');
        if(section==='publication'&&(!proof.url||!/^https:\/\/[^\s@]+$/.test(proof.url)||proof.httpStatus!==200||proof.mime!=='image/webp'||!Number.isFinite(Date.parse(proof.observedAt))))throw Error('VISUAL_PUBLICATION_PROOF_INCOMPLETE');
      }catch(e){findings.push(failure(section==='cache'?'VISUAL_PRODUCTION_LOCAL_FIRST_UNVERIFIED':'VISUAL_PRODUCTION_SERVER_UNVERIFIED',e.message,asset.source));}
      if(!isObject(asset.cache)||asset.cache.localFirst!==true||
        asset.cache.persistent!==true||asset.cache.hashVerified!==true||
        asset.cache.authorizedScope!==true||!(webCache?asset.cache.httpCacheVerified===true:asset.cache.offlineRestartTested===true)||
        typeof asset.cache.evidenceRef!=='string'||asset.cache.evidenceRef.length<8)
        findings.push(failure('VISUAL_PRODUCTION_LOCAL_FIRST_UNVERIFIED',
          'Server-hosted imagery needs independently tested on-demand persistent local-first or verified HTTP cache.',asset.source));
      if(!isObject(asset.publication)||asset.publication.verified!==true||
        typeof asset.publication.evidenceRef!=='string'||asset.publication.evidenceRef.length<8)
        findings.push(failure('VISUAL_PRODUCTION_SERVER_UNVERIFIED',
          'Remote WebP publish and HTTP evidence are required; metadata alone cannot prove live serving.',asset.source));
    }
  }
  if(Array.isArray(spec.managedAssetDirs)){
    for(const dirRel of spec.managedAssetDirs){
      try{
        const fullDir=safePath(root,dirRel,{file:false});
        if(!fs.existsSync(fullDir)||!fs.statSync(fullDir).isDirectory())continue;
        for(const entry of fs.readdirSync(fullDir,{withFileTypes:true})){
          if(entry.isSymbolicLink())throw Error('VISUAL_MEDIA_SYMLINK');
          if(!entry.isFile()||!/\.(?:svg|png|webp|avif|jpe?g|woff2?|ttf|otf|lottie\.json)$/i.test(entry.name))continue;
          const rel=path.posix.join(dirRel.replace(/\/+$/,''),entry.name);
          if(!referencedFiles.has(rel))findings.push(failure('VISUAL_PRODUCTION_UNUSED_ASSET','Unreferenced media file in managed asset directory: '+rel,rel));
        }
      }catch(e){findings.push(failure('VISUAL_PRODUCTION_UNUSED_ASSET',e.message,String(dirRel)));}
    }
  }
  for(const id of entries.keys())if(!idMap.has(id))
    findings.push(failure('VISUAL_PRODUCTION_REQUIRED_ASSET_MISSING','Referenced visual asset not present in real asset inventory.'));
  return output(findings.length?'FAIL':'PASS',{
    inventory:{requiredSurfaces:expected.size,documentedSurfaces:mapped.size,
      requiredAssetIds:entries.size,verifiedVariants:verified,assets:spec.assets.length,
      paletteCount:spec.theme.paletteIds.length,modeCount:spec.theme.modes.length},
  });
}
