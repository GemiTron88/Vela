import fs from 'node:fs';
import path from 'node:path';
import { discoverProduct } from './discovery-model.mjs';
import { evaluateSeoApplicability, inferSeoApplicabilityFromRepository, loadSeoContract } from './seo-model.mjs';
import { loadConfig, walkFiles } from './execution-model.mjs';
import { resolveDerivedPath } from './derived-state.mjs';

const DEFAULT_WEB_EXTENSIONS = ['blade.php','html','htm','php','tsx','jsx','vue','astro','svelte','js','ts','mdx','njk','pug','erb','twig'];
function buildWebExtRegex(extensions) {
  const escaped = extensions.map(e => String(e).replace(/^\.+/, '').replace(/\./g, '\\.'));
  return new RegExp('\\.(?:' + escaped.join('|') + ')$', 'i');
}
const WEB_EXT = buildWebExtRegex(DEFAULT_WEB_EXTENSIONS);
const IGNORE=/(?:^|\/)(?:node_modules|vendor|storage|bootstrap\/cache|build|dist|coverage|\.git|\.executionkit|tests?|__tests__|fixtures?|docs|examples)(?:\/|$)/;
function norm(p){return String(p).split(path.sep).join('/');}
function corpus(root, regex = WEB_EXT){
  const files=walkFiles(root,(full)=>{const rel=norm(path.relative(root,full));return !IGNORE.test(rel)&&!/(?:\.test|\.spec)\.[^/]+$/i.test(rel)&&regex.test(rel);});
  const parts=[],missingAltPaths=[],unreadablePaths=[];
  for(const full of files.slice(0,5000)){
    try{
      if(fs.statSync(full).size>1024*1024){unreadablePaths.push(norm(path.relative(root,full)));continue;}
      const source=fs.readFileSync(full,'utf8').replace(/<!--[\s\S]*?-->/g,'');
      parts.push(source);
      const images=[];
      for(const m of source.matchAll(/<img\b/gi)){
        let quote=null,end=-1;
        for(let i=m.index+4;i<source.length;i++){
          const ch=source[i];
          if(quote){if(ch==='\\'){i++;continue;}if(ch===quote)quote=null;continue;}
          if(ch==='"'||ch==="'"){quote=ch;continue;}
          if(ch==='>'){end=i;break;}
        }
        if(end>=0)images.push(source.slice(m.index,end+1));
      }
      if(images.some((tag)=>{
        const stripped=tag.replace(/"[^"]*"|'[^']*'|\{[^}]*\}/g,'""');
        const hasAlt=/(?:\s)alt\s*=/i.test(stripped);
        const isDecorative=/\brole\s*=\s*["'](?:presentation|none)["']/i.test(tag)||/\baria-hidden\s*=\s*["']true["']/i.test(tag);
        return !hasAlt&&!isDecorative;
      }))missingAltPaths.push(norm(path.relative(root,full)));
    }catch{unreadablePaths.push(norm(path.relative(root,full)));}
  }
  return {body:parts.join('\n'),missingAltPaths,unreadablePaths,complete:files.length<=5000&&!unreadablePaths.length};
}
function existsAny(root,paths){return paths.some((rel)=>fs.existsSync(path.join(root,rel)));}
function routeNames(root){return (discoverProduct(root).items??[]).filter((x)=>x.kind==='route').map((x)=>String(x.name??'').toLowerCase());}
function add(findings,code,severity,message,extra={}){findings.push({code,severity,message,...extra});}
function evidenceFile(root,boundary){return resolveDerivedPath(root,'.executionkit/evidence/raw/seo-implementation-'+boundary+'.json','SEO implementation evidence',{createParents:true});}

export function inspectSeoImplementation(root,{boundary='task',writeEvidence=false}={}){
  root=path.resolve(root);const {config}=loadConfig(root),capability=config.capabilities?.seo??'NONE';
  const currentWebExtRegex = config.seo?.webExtensions ? buildWebExtRegex(config.seo.webExtensions) : WEB_EXT;
  const inferred=inferSeoApplicabilityFromRepository(root);
  const loaded=loadSeoContract(root,config,{required:capability!=='NONE'&&inferred.applicable});
  if(loaded.status==='NOT_CONFIGURED'&&!inferred.applicable)return {schemaVersion:'executionkit-v4-seo-implementation/v1',status:'NOT_APPLICABLE',boundary,capability,inferredApplicability:inferred,findings:[],checks:{},evidencePath:null};
  if(loaded.status==='FAIL')return {schemaVersion:'executionkit-v4-seo-implementation/v1',status:'FAIL',boundary,capability,findings:loaded.errors.map((x)=>({code:x.code,severity:'HIGH',message:x.message})),checks:{contract:false},evidencePath:null};
  const applicability=evaluateSeoApplicability(loaded.contract);
  if(inferred.applicable&&loaded.contract?.applicability==='AUTO'&&!applicability.applicable)return {schemaVersion:'executionkit-v4-seo-implementation/v1',status:'FAIL',boundary,capability,inferredApplicability:inferred,findings:[{code:'SEO_PUBLIC_WEB_APPLICABILITY_UNRESOLVED',severity:'HIGH',message:'Public-web-capable repository detected but SEO applicability/surfaces are unresolved'}],checks:{contract:true,applicable:false},evidencePath:null};
  if(!applicability.applicable)return {schemaVersion:'executionkit-v4-seo-implementation/v1',status:'NOT_APPLICABLE',boundary,capability,inferredApplicability:inferred,findings:[],checks:{contract:true,applicable:false},evidencePath:null};
  const source=corpus(root, currentWebExtRegex),body=source.body,routes=routeNames(root),release=['phase','release','production'].includes(boundary),findings=[];
  if(!source.complete)add(findings,'SEO_IMPLEMENTATION_SCAN_INCOMPLETE','HIGH','Source scan was truncated or unreadable; implementation cannot be accepted.');
  const checks={
    contract:true,applicable:true,
    title:/<title\b|@section\s*\(\s*['\"]title|(?:seo|head|metadata)\b[\s\S]{0,60}\btitle\s*[:=]/i.test(body),
    description:/<meta[^>]+name\s*=\s*['\"]description['\"]|(?:seo|metadata)\b[\s\S]{0,60}\bdescription\s*[:=]/i.test(body),
    canonical:/rel\s*=\s*['\"]canonical['\"]|(?:seo|head|metadata)\b[\s\S]{0,60}\bcanonical\s*[:=]/i.test(body),
    robots:existsAny(root,['public/robots.txt','static/robots.txt','robots.txt'])||routes.some((x)=>x.includes('robots')),
    sitemap:existsAny(root,['public/sitemap.xml','static/sitemap.xml','sitemap.xml'])||routes.some((x)=>x.includes('sitemap')),
    structuredData:/application\/ld\+json|https?:\/\/schema\.org|\b(?:structuredData|jsonLd)\b/i.test(body),
    h1:/<h1[\s>]|@section\s*\(\s*['"]h1|heading.*level.*1/i.test(body),
    viewport:/<meta[^>]+name\s*=\s*['"]viewport['"][^>]*>/i.test(body)||/\bviewport\s*[:=]/i.test(body),
    ogMeta:/property\s*=\s*['"]og:|name\s*=\s*['"]twitter:/i.test(body)||/openGraph|ogImage|twitterCard/i.test(body),
    imgAlt:source.missingAltPaths.length===0,
  };
  for(const [key,label] of [['title','page title implementation'],['description','meta description implementation'],['canonical','canonical implementation']])if(!checks[key])add(findings,'SEO_IMPLEMENTATION_'+key.toUpperCase()+'_MISSING',release?'HIGH':'REVIEW','No '+label+' was detected in project source');
  if(!checks.robots)add(findings,'SEO_ROBOTS_IMPLEMENTATION_MISSING',release?'HIGH':'REVIEW','No robots.txt file or robots route was detected');
  if(!checks.sitemap)add(findings,'SEO_SITEMAP_IMPLEMENTATION_MISSING',release?'HIGH':'REVIEW','No sitemap file or sitemap route was detected');
  if(!checks.h1)add(findings,'SEO_H1_HEADING_MISSING',release?'HIGH':'REVIEW','No H1 heading element was detected in project source');
  if(!checks.viewport)add(findings,'SEO_VIEWPORT_META_MISSING',release?'HIGH':'REVIEW','No viewport meta tag was detected in project source');
  if(!checks.ogMeta)add(findings,'SEO_SOCIAL_META_MISSING',release?'HIGH':'REVIEW','No Open Graph or Twitter Card meta tags were detected');
  if(!checks.imgAlt)add(findings,'SEO_IMAGE_ALT_MISSING',release?'HIGH':'REVIEW','Image tags without alt attributes were detected',{paths:source.missingAltPaths.slice(0,25)});
  const structuredRequired=Object.keys(loaded.contract?.structuredDataRegistry??{}).length>0;
  if(structuredRequired&&!checks.structuredData)add(findings,'SEO_STRUCTURED_DATA_IMPLEMENTATION_MISSING',release?'HIGH':'REVIEW','SEO contract declares structured data but no implementation marker was detected');
  const status=findings.some((x)=>x.severity==='HIGH')?'FAIL':findings.length?'REVIEW_REQUIRED':'PASS';
  const gates={
    S0:checks.contract?'PASS':'FAIL',
    S1:boundary==='wave'||release?(checks.title&&checks.description&&checks.canonical&&checks.imgAlt?'PASS':status):'DEFERRED',
    S2:release?(status==='PASS'?'PASS':status):'DEFERRED',
    S3:boundary==='release'||boundary==='production'?status:'DEFERRED',
    S4:boundary==='production'?status:'DEFERRED',
    S5:loaded.contract?.monitoring?.enabled?status:'NOT_APPLICABLE'
  };
  const result={schemaVersion:'executionkit-v4-seo-implementation/v1',status,boundary,capability,inferredApplicability:inferred,contractPath:loaded.path,contractHash:loaded.contractHash,applicability,checks,gates,findings,observedAt:new Date().toISOString(),limitations:['Static implementation inspection complements but does not replace rendered production verification.'],evidencePath:null};
  if(writeEvidence){const file=evidenceFile(root,boundary);fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n');result.evidencePath=path.relative(root,file).split(path.sep).join('/');}
  return result;
}
