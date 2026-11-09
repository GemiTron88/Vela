import fs from 'node:fs';
import path from 'node:path';
import {resolveProjectPathSafe} from './derived-state.mjs';
import {antiFakeFindings} from './anti-fake-guard.mjs';
import {inspectMarketCopy,uiCopySamples,validateMarketVoice} from './market-language.mjs';
import {detectVisualSurfaces} from './visual-os.mjs';
import {inspectVisualProduction} from './visual-production.mjs';
import {inspectFontBytes,inspectLottieBytes,inspectSafeSVG} from './media-integrity.mjs';
import {isV5} from './v5-config.mjs';
import {sourceVisualAssetPlan} from './asset-strategy.mjs';
import {uxFindings,detectProjectUxContext} from './ux-guard.mjs';
import {flutterFindings,discoverFlutterRoots,parsePubspecAssets,inspectArbCatalog,collectDeclaredFlutterRoutes} from './flutter-guard.mjs';
import {visualsSourceFindings,inspectVisualManifestDeep} from './visuals-guard.mjs';
import {perfFindings,inspectLighthousePerfReports} from './perf-guard.mjs';

const ROOTS=['resources','src','app','pages','public','frontend','web','lib','routes','server','api','mobile','flutter_app','assets'];
const EXT=/\.(?:html?|blade\.php|php|js|mjs|cjs|jsx|ts|tsx|vue|svelte|css|scss|dart|svg|lottie\.json)$/i;
const FLUTTER_EXTRA_EXT=/(?:AndroidManifest\.xml|Info\.plist|Makefile|\.(?:sh|bash|zsh|yml|yaml))$/i;
const TEST_FILE_RE=/\.(?:test|spec)\.[mc]?[jt]sx?$|_test\.dart$|Test\.php$/i;
const SKIP=new Set(['.git','.executionkit','node_modules','vendor','build','dist','storage','cache','tests','test','fixtures','generated']);
const LANG_REF_RE=/(?:\b(?:i18n|\$i18n)\s*\.\s*t|(?<![.\w$])(?:\$t|__|trans|@lang|t))\s*\(\s*['"]([^'"]+)['"]|['"]([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+)['"]\s*\.\s*tr\s*\(\s*\)/g;
const remote=value=>/^(?:https?:)?\/\//i.test(value.trim());
const unique=items=>[...new Set(items)];
function read(root,rel){const file=resolveProjectPathSafe(root,rel,'surface source',{file:true});if(fs.statSync(file).size>1024*1024)throw Error('SURFACE_SOURCE_TOO_LARGE');return fs.readFileSync(file,'utf8');}
function walk(root,rel,out,extension=EXT){
  const full=resolveProjectPathSafe(root,rel,'surface scan');if(!fs.existsSync(full))return;
  for(const entry of fs.readdirSync(full,{withFileTypes:true})){
    if(SKIP.has(entry.name)||entry.isSymbolicLink())continue;
    const child=path.posix.join(rel,entry.name);
    if(entry.isDirectory())walk(root,child,out,extension);
    else if(entry.isFile()&&extension.test(child)){if(out.length>=10000)throw Error('SURFACE_SCAN_LIMIT_EXCEEDED');out.push(child);}
  }
}
function json(root,rel){try{return JSON.parse(read(root,rel));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
function flatStrings(value,prefix='',out=new Map()){
  for(const [key,item] of Object.entries(value??{})){
    if(key.startsWith('@'))continue;
    const name=prefix?prefix+'.'+key:key;
    if(typeof item==='string')out.set(name,item);
    else if(item&&typeof item==='object'&&!Array.isArray(item))flatStrings(item,name,out);
  }
  return out;
}
function stripPhpComments(body){
  let out='',i=0,quote=null;
  while(i<body.length){
    const ch=body[i],next=body[i+1];
    if(quote){
      out+=ch;
      if(ch==='\\'&&i+1<body.length){out+=body[i+1];i+=2;continue;}
      if(ch===quote)quote=null;
      i++;continue;
    }
    if(ch==="'"||ch==='"'){quote=ch;out+=ch;i++;continue;}
    if(ch==='/'&&next==='/'){i+=2;while(i<body.length&&body[i]!=='\n')i++;continue;}
    if(ch==='#'){i++;while(i<body.length&&body[i]!=='\n')i++;continue;}
    if(ch==='/'&&next==='*'){i+=2;while(i<body.length&&!(body[i]==='*'&&body[i+1]==='/'))i++;i+=2;continue;}
    out+=ch;i++;
  }
  return out;
}
// Tokenize literal PHP translation arrays; never evaluate project PHP or guess dynamic catalogs.
function phpStrings(body){
  const stripped=stripPhpComments(body);
  if(!/\breturn\s*\[/.test(stripped))throw Error('LANG_DYNAMIC_PHP_CATALOG_REQUIRES_COMPILED_EXPORT');
  const tokens=stripped.match(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|=>|\[|\]/g)??[];
  const stack=[],out=new Map();let pending=null;
  const unquote=token=>token.slice(1,-1).replace(/\\(['"\\])/g,'$1');
  for(let i=0;i<tokens.length;i++){
    const token=tokens[i];
    if(token==='['){stack.push(pending);pending=null;continue;}
    if(token===']'){stack.pop();pending=null;continue;}
    if(tokens[i+1]==='=>'){
      const key=unquote(token),next=tokens[i+2];
      if(next==='[')pending=key;
      else if(next?.startsWith("'")||next?.startsWith('"'))out.set([...stack.filter(Boolean),key].join('.'),unquote(next));
    }
  }
  if(stack.length)throw Error('LANG_UNBALANCED_PHP_CATALOG');
  return out;
}
export function compileLanguageCatalog(root){
  const files=[];for(const dir of ['lang','resources/lang','locales','src/locales','public/locales','messages','src/messages','i18n','lib/l10n'])walk(root,dir,files,/\.(?:json|php|arb)$/i);
  const locales=new Map(),findings=[];
  for(const rel of files){
    const parts=rel.split('/'),name=parts.at(-1),stem=name.replace(/\.(?:json|php|arb)$/i,'');
    const flatLocale=/\.json$/i.test(name)&&/^[a-z]{2}(?:[-_][A-Z]{2})?$/.test(stem);
    let rawLocale=flatLocale?stem:/\.arb$/i.test(name)?stem.match(/(?:^|_)([a-z]{2}(?:_[A-Z]{2})?)$/)?.[1]:parts.slice(0,-1).reverse().find(p=>/^[a-z]{2}(?:[-_][A-Z]{2})?$/.test(p));
    if(!rawLocale)continue;
    const locale=rawLocale.replace('_','-');
    try{
      const values=/\.php$/i.test(name)?phpStrings(read(root,rel)):flatStrings(JSON.parse(read(root,rel)));
      if(!locales.has(locale))locales.set(locale,new Map());
      for(const [key,text] of values){
        const full=/\.php$/i.test(name)?stem+'.'+key:key;
        locales.get(locale).set(full,text);
        if(/\.json$/i.test(name)&&!flatLocale)locales.get(locale).set(stem+'.'+key,text);
      }
    }catch(error){findings.push({code:'LANG_CATALOG_INVALID',severity:'HIGH',path:rel,message:error.message});}
  }
  return {locales,files,findings};
}
function imageHeaderValid(file,ext){
  if(ext==='svg'){
    try{inspectSafeSVG(fs.readFileSync(file));return true;}catch{return false;}
  }
  const fd=fs.openSync(file,'r');let b;
  try{b=Buffer.alloc(512);b=b.subarray(0,fs.readSync(fd,b,0,b.length,0));}
  finally{fs.closeSync(fd);}
  const magic=b.subarray(0,8).toString('hex');
  if(ext==='png')return magic==='89504e470d0a1a0a';
  if(ext==='jpg'||ext==='jpeg')return magic.startsWith('ffd8ff');
  if(ext==='webp')return b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
  if(ext==='avif')return b.toString('ascii',4,8)==='ftyp'&&/^(?:avif|avis)$/.test(b.toString('ascii',8,12));
  return false;
}
function scanTagEnd(text,startIdx){
  let quote=null;
  for(let i=startIdx;i<text.length;i++){
    const ch=text[i];
    if(quote){
      if(ch==='\\'){i++;continue;}
      if(ch===quote)quote=null;
      continue;
    }
    if(ch==='"'||ch==="'"){quote=ch;continue;}
    if(ch==='>')return i;
  }
  return -1;
}
function assetFindings(root,rel,body){
  const findings=[],add=(code,value)=>findings.push({code,severity:'HIGH',path:rel,value,message:code==='ASSET_REMOTE_FORBIDDEN'?'Application assets and libraries must be served locally':'Referenced local asset is missing or invalid'});
  const isPurePhp=/\.php$/i.test(rel)&&!/\.blade\.php$/i.test(rel);
  const patterns=[
    /(?:\bsrc|\bposter)\s*=\s*["']([^"']+)["']/gi,
    ...(isPurePhp?[]:[/\burl\(\s*["']?([^)'"\s]+)["']?\s*\)/gi]),
    /@import\s+["']([^"']+)["']/gi,
    /\bimport\s*(?:\([^)]*?['"]|[^;\n]*?from\s*['"]|['"])((?:https?:)?\/\/[^'"\s]+)['"]/gi,
    /\b(?:Image\.network|NetworkImage|CachedNetworkImageProvider)\s*\(\s*['"]([^'"]+)['"]/g
  ];
  for(const pattern of patterns)for(const match of body.matchAll(pattern))if(remote(match[1]))add('ASSET_REMOTE_FORBIDDEN',match[1]);
  for(const match of body.matchAll(/\bsrcset\s*=\s*['"]([^'"]+)['"]/gi))for(const candidate of match[1].split(','))if(remote(candidate.trim().split(/\s+/)[0]))add('ASSET_REMOTE_FORBIDDEN',candidate.trim().split(/\s+/)[0]);
  for(const tag of body.matchAll(/<link\b[^>]*>/gi)){
    const linkRel=tag[0].match(/\brel\s*=\s*['"]([^'"]+)['"]/i)?.[1]??'';
    const href=tag[0].match(/\bhref\s*=\s*['"]([^'"]+)['"]/i)?.[1];
    if(href&&/stylesheet|preload|modulepreload|icon/i.test(linkRel)&&remote(href))add('ASSET_REMOTE_FORBIDDEN',href);
  }
  // Generated project imagery has no runtime fallback: only real local files are accepted.
  for(const match of body.matchAll(/<img\b/gi)){
    const end=scanTagEnd(body,match.index+4);
    if(end<0)continue;
    const tag=body.slice(match.index,end+1),src=tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if(!src||!/^(?:\/assets\/generated\/|\/images\/generated\/)[a-zA-Z0-9\/_.-]+\.(?:avif|webp|png|jpe?g|svg)$/i.test(src))continue;
    const file=resolveProjectPathSafe(root,'public'+src,'generated local media',{file:true});
    if(!fs.existsSync(file))add('ASSET_LOCAL_MISSING',src);
    else if(!imageHeaderValid(file,src.split('.').at(-1).toLowerCase()))add('ASSET_IMAGE_INVALID',src);
    if(!/\balt\s*=/i.test(tag)&&!/\brole\s*=\s*["']presentation["']/i.test(tag)&&!/\baria-hidden\s*=\s*["']true["']/i.test(tag))
      findings.push({code:'ASSET_IMAGE_ALT_MISSING',severity:'HIGH',path:rel,value:src,message:'Generated content image requires alt text or an explicit decorative role'});
  }
  for(const match of body.matchAll(/\burl\(\s*["']?([^)'"\s]+\.(?:woff2?|ttf|otf))(?:\?[^)'"\s]*)?["']?\s*\)/gi)){
    const ref=match[1];if(remote(ref)||ref.startsWith('data:'))continue;
    const candidateRel=ref.startsWith('/')?'public'+ref:path.posix.normalize(path.posix.join(path.posix.dirname(rel),ref));
    try{
      const file=resolveProjectPathSafe(root,candidateRel,'local font asset',{file:true});
      if(!fs.existsSync(file))add('ASSET_LOCAL_MISSING',ref);
      else{
        const ext=ref.split('.').at(-1).toLowerCase();
        inspectFontBytes(fs.readFileSync(file),'font/'+ext);
      }
    }catch{add('ASSET_FONT_INVALID',ref);}
  }
  for(const match of body.matchAll(/["']([^"'\s]+\.lottie\.json)["']/gi)){
    const ref=match[1];if(remote(ref))continue;
    const candidateRel=ref.startsWith('/')?'public'+ref:fs.existsSync(path.join(root,ref))?ref:path.posix.normalize(path.posix.join(path.posix.dirname(rel),ref));
    try{
      const file=resolveProjectPathSafe(root,candidateRel,'local lottie asset',{file:true});
      if(!fs.existsSync(file))add('ASSET_LOCAL_MISSING',ref);
      else inspectLottieBytes(fs.readFileSync(file));
    }catch{add('ASSET_LOTTIE_INVALID',ref);}
  }
  for(const match of body.matchAll(/\basset\s*\(\s*['"]([^'"]+)['"]\s*\)/g)){
    const value=match[1];if(remote(value)){add('ASSET_REMOTE_FORBIDDEN',value);continue;}
    if(/[{}$]/.test(value))continue;
    const cleanAsset=value.split(/[?#]/)[0].replace(/^\//,'');
    const file=resolveProjectPathSafe(root,'public/'+cleanAsset,'local asset');
    const storageFallback=cleanAsset.startsWith('storage/')?resolveProjectPathSafe(root,'storage/app/public/'+cleanAsset.slice('storage/'.length),'local storage asset'):null;
    if(!fs.existsSync(file)&&!(storageFallback&&fs.existsSync(storageFallback)))add('ASSET_LOCAL_MISSING',value);
  }
  return findings;
}
function formFindings(rel,body){
  const findings=[];
  const formOpenRe=/<form\b/gi;
  let formMatch;
  while((formMatch=formOpenRe.exec(body))){
    const openEnd=scanTagEnd(body,formMatch.index+5);
    if(openEnd<0)break;
    const attrs=body.slice(formMatch.index+5,openEnd);
    const closeRe=/<\/form\s*>/gi;
    closeRe.lastIndex=openEnd+1;
    const closeMatch=closeRe.exec(body);
    if(!closeMatch)break;
    const content=body.slice(openEnd+1,closeMatch.index);
    formOpenRe.lastIndex=closeMatch.index+closeMatch[0].length;

    const method=attrs.match(/\bmethod\s*=\s*["']?([a-z]+)/i)?.[1]?.toLowerCase()??'get';
    const managedSubmit=/(?:onSubmit|@submit|v-on:submit|x-on:submit|wire:submit)/.test(attrs);
    const add=code=>findings.push({code,severity:'HIGH',path:rel,message:code});
    if(method==='post'&&/\.blade\.php$/i.test(rel)&&!managedSubmit&&!/@csrf|csrf_field\s*\(|name\s*=\s*['"]_token['"]/.test(content))add('FORM_CSRF_MISSING');

    const controlRe=/<(input|select|textarea)\b/gi;
    let ctrlMatch,hasFileInput=false;
    while((ctrlMatch=controlRe.exec(content))){
      const ctrlEnd=scanTagEnd(content,ctrlMatch.index+ctrlMatch[0].length);
      if(ctrlEnd<0)break;
      const tagName=ctrlMatch[1].toLowerCase();
      const ctrlAttrs=content.slice(ctrlMatch.index+ctrlMatch[0].length,ctrlEnd);
      controlRe.lastIndex=ctrlEnd+1;
      if(tagName==='input'&&/\btype\s*=\s*['"]?file\b/i.test(ctrlAttrs))hasFileInput=true;
      if(!managedSubmit){
        if(tagName==='input'&&/\btype\s*=\s*['"]?(?:submit|button|reset)\b/i.test(ctrlAttrs))continue;
        if(!/\b(?:name|wire:model(?:\.[a-z0-9_-]+)*|v-model|x-model)\s*=/i.test(ctrlAttrs))add('FORM_CONTROL_NAME_MISSING');
      }
    }
    if(!managedSubmit&&hasFileInput&&!/\benctype\s*=\s*['"]multipart\/form-data['"]/i.test(attrs))add('FORM_UPLOAD_ENCODING_MISSING');
  }
  return findings;
}
export function guardSurfaceIntegrity(root,{files=null,mode='changed',kind='all',all=false,target=null}={}){
  if(all)mode='all';if(target)kind=target;if(kind==='performance')kind='perf';
  if(!['all','assets','forms','lang','antifake','ux','flutter','visuals','perf'].includes(kind))throw Error('Unknown surface guard');
  root=path.resolve(root);let selected=files;
  if(mode==='all'){selected=[];for(const dir of ROOTS)walk(root,dir,selected);if(['all','flutter'].includes(kind))for(const dir of ['android','ios','scripts','.github'])walk(root,dir,selected,FLUTTER_EXTRA_EXT);}
  if(!Array.isArray(selected))return {schemaVersion:'executionkit-surface-guard/v1',status:'BLOCKED',ok:false,findings:[{code:'SURFACE_CHANGED_FILES_REQUIRED',severity:'HIGH'}],nextCommand:'executionkit guard all . --all'};
  const expanded=[];
  for(const rel of selected){
    if(rel.split('/').some(part=>SKIP.has(part)))continue;
    const full=resolveProjectPathSafe(root,rel,'changed surface path');
    if(fs.existsSync(full)&&fs.statSync(full).isDirectory())walk(root,rel,expanded);else expanded.push(rel);
  }
  const source=[];selected=expanded;
  for(const rel of unique(selected)){
    if(TEST_FILE_RE.test(rel))continue;
    const isFlutterExtra=['all','flutter'].includes(kind)&&FLUTTER_EXTRA_EXT.test(rel);
    if(!isFlutterExtra){
      if(rel.startsWith('lib/')&&!/\.dart$/i.test(rel)&&!['all','antifake','visuals','perf'].includes(kind))continue;
      if(!ROOTS.some(dir=>rel.startsWith(dir+'/'))&&!/\.(?:html?|css|scss|jsx|tsx|vue|svelte|dart|svg|lottie\.json)$/i.test(rel))continue;
      if(!EXT.test(rel)||rel.split('/').some(part=>SKIP.has(part))||/\.min\.(?:js|css)$/.test(rel))continue;
    }else if(rel.split('/').some(part=>SKIP.has(part)))continue;
    const full=resolveProjectPathSafe(root,rel,'surface guard source');if(!fs.existsSync(full)||!fs.statSync(full).isFile())continue;
    if(fs.statSync(full).size>1024*1024)throw Error('SURFACE_SOURCE_TOO_LARGE: '+rel);
    source.push({rel,body:read(root,rel)});
  }
  const config=json(root,'execution.config.json')??{};
  const configChanged=selected.some(rel=>rel==='execution.config.json');
  const flutterRoots= ['all','flutter'].includes(kind)?discoverFlutterRoots(root):[];
  const hasVisualManifest= ['all','visuals','assets'].includes(kind)&&(fs.existsSync(path.join(root,'executionkit.media.json'))||fs.existsSync(path.join(root,'.executionkit/visual/media-production.json')));
  const hasLhciDir= ['all','perf'].includes(kind)&&(fs.existsSync(path.join(root,'.lighthouseci'))||fs.existsSync(path.join(root,'.executionkit/evidence')));
  const applicable=kind==='lang'||(kind==='flutter'&&flutterRoots.length>0)||(kind==='visuals'&&(hasVisualManifest||source.length>0))||(kind==='perf'&&(hasLhciDir||source.length>0))||configChanged||selected.some(rel=>/(?:^|\/)(?:lang|locales|messages|i18n|l10n)\//.test(rel))||source.some(({rel,body})=>/\.(?:blade\.php|html?|jsx|tsx|vue|svelte|css|scss|dart|svg|lottie\.json)$/i.test(rel)||FLUTTER_EXTRA_EXT.test(rel)||/<(?:form|img|button|input|script|link)\b|document\.|Image\.network|\b(?:__|trans)\s*\(/.test(body));
  const fullMedia=mode==='all'&&['all','assets','visuals'].includes(kind)&&isV5(config);
  if(!applicable&&!fullMedia&&!(['all','antifake','perf'].includes(kind)&&source.length))return {schemaVersion:'executionkit-surface-guard/v1',status:'NOT_APPLICABLE',ok:true,findings:[],scannedFiles:source.map(f=>f.rel)};
  const languageRequested=['all','lang'].includes(kind);
  const languageChanged=selected.some(rel=>/(?:^|\/)(?:lang|locales|messages|i18n|l10n)\//.test(rel));
  const languageRefs=source.some(({body})=>{LANG_REF_RE.lastIndex=0;return LANG_REF_RE.test(body);});
  const projectSurface=config?.surfaceIntegrity??{};
  const profile=projectSurface.marketVoice??null;
  const declaredLocales=(projectSurface.locales??[]).map(l=>typeof l==='string'?l.replace('_','-'):l);
  if(!Array.isArray(declaredLocales)||declaredLocales.some(locale=>typeof locale!=='string'))throw Error('LANG_REQUIRED_LOCALES_INVALID');
  // Edited UI copy is checked directly. Do not rescan every language catalog on each source edit.
  const checkLanguage=languageRequested&&(kind==='lang'||mode==='all'||configChanged||languageChanged||languageRefs);
  const checkEditedMarketCopy=languageRequested&&Boolean(profile)&&source.length>0;
  const profileErrors=languageRequested?validateMarketVoice(profile):[];
  const findings=[],language=checkLanguage?compileLanguageCatalog(root):{locales:new Map(),findings:[]};
  // Fast fail even on one edited UI file: a declared Saudi target needs a declared market voice.
  if(languageRequested&&declaredLocales.includes('ar-SA')&&(!profile||profile.locale!=='ar-SA'))findings.push({code:'LANG_MARKET_PROFILE_REQUIRED',severity:'HIGH',locale:'ar-SA',message:'Explicit ar-SA market voice is required before Saudi Arabic content can pass'});
  if(checkLanguage){
    findings.push(...profileErrors,...language.findings);
    if(profile&&!validateMarketVoice(profile).length)for(const [locale,values] of language.locales)for(const [key,value] of values){if(findings.length>=200)break;findings.push(...inspectMarketCopy(value,profile,{locale,key}));}
    for(const locale of declaredLocales)if(!language.locales.has(locale))findings.push({code:'LANG_REQUIRED_LOCALE_MISSING',severity:'HIGH',locale});
    const keys=unique([...language.locales.values()].flatMap(values=>[...values.keys()]));
    for(const [locale,values] of language.locales)for(const key of keys)if(!values.get(key)?.trim())findings.push({code:'LANG_TRANSLATION_MISSING',severity:'HIGH',locale,key});
  }
  const uxContext=['all','ux'].includes(kind)?{...detectProjectUxContext(root),strictUx:['all','ux'].includes(kind)}:null;
  const primaryFlutter=flutterRoots[0]??null;
  const declaredFlutterRoutes=['all','flutter'].includes(kind)&&flutterRoots.length?collectDeclaredFlutterRoutes(root):null;
  const flutterContextsByRel=new Map(flutterRoots.map(fr=>[fr.rel,{root,flutterRoot:fr.dir,declaredAssets:parsePubspecAssets(fr.pubspecContent),declaredRoutes:declaredFlutterRoutes}]));
  const defaultFlutterContext=['all','flutter'].includes(kind)?{
    root,
    flutterRoot:primaryFlutter?primaryFlutter.dir:root,
    declaredAssets:primaryFlutter?parsePubspecAssets(primaryFlutter.pubspecContent):null,
    declaredRoutes:declaredFlutterRoutes
  }:null;

  for(const {rel,body} of source){
    if(['all','antifake'].includes(kind)&&!FLUTTER_EXTRA_EXT.test(rel))findings.push(...antiFakeFindings(rel,body));
    if(['all','assets'].includes(kind)&&!FLUTTER_EXTRA_EXT.test(rel))findings.push(...assetFindings(root,rel,body));
    if(['all','forms'].includes(kind)&&!FLUTTER_EXTRA_EXT.test(rel))findings.push(...formFindings(rel,body));
    if(['all','ux'].includes(kind)&&!FLUTTER_EXTRA_EXT.test(rel))findings.push(...uxFindings(rel,body,uxContext));
    if(['all','flutter'].includes(kind)){
      const matchedFlutter=[...flutterContextsByRel.entries()].filter(([prefix])=>prefix&&rel.startsWith(prefix+'/')).sort((a,b)=>b[0].length-a[0].length)[0]?.[1]??defaultFlutterContext;
      findings.push(...flutterFindings(rel,body,matchedFlutter));
    }
    if(['all','visuals'].includes(kind))findings.push(...visualsSourceFindings(rel,body));
    if(['all','perf'].includes(kind))findings.push(...perfFindings(rel,body));
    if(checkEditedMarketCopy&&!profileErrors.length&&findings.length<200)for(const text of uiCopySamples(rel,body)){if(findings.length>=200)break;findings.push(...inspectMarketCopy(text,profile,{path:rel}));}
    if(checkLanguage){
      LANG_REF_RE.lastIndex=0;
      const refs=[...body.matchAll(LANG_REF_RE)].map(m=>m[1]??m[2]).filter(Boolean);
      for(const key of unique(refs)){
        if(!language.locales.size)findings.push({code:'LANG_CATALOG_MISSING',severity:'HIGH',path:rel,key});
        for(const [locale,values] of language.locales)if(!values.has(key)||!values.get(key)?.trim())findings.push({code:'LANG_TRANSLATION_MISSING',severity:'HIGH',path:rel,key,locale});
      }
    }
  }
  if(['all','flutter'].includes(kind)&&(mode==='all'||kind==='flutter'||languageChanged)){
    for(const fr of flutterRoots)findings.push(...inspectArbCatalog(fr.dir,root));
  }
  if(['all','visuals'].includes(kind)&&(hasVisualManifest||kind==='visuals')){
    findings.push(...inspectVisualManifestDeep(root,{changedFiles:mode==='changed'?selected:null,strictFixture:kind==='visuals'}));
  }
  const lighthousePerf=['all','perf'].includes(kind)?inspectLighthousePerfReports(root,{requireReports:false}):null;
  if(lighthousePerf?.findings?.length)findings.push(...lighthousePerf.findings);
  if(fullMedia){
    const discovery=detectVisualSurfaces(root,10000,config?.visual?.surfaceScope);
    if(!discovery.scan.complete)findings.push({code:'VISUAL_SURFACE_CENSUS_INCOMPLETE',severity:'HIGH'});
    else if(discovery.uiBearing){
      const media=inspectVisualProduction(root,{boundary:'release',surfaces:discovery.surfaces});
      findings.push(...media.findings);
    }
  }
  if(!checkLanguage&&profileErrors.length)findings.push(...profileErrors);
  const reviewFindings=[];
  if(checkLanguage&&mode==='all'&&!profile&&[...language.locales.keys()].some(locale=>locale.startsWith('ar')))reviewFindings.push({code:'LANG_MARKET_PROFILE_REVIEW',severity:'REVIEW',message:'Declare the business market and approved Arabic register; never infer dialect from the agent writing style'});
  if(mode==='all'){
    const pkg=json(root,'package.json');
    if(pkg){
      const usage=source.map(file=>file.body).join('\n')+'\n'+Object.values(pkg.scripts??{}).join('\n');
      for(const name of Object.keys(pkg.dependencies??{}))if(!usage.includes(name))reviewFindings.push({code:'LIBRARY_USAGE_UNPROVEN',severity:'REVIEW',library:name,message:'Check framework/config/indirect usage before removing; do not delete from this heuristic alone'});
    }
  }
  const assetPlan=mode==='all'&&['all','assets','visuals'].includes(kind)?sourceVisualAssetPlan(source):null;
  if(assetPlan)for(const page of assetPlan.pages)if(page.coverage==='MEDIA_NOT_EVIDENT')reviewFindings.push({code:'ASSET_RICHNESS_REVIEW',severity:'REVIEW',path:page.path,message:'Evaluate purposeful Gemini-generated local imagery; source absence alone does not prove poor rendered design'});
  return {schemaVersion:'executionkit-surface-guard/v1',status:findings.length?'FAIL':'PASS',ok:findings.length===0,scope:'SOURCE_ONLY',kind,findings,reviewFindings,assetPlan,...(lighthousePerf&&lighthousePerf.status!=='NOT_APPLICABLE'?{lighthouse:{status:lighthousePerf.status,reportCount:lighthousePerf.reportCount,minScore:lighthousePerf.minScore,budget:100}}:{}),scannedFiles:source.map(f=>f.rel),locales:[...language.locales.keys()],runtimeEvidenceRequired:['form-success-and-validation','no-unexpected-5xx','local-loaded-assets','translated-rendered-ui','real-business-data-and-failure-states','mobile-responsive','candidate-bound-lighthouse'],nextCommand:findings.length?'resolve-surface-integrity-findings':null};
}
