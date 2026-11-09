import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {decodeVisualPNG,VISUAL_MAX_PIXELS} from './visual-image.mjs';

const MAX_BYTES=12*1024*1024;
const MAX_CACHE_ENTRIES=512;
export const MEDIA_DECODE_CACHE_REL='.executionkit/visual/media-decode-cache.json';
const decoded=new Map();
const pythonProbeByPath=new Map();
let cacheDirty=false;
const tags=new Set('svg g defs use path rect circle ellipse line polyline polygon linearGradient radialGradient stop clipPath mask title desc text tspan textPath symbol pattern marker filter feGaussianBlur feOffset feBlend feColorMatrix feComposite feMerge feMergeNode feFlood feDropShadow feSpecularLighting fePointLight feMorphology feTurbulence feDisplacementMap'.split(' '));
const SAFE_XML_ENTITY=/&(?:amp|lt|gt|quot|apos);/g;

// A conservative static SVG subset, with complete token/attribute consumption.
// Reject namespaces on elements and active/remote constructs rather than trying
// to sanitize unknown markup. Raster wrappers are never original vector art.
export function inspectSafeSVG(bytes){
  const rawXml=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  const xml=rawXml.replace(SAFE_XML_ENTITY,'_');
  if(/&|[\u0000-\u0008\u000b\u000c\u000e-\u001f]|<!DOCTYPE|<!ENTITY|<\?|\bon[a-z]+\s*=|@import|url\(\s*(?!#)/i.test(xml))throw Error('VISUAL_MEDIA_UNSAFE_SVG');
  for(const comment of xml.matchAll(/<!--([\s\S]*?)-->/g))if(comment[1].includes('--')||comment[1].endsWith('-'))throw Error('VISUAL_MEDIA_UNSAFE_SVG');
  const body=xml.replace(/<!--[\s\S]*?-->/g,'');
  const stack=[];let root=false,closed=false,dimensions=null;
  const tokens=body.match(/<[^>]*>|[^<]+/g)??[];
  if(tokens.join('')!==body)throw Error('VISUAL_MEDIA_UNSAFE_SVG');
  for(const token of tokens){
    if(!token.startsWith('<')){
      if(token.trim()&&!['title','desc','text','tspan','textPath'].includes(stack.at(-1)))throw Error('VISUAL_MEDIA_UNSAFE_SVG');
      continue;
    }
    const closing=/^<\/([A-Za-z][A-Za-z0-9]*)\s*>$/.exec(token);
    if(closing){if(stack.pop()!==closing[1])throw Error('VISUAL_MEDIA_UNSAFE_SVG');if(!stack.length)closed=true;continue;}
    const opening=/^<([A-Za-z][A-Za-z0-9]*)([\s\S]*?)(\/?)>$/.exec(token);
    if(!opening||!tags.has(opening[1])||closed)throw Error('VISUAL_MEDIA_UNSAFE_SVG');
    const [,name,attrs,selfClose]=opening;
    if(!root){if(name!=='svg')throw Error('VISUAL_MEDIA_UNSAFE_SVG');root=true;}
    else if(!stack.length||name==='svg')throw Error('VISUAL_MEDIA_UNSAFE_SVG');
    let rest=attrs;const seen=new Set(),values={};
    while(rest.trim()){
      const a=/^\s+([A-Za-z][A-Za-z0-9-]*)\s*=\s*(?:"([^"<>]*)"|'([^'<>]*)')/.exec(rest);
      if(!a||seen.has(a[1])||/^(?:on|style|src)/i.test(a[1]))throw Error('VISUAL_MEDIA_UNSAFE_SVG');
      const val=a[2]??a[3];
      if(/^href$/i.test(a[1])&&(name!=='use'||!/^#[A-Za-z_][\w.-]*$/.test(val)))throw Error('VISUAL_MEDIA_UNSAFE_SVG');
      if(/&|\\|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(val)||/url\(\s*(?!#[A-Za-z_][\w.-]*\s*\))/i.test(val))throw Error('VISUAL_MEDIA_UNSAFE_SVG');
      if(a[1]==='xmlns'&&(name!=='svg'||val!=='http://www.w3.org/2000/svg'))throw Error('VISUAL_MEDIA_UNSAFE_SVG');
      seen.add(a[1]);values[a[1]]=val;rest=rest.slice(a[0].length);
    }
    if(name==='svg'){
      const view=values.viewBox?.trim().split(/[\s,]+/).map(Number);
      if(view&&(view.length!==4||!view.every(Number.isFinite)))throw Error('VISUAL_MEDIA_DIMENSIONS_INVALID');
      const intrinsic=[];
      for(const key of ['width','height'])if(values[key]!==undefined){
        if(!/^(?:\d+(?:\.\d+)?|\.\d+)(?:px|%)?$/.test(values[key]))throw Error('VISUAL_MEDIA_DIMENSIONS_INVALID');
        const n=parseFloat(values[key]);
        if(n<=0||n>(values[key].endsWith('%')?100:32768))throw Error('VISUAL_MEDIA_DIMENSIONS_INVALID');
        intrinsic.push(values[key].endsWith('%')?null:n);
      }
      const parsePx=v=>typeof v==='string'&&/^(?:\d+(?:\.\d+)?|\.\d+)(?:px)?$/.test(v)?parseFloat(v):NaN;
      const width=view?.length===4?view[2]:parsePx(values.width),height=view?.length===4?view[3]:parsePx(values.height);
      if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width*height>VISUAL_MAX_PIXELS)throw Error('VISUAL_MEDIA_DIMENSIONS_INVALID');
      if(intrinsic.length===2&&intrinsic.every(x=>x!==null)&&intrinsic[0]*intrinsic[1]>VISUAL_MAX_PIXELS)throw Error('VISUAL_MEDIA_DIMENSIONS_INVALID');
      dimensions={width,height,alpha:true,mime:'image/svg+xml'};
    }
    if(!selfClose)stack.push(name);else if(name==='svg')closed=true;
  }
  if(!root||stack.length||!closed)throw Error('VISUAL_MEDIA_UNSAFE_SVG');
  return dimensions;
}

export function inspectFontBytes(bytes,mime='font/woff2'){
  if(!Buffer.isBuffer(bytes)||bytes.length<16||bytes.length>MAX_BYTES)throw Error('VISUAL_MEDIA_CORRUPT_FONT');
  const tag=bytes.toString('ascii',0,4),magic=bytes.readUInt32BE(0);
  if(mime==='font/woff'||tag==='wOFF'){
    if(tag!=='wOFF'||bytes.length<44)throw Error('VISUAL_MEDIA_CORRUPT_FONT');
    const flavor=bytes.readUInt32BE(4),total=bytes.readUInt32BE(8),tables=bytes.readUInt16BE(12);
    if(![0x00010000,0x4f54544f,0x74727565].includes(flavor)||total!==bytes.length||tables<1||tables>128||bytes.length<44+tables*20)throw Error('VISUAL_MEDIA_CORRUPT_FONT');
    return {format:'woff',numTables:tables,bytes:bytes.length,mime:'font/woff'};
  }
  if(mime==='font/woff2'||tag==='wOF2'){
    if(tag!=='wOF2'||bytes.length<48)throw Error('VISUAL_MEDIA_CORRUPT_FONT');
    const flavor=bytes.readUInt32BE(4),total=bytes.readUInt32BE(8),tables=bytes.readUInt16BE(12);
    if(![0x00010000,0x4f54544f,0x74727565,0x74746366].includes(flavor)||(total!==0&&total!==bytes.length)||tables<1||tables>128)throw Error('VISUAL_MEDIA_CORRUPT_FONT');
    return {format:'woff2',numTables:tables,bytes:bytes.length,mime:'font/woff2'};
  }
  if(mime==='font/otf'||tag==='OTTO'){
    const tables=bytes.readUInt16BE(4);
    if(tag!=='OTTO'||tables<1||tables>128||bytes.length<12+tables*16)throw Error('VISUAL_MEDIA_CORRUPT_FONT');
    return {format:'otf',numTables:tables,bytes:bytes.length,mime:'font/otf'};
  }
  if(mime==='font/ttf'||magic===0x00010000||tag==='true'){
    const tables=bytes.readUInt16BE(4);
    if(!(magic===0x00010000||tag==='true')||tables<1||tables>128||bytes.length<12+tables*16)throw Error('VISUAL_MEDIA_CORRUPT_FONT');
    return {format:'ttf',numTables:tables,bytes:bytes.length,mime:'font/ttf'};
  }
  throw Error('VISUAL_MEDIA_CORRUPT_FONT');
}

export function inspectLottieBytes(bytes){
  if(!Buffer.isBuffer(bytes)||bytes.length<16||bytes.length>MAX_BYTES)throw Error('VISUAL_MEDIA_INVALID_LOTTIE');
  let raw,data;
  try{raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);data=JSON.parse(raw);}catch{throw Error('VISUAL_MEDIA_INVALID_LOTTIE');}
  if(/<script\b|javascript:|data:text\/html|\beval\s*\(|\bFunction\s*\(/i.test(raw))throw Error('VISUAL_MEDIA_UNSAFE_LOTTIE');
  if(!data||typeof data!=='object'||Array.isArray(data)||typeof data.v!=='string'||!/^\d+\.\d+\.\d+$/.test(data.v)||
    !Number.isFinite(data.fr)||data.fr<=0||data.fr>240||!Number.isFinite(data.ip)||!Number.isFinite(data.op)||data.op<=data.ip||
    (data.op-data.ip)/data.fr>60||
    !Number.isSafeInteger(data.w)||!Number.isSafeInteger(data.h)||data.w<=0||data.h<=0||data.w*data.h>VISUAL_MAX_PIXELS||
    !Array.isArray(data.layers)||data.layers.length===0)throw Error('VISUAL_MEDIA_INVALID_LOTTIE');
  for(const item of Array.isArray(data.assets)?data.assets:[]){
    const pStr=String(item?.p??'');
    const ref=String(item?.u??'')+pStr;
    if(/^(?:https?:)?\/\//i.test(ref)||/^data:(?!image\/(?:png|webp);base64,)/i.test(pStr)||pStr.length>65536||ref.includes('..'))throw Error('VISUAL_MEDIA_UNSAFE_LOTTIE');
  }
  return {width:data.w,height:data.h,frameRate:data.fr,durationSeconds:(data.op-data.ip)/data.fr,version:data.v,layers:data.layers.length,alpha:true,mime:'application/lottie+json'};
}

function ensurePythonDecoderAvailable(){
  const pathKey=String(process.env.PATH??process.env.Path??'');
  if(pythonProbeByPath.get(pathKey)===true)return;
  const probe=spawnSync(process.platform==='win32'?'python':'python3',['-c','from PIL import Image; print("OK")'],{
    encoding:'utf8',timeout:5000,maxBuffer:4096,windowsHide:true,shell:false
  });
  if(probe.error?.code==='ENOENT'||probe.status!==0||!String(probe.stdout??'').includes('OK')){
    throw Error('VISUAL_MEDIA_DECODER_UNAVAILABLE');
  }
  if(pythonProbeByPath.size>=32)pythonProbeByPath.delete(pythonProbeByPath.keys().next().value);
  pythonProbeByPath.set(pathKey,true);
}

export function clearMediaDecodeCache(){
  decoded.clear();
  pythonProbeByPath.clear();
  cacheDirty=false;
}

export function loadMediaDecodeCache(root){
  try{
    const resolved=path.resolve(root);
    if(!fs.existsSync(resolved)||fs.lstatSync(resolved).isSymbolicLink())return {loaded:0};
    let cursor=resolved;
    for(const part of ['.executionkit','visual','media-decode-cache.json']){
      cursor=path.join(cursor,part);
      if(!fs.existsSync(cursor)||fs.lstatSync(cursor).isSymbolicLink())return {loaded:0};
    }
    const stat=fs.statSync(cursor);
    if(!stat.isFile()||stat.size>512*1024)return {loaded:0};
    const parsed=JSON.parse(fs.readFileSync(cursor,'utf8'));
    if(parsed?.schemaVersion!=='executionkit-media-decode-cache/v1'||!parsed.entries||typeof parsed.entries!=='object')return {loaded:0};
    let loaded=0;
    for(const [k,v] of Object.entries(parsed.entries)){
      if(!/^[a-z0-9.+-]+\/[a-z0-9.+-]+:(?:\d+:)?[a-f0-9]{64}$/i.test(k)||!v||typeof v!=='object')continue;
      if(decoded.size>=MAX_CACHE_ENTRIES)decoded.delete(decoded.keys().next().value);
      decoded.set(k,Object.freeze({...v}));
      loaded++;
    }
    return {loaded,path:MEDIA_DECODE_CACHE_REL};
  }catch{
    return {loaded:0};
  }
}

export function saveMediaDecodeCache(root,{force=false}={}){
  if(!cacheDirty&&!force)return {saved:0,skipped:true};
  try{
    const resolved=path.resolve(root);
    if(!fs.existsSync(resolved)||fs.lstatSync(resolved).isSymbolicLink())return {saved:0};
    const ekDir=path.join(resolved,'.executionkit');
    if(!force&&!fs.existsSync(ekDir))return {saved:0,skipped:true};
    if(fs.existsSync(ekDir)&&fs.lstatSync(ekDir).isSymbolicLink())return {saved:0};
    fs.mkdirSync(ekDir,{recursive:true});
    const visualDir=path.join(ekDir,'visual');
    if(fs.existsSync(visualDir)&&fs.lstatSync(visualDir).isSymbolicLink())return {saved:0};
    fs.mkdirSync(visualDir,{recursive:true});
    const cacheFile=path.join(visualDir,'media-decode-cache.json');
    if(fs.existsSync(cacheFile)&&fs.lstatSync(cacheFile).isSymbolicLink())return {saved:0};
    const entries=Object.fromEntries([...decoded.entries()].slice(-MAX_CACHE_ENTRIES));
    const tmp=cacheFile+'.'+process.pid+'.tmp';
    fs.writeFileSync(tmp,JSON.stringify({
      schemaVersion:'executionkit-media-decode-cache/v1',
      updatedAt:new Date().toISOString(),
      entries
    },null,2)+'\n');
    fs.renameSync(tmp,cacheFile);
    cacheDirty=false;
    return {saved:Object.keys(entries).length,path:MEDIA_DECODE_CACHE_REL};
  }catch{
    return {saved:0};
  }
}

export function inspectMediaBytes(bytes,mime){
  if(!Buffer.isBuffer(bytes)||bytes.length<16||bytes.length>MAX_BYTES)throw Error('VISUAL_MEDIA_BYTES_INVALID');
  const digest=crypto.createHash('sha256').update(bytes).digest('hex');
  const key=mime+':'+bytes.length+':'+digest;
  const legacyKey=mime+':'+digest;
  const cached=decoded.get(key)??decoded.get(legacyKey);
  if(cached){
    if(['image/jpeg','image/webp','image/avif'].includes(mime))ensurePythonDecoderAvailable();
    return {...cached};
  }
  let result;
  if(mime==='image/svg+xml')result=inspectSafeSVG(bytes);
  else if(mime==='application/lottie+json')result=inspectLottieBytes(bytes);
  else if(['font/woff2','font/woff','font/ttf','font/otf'].includes(mime))result=inspectFontBytes(bytes,mime);
  else if(mime==='image/png'){
    const image=decodeVisualPNG(bytes);
    result={width:image.width,height:image.height,alpha:[4,6].includes(bytes[25]),mime};
  }else if(['image/jpeg','image/webp','image/avif'].includes(mime)){
    const execution=spawnSync(process.platform==='win32'?'python':'python3',[fileURLToPath(new URL('./media-decode.py',import.meta.url))],
      {input:bytes,timeout:5000,maxBuffer:8192,windowsHide:true,shell:false});
    let proof;try{proof=JSON.parse(execution.stdout?.toString()??'');}catch{}
    if(execution.error?.code==='ENOENT'||proof?.error==='MEDIA_DECODER_UNAVAILABLE')throw Error('VISUAL_MEDIA_DECODER_UNAVAILABLE');
    if(execution.status!==0||proof?.mime!==mime||!Number.isSafeInteger(proof.width)||!Number.isSafeInteger(proof.height)||proof.width*proof.height>VISUAL_MAX_PIXELS)throw Error('VISUAL_MEDIA_CORRUPT');
    const pathKey=String(process.env.PATH??process.env.Path??'');
    if(pythonProbeByPath.size>=32)pythonProbeByPath.delete(pythonProbeByPath.keys().next().value);
    pythonProbeByPath.set(pathKey,true);
    result=proof;
  }else throw Error('VISUAL_MEDIA_CODEC_UNSUPPORTED');
  // Content-addressed cache; never cache unverified bytes or external state.
  if(decoded.size>=MAX_CACHE_ENTRIES)decoded.delete(decoded.keys().next().value);
  decoded.set(key,Object.freeze(result));
  cacheDirty=true;
  return {...result};
}
