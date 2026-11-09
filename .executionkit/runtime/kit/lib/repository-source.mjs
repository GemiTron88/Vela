import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { normalizeKnowledgePath } from './repository-intelligence.mjs';

const GENERATED_SEGMENTS = new Set([
  '.git','.executionkit','.codegraph','.terrain','.litho-agent','node_modules','vendor','build','dist','.next','.dart_tool',
  'coverage','.turbo','.cache','Pods','.gradle','.idea','.vscode',
]);

const SENSITIVE_BASENAMES = new Set([
  '.env','.npmrc','.pypirc','.netrc','id_rsa','id_ed25519','id_ecdsa',
  'credentials','credentials.json','service-account.json','secrets.json',
]);

const SENSITIVE_EXTENSIONS = new Set(['.pem','.key','.p12','.pfx','.jks','.keystore']);

const STRONG_SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
];

const DEFAULTS = Object.freeze({
  maxFiles: 5000,
  maxFileBytes: 512 * 1024,
  maxTotalBytes: 4 * 1024 * 1024,
  maxEstimatedTokens: 600000,
});

function runGit(root, args) {
  const r=spawnSync('git', args, { cwd:root, encoding:'utf8', timeout:15000, maxBuffer:16*1024*1024, windowsHide:true });
  return { ok:r.status===0, status:r.status, stdout:r.stdout ?? '', stderr:r.stderr ?? '', error:r.error ?? null };
}
function zlines(value) { return String(value ?? '').split('\0').filter(Boolean); }
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function toPosix(rel) { return rel.split(path.sep).join('/'); }
function isFileBinary(buffer) {
  const sample=buffer.subarray(0, Math.min(buffer.length, 8192));
  for (const byte of sample) if (byte===0) return true;
  return false;
}
function estimateTokens(text) { return Math.ceil(Buffer.byteLength(text,'utf8') / 4); }
function extensionLanguage(rel) {
  const ext=path.extname(rel).toLowerCase();
  return ({
    '.js':'javascript','.mjs':'javascript','.cjs':'javascript','.ts':'typescript','.tsx':'tsx','.jsx':'jsx',
    '.php':'php','.dart':'dart','.rs':'rust','.go':'go','.py':'python','.java':'java','.kt':'kotlin',
    '.json':'json','.yaml':'yaml','.yml':'yaml','.md':'markdown','.sql':'sql','.sh':'bash','.html':'html',
    '.css':'css','.scss':'scss','.vue':'vue','.svelte':'svelte','.xml':'xml',
  })[ext] ?? '';
}

export function isSensitiveRepositoryPath(rel, extraDenyPaths = []) {
  const normalized=normalizeKnowledgePath(rel);
  const parts=normalized.split('/');
  if (parts.some((segment)=>GENERATED_SEGMENTS.has(segment))) return { denied:true, reason:'generated_or_internal' };

  const base=parts.at(-1).toLowerCase();
  const ext=path.posix.extname(base).toLowerCase();
  if (base==='.env.example' || base==='.env.sample') {
  } else if (base==='.env' || base.startsWith('.env.') || SENSITIVE_BASENAMES.has(base) || SENSITIVE_EXTENSIONS.has(ext)) {
    return { denied:true, reason:'sensitive_path' };
  }

  if (base.includes('private-key') || base.includes('private_key') || base.startsWith('secrets.') || base.startsWith('credential')) {
    return { denied:true, reason:'sensitive_path' };
  }

  for (const raw of extraDenyPaths) {
    const deny=normalizeKnowledgePath(raw);
    if (normalized===deny || normalized.startsWith(`${deny}/`)) return { denied:true, reason:'configured_deny' };
  }

  return { denied:false, reason:null };
}

export function scanStrongSecrets(text) {
  for (const pattern of STRONG_SECRET_PATTERNS) {
    pattern.lastIndex=0;
    if (pattern.test(text)) return { detected:true, pattern:pattern.source };
  }
  return { detected:false, pattern:null };
}

