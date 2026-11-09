import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeKnowledgePath } from './repository-intelligence.mjs';
import { captureRepositorySnapshot, isSensitiveRepositoryPath, scanStrongSecrets } from './repository-source.mjs';

const ALLOWED_TEXT_EXTS=new Set(['.md','.markdown','.txt','.sql','.json','.yaml','.yml']);
const sha=(value)=>crypto.createHash('sha256').update(value).digest('hex');
const now=()=>new Date().toISOString();

function classify(rel,content){
  const lower=rel.toLowerCase(),ext=path.posix.extname(lower);
  if(ext==='.sql') return 'SQL_SCHEMA';
  if(/(^|\/)(adr|adrs|decisions?|architecture-decisions?)(\/|$)/.test(lower)||/\barchitecture decision record\b/i.test(content.slice(0,2000))) return 'ADR';
  if(/glossary|terminology|domain-terms?/.test(lower)) return 'GLOSSARY';
  if(/openapi|swagger/.test(lower)||/^\s*(openapi|swagger)\s*:/m.test(content)||/"openapi"\s*:|"swagger"\s*:/.test(content.slice(0,5000))) return 'OPENAPI';
  if(ext==='.json'||ext==='.yaml'||ext==='.yml') return 'STRUCTURED_DOC';
  if(ext==='.md'||ext==='.markdown') return 'MARKDOWN';
  return 'TEXT';
}
function metadata(kind,content){
  if(kind==='SQL_SCHEMA'){
    const tables=[...content.matchAll(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?([A-Za-z0-9_.-]+)/gi)].map((m)=>m[1]);
    return {tables:[...new Set(tables)].slice(0,200)};
  }
  if(kind==='OPENAPI'){
    const json=(()=>{try{return JSON.parse(content);}catch{return null;}})();
    if(json&&typeof json==='object') return {title:json.info?.title??null,version:json.info?.version??null,pathCount:json.paths&&typeof json.paths==='object'?Object.keys(json.paths).length:null};
    const pathLines=content.split(/\r?\n/).filter((line)=>/^\s{0,6}\/[^:]+:\s*$/.test(line));
    return {title:null,version:null,pathCount:pathLines.length||null};
  }
  const headings=content.split(/\r?\n/).filter((line)=>/^#{1,3}\s+/.test(line)).slice(0,40).map((line)=>line.replace(/^#{1,3}\s+/,'')); 
  return {headings};
}
function safeRead(root,rel,{maxFileBytes,pdfProvider}){
  const normalized=normalizeKnowledgePath(rel),policy=isSensitiveRepositoryPath(normalized);
  if(policy.denied) throw new Error(`Knowledge source denied: ${normalized} (${policy.reason})`);
  const full=path.resolve(root,...normalized.split('/')),base=path.resolve(root);
  if(!(full===base||full.startsWith(`${base}${path.sep}`))) throw new Error(`Knowledge source escapes repository: ${normalized}`);
  if(!fs.existsSync(full)) throw new Error(`Knowledge source not found: ${normalized}`);
  const stat=fs.lstatSync(full);
  if(stat.isSymbolicLink()) throw new Error(`Knowledge source symlink is forbidden: ${normalized}`);
  if(!stat.isFile()) throw new Error(`Knowledge source must be a file: ${normalized}`);
  if(stat.size>maxFileBytes) throw new Error(`Knowledge source exceeds maxFileBytes: ${normalized}`);
  const ext=path.extname(normalized).toLowerCase();
  if(ext==='.pdf'){
    if(typeof pdfProvider!=='function') throw new Error(`optional_pdf_provider_required: ${normalized}`);
    const provided=pdfProvider({root,relativePath:normalized,absolutePath:full,maxBytes:maxFileBytes});
    if(!provided||typeof provided.text!=='string') throw new Error(`PDF provider returned invalid text: ${normalized}`);
    const bytes=Buffer.byteLength(provided.text,'utf8');
    if(bytes>maxFileBytes) throw new Error(`PDF provider output exceeds maxFileBytes: ${normalized}`);
    if(scanStrongSecrets(provided.text).detected) throw new Error(`Secret-like content detected in knowledge source: ${normalized}`);
    return {path:normalized,content:provided.text,bytes,sourceProvider:provided.provider??'optional-pdf-provider',originalBytes:stat.size};
  }
  if(!ALLOWED_TEXT_EXTS.has(ext)) throw new Error(`unsupported_knowledge_type: ${normalized}`);
  const buffer=fs.readFileSync(full);
  if(buffer.includes(0)) throw new Error(`Binary knowledge source is unsupported: ${normalized}`);
  const content=buffer.toString('utf8');
  if(scanStrongSecrets(content).detected) throw new Error(`Secret-like content detected in knowledge source: ${normalized}`);
  return {path:normalized,content,bytes:buffer.length,sourceProvider:'native-text',originalBytes:buffer.length};
}

export function ingestExternalKnowledge(root,paths,{maxFileBytes=256*1024,maxTotalBytes=2*1024*1024,pdfProvider=null}={}){
  if(!Array.isArray(paths)||paths.length===0) throw new Error('At least one external knowledge path is required');
  if(!Number.isInteger(maxFileBytes)||maxFileBytes<1024||maxFileBytes>2*1024*1024) throw new Error('maxFileBytes must be 1 KiB..2 MiB');
  if(!Number.isInteger(maxTotalBytes)||maxTotalBytes<maxFileBytes||maxTotalBytes>16*1024*1024) throw new Error('maxTotalBytes is invalid');
  const normalized=[...new Set(paths.map(normalizeKnowledgePath))].sort();
  const entries=[]; let totalBytes=0;
  for(const rel of normalized){
    const read=safeRead(root,rel,{maxFileBytes,pdfProvider});
    if(totalBytes+read.bytes>maxTotalBytes) throw new Error(`External knowledge total budget exceeded at ${rel}`);
    const kind=classify(rel,read.content),digest=sha(read.content);
    entries.push({
      id:`knowledge:${digest.slice(0,16)}`,path:rel,kind,ownership:'HUMAN_MAINTAINED_SOURCE',
      sha256:digest,bytes:read.bytes,sourceProvider:read.sourceProvider,metadata:metadata(kind,read.content),content:read.content,
    });
    totalBytes+=read.bytes;
  }
  const snapshot=captureRepositorySnapshot(root),generatedAt=now();
  return {
    schemaVersion:'1.0.0',artifactId:'repository-external-knowledge',artifactType:'external-knowledge',
    ownershipClass:'GENERATED_PORTABLE',evidenceKind:'HUMAN_DOMAIN_KNOWLEDGE',
    repository:{key:snapshot.repositoryKey,isGit:snapshot.isGit,baselineSha:snapshot.head,branch:snapshot.branch,dirty:snapshot.dirty},
    provider:{id:'native-external-knowledge-ingest',version:'1.0.0'},generatedAt,sourceScopes:normalized,
    inputFingerprints:entries.map((entry)=>({kind:`source:${entry.path}`,value:entry.sha256})),
    metrics:{entryCount:entries.length,totalBytes},trust:{state:'VERIFY',measuredAt:generatedAt,reasons:['human_knowledge_is_advisory_against_live_source']},
    portable:true,authority:'ADVISORY_ONLY',conflictPolicy:'LIVE_SOURCE_WINS',entries,
  };
}

export function searchExternalKnowledge(artifact,query,{limit=20}={}){
  if(!artifact||artifact.artifactType!=='external-knowledge'||!Array.isArray(artifact.entries)) throw new Error('External knowledge artifact is required');
  if(typeof query!=='string'||!query.trim()) throw new Error('External knowledge search query is required');
  if(!Number.isInteger(limit)||limit<1||limit>100) throw new Error('limit must be 1..100');
  const needle=query.toLowerCase(),hits=[];
  for(const entry of artifact.entries){
    const lines=entry.content.split(/\r?\n/);
    for(let i=0;i<lines.length;i++){
      const idx=lines[i].toLowerCase().indexOf(needle); if(idx<0)continue;
      hits.push({id:entry.id,path:entry.path,kind:entry.kind,line:i+1,column:idx+1,snippet:lines.slice(Math.max(0,i-1),Math.min(lines.length,i+2)).join('\n'),sha256:entry.sha256});
      if(hits.length>=limit)return hits;
    }
  }
  return hits;
}