export function captureRepositorySnapshot(root) {
  const absolute=path.resolve(root);
  const inside=runGit(absolute,['rev-parse','--is-inside-work-tree']);
  const isGit=inside.ok && inside.stdout.trim()==='true';
  if (!isGit) {
    return { isGit:false, head:null, branch:null, dirty:false, dirtyPaths:[], trackedFiles:0, repositoryKey:hash(`local:${absolute}`.toLowerCase()) };
  }

  const headResult=runGit(absolute,['rev-parse','HEAD']);
  const branchResult=runGit(absolute,['rev-parse','--abbrev-ref','HEAD']);
  const tracked=runGit(absolute,['ls-files','-z']);
  const working=runGit(absolute,['diff','--name-only','-z']);
  const staged=runGit(absolute,['diff','--cached','--name-only','-z']);
  const untracked=runGit(absolute,['ls-files','--others','--exclude-standard','-z']);
  const dirtyParts=[
    working.ok ? zlines(working.stdout) : [],
    staged.ok ? zlines(staged.stdout) : [],
    untracked.ok ? zlines(untracked.stdout) : [],
  ].flat().map((x)=>toPosix(x));
  const dirtyPaths=[...new Set(dirtyParts)].sort();

  const origin=runGit(absolute,['config','--get','remote.origin.url']);
  const identity=origin.ok && origin.stdout.trim() ? origin.stdout.trim().replace(/^ssh:\/\/(?:[^@/\s]+@)?([^:/\s]+)(?::\d+)?\//i,'https://$1/').replace(/^(?:[^@/\s]+@)?([^:/\s]+):(?![/\\])/,'https://$1/').replace(/\.git$/i,'') : `local:${absolute}`;

  return {
    isGit:true,
    head:headResult.ok ? headResult.stdout.trim() : null,
    branch:branchResult.ok && branchResult.stdout.trim()!=='HEAD' ? branchResult.stdout.trim() : null,
    dirty:dirtyPaths.length>0,
    dirtyPaths,
    trackedFiles:tracked.ok ? zlines(tracked.stdout).length : 0,
    repositoryKey:hash(identity.toLowerCase()),
  };
}

function fallbackFiles(root) {
  const result=[];
  function walk(dir, prefix='') {
    for (const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const rel=prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (GENERATED_SEGMENTS.has(entry.name)) continue;
        walk(path.join(dir,entry.name),rel);
      } else if (entry.isFile() || entry.isSymbolicLink()) result.push(rel);
    }
  }
  walk(root);
  return result;
}

export function listRepositoryFiles(root) {
  const absolute=path.resolve(root);
  const snapshot=captureRepositorySnapshot(absolute);
  if (snapshot.isGit) {
    const listed=runGit(absolute,['ls-files','-co','--exclude-standard','-z']);
    if (listed.ok) return [...new Set(zlines(listed.stdout).map(toPosix))].sort();
  }
  return fallbackFiles(absolute).map(toPosix).sort();
}

export function buildSourcePack(root, options = {}) {
  const absolute=path.resolve(root);
  const limits={...DEFAULTS,...Object.fromEntries(Object.entries(options).filter(([k])=>Object.hasOwn(DEFAULTS,k)))};
  for (const [key,value] of Object.entries(limits)) {
    if (!Number.isInteger(value) || value<=0) throw new Error(`${key} must be a positive integer`);
  }
  const extraDenyPaths=options.extraDenyPaths ?? [];
  const snapshot=captureRepositorySnapshot(absolute);
  const candidates=listRepositoryFiles(absolute);
  const files=[], skipped=[];
  let totalBytes=0, totalTokens=0;

  for (const relRaw of candidates) {
    let rel;
    try { rel=normalizeKnowledgePath(relRaw); }
    catch { skipped.push({path:String(relRaw),reason:'unsafe_path'}); continue; }

    const policy=isSensitiveRepositoryPath(rel,extraDenyPaths);
    if (policy.denied) { skipped.push({path:rel,reason:policy.reason}); continue; }
    if (files.length>=limits.maxFiles) { skipped.push({path:rel,reason:'file_limit'}); continue; }

    const full=path.resolve(absolute,...rel.split('/'));
    if (!(full===absolute || full.startsWith(`${absolute}${path.sep}`))) { skipped.push({path:rel,reason:'path_escape'}); continue; }

    let stat;
    try { stat=fs.lstatSync(full); } catch { skipped.push({path:rel,reason:'unreadable'}); continue; }
    if (stat.isSymbolicLink()) { skipped.push({path:rel,reason:'symlink'}); continue; }
    if (!stat.isFile()) continue;
    if (stat.size>limits.maxFileBytes) { skipped.push({path:rel,reason:'file_too_large'}); continue; }

    const buffer=fs.readFileSync(full);
    if (isFileBinary(buffer)) { skipped.push({path:rel,reason:'binary'}); continue; }
    const text=buffer.toString('utf8');
    const secret=scanStrongSecrets(text);
    if (secret.detected) { skipped.push({path:rel,reason:'secret_detected'}); continue; }

    const bytes=buffer.length, estimatedTokens=estimateTokens(text);
    if (totalBytes+bytes>limits.maxTotalBytes || totalTokens+estimatedTokens>limits.maxEstimatedTokens) {
      skipped.push({path:rel,reason:'budget'}); continue;
    }

    const sha256=hash(buffer);
    const lineCount=text.length ? text.split(/\r?\n/).length : 0;
    files.push({path:rel,bytes,estimatedTokens,sha256,lineCount,language:extensionLanguage(rel),content:text});
    totalBytes+=bytes; totalTokens+=estimatedTokens;
  }

  const workingTreeFingerprint=hash(files.map((f)=>`${f.path}\0${f.sha256}`).join('\n'));
  return {
    schemaVersion:'1.0.0',
    generatedAt:new Date().toISOString(),
    repository:{
      key:snapshot.repositoryKey,
      isGit:snapshot.isGit,
      baselineSha:snapshot.head,
      branch:snapshot.branch,
      dirty:snapshot.dirty,
      dirtyPaths:snapshot.dirtyPaths,
      workingTreeFingerprint,
    },
    provider:{id:'native-source-pack',version:'1.0.0'},
    limits,
    metrics:{fileCount:files.length,totalBytes,totalEstimatedTokens:totalTokens,candidateCount:candidates.length,skippedCount:skipped.length},
    files,
    skipped,
  };
}

export function sourcePackMarkdown(pack) {
  return pack.files.map((file)=>{
    const lang=file.language || '';
    return `### ${file.path}\n\n\`\`\`${lang}\n${file.content}\n\`\`\``;
  }).join('\n\n');
}

export function readPackedFile(pack, filePath, { startLine=1, endLine=null, maxLines=150 } = {}) {
  const rel=normalizeKnowledgePath(filePath);
  const file=pack.files.find((item)=>item.path===rel);
  if (!file) throw new Error(`Packed source file not found: ${rel}`);
  if (!Number.isInteger(startLine) || startLine<1) throw new Error('startLine must be >= 1');
  const lines=file.content.split(/\r?\n/);
  const resolvedEnd=endLine==null ? Math.min(lines.length,startLine+maxLines-1) : endLine;
  if (!Number.isInteger(resolvedEnd) || resolvedEnd<startLine) throw new Error('endLine must be >= startLine');
  if (resolvedEnd-startLine+1>maxLines) throw new Error(`Requested source slice exceeds maxLines=${maxLines}`);
  return {
    path:rel,
    startLine,
    endLine:Math.min(resolvedEnd,lines.length),
    content:lines.slice(startLine-1,resolvedEnd).join('\n'),
    sha256:file.sha256,
    baselineSha:pack.repository.baselineSha,
    workingTreeFingerprint:pack.repository.workingTreeFingerprint,
  };
}

export function searchSourcePack(pack, query, { limit=20, contextLines=1 } = {}) {
  if (!Number.isInteger(limit) || limit<1 || limit>200) throw new Error('limit must be between 1 and 200');
  if (!Number.isInteger(contextLines) || contextLines<0 || contextLines>5) throw new Error('contextLines must be between 0 and 5');
  const regex=query instanceof RegExp ? new RegExp(query.source,query.flags.replace('g','')) : new RegExp([...String(query)].map((ch)=>'\\^$.*+?()[]{}|'.includes(ch) ? `\\${ch}` : ch).join(''),'i');
  const hits=[];
  for (const file of pack.files) {
    const lines=file.content.split(/\r?\n/);
    for (let i=0;i<lines.length;i++) {
      regex.lastIndex=0;
      const match=regex.exec(lines[i]);
      if (!match) continue;
      const from=Math.max(0,i-contextLines), to=Math.min(lines.length,i+contextLines+1);
      hits.push({path:file.path,line:i+1,column:(match.index ?? 0)+1,snippet:lines.slice(from,to).join('\n'),sha256:file.sha256});
      if (hits.length>=limit) return hits;
    }
  }
  return hits;
}
