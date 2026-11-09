import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DEV_DIRS=new Set(['.git','.github','.agent','.agents','.executionkit','docs','tests','test','spec','specs','fixtures','coverage','reports','artifacts','todo','__tests__','__snapshots__','__mocks__','__fixtures__','playwright-report','test-results','e2e','cypress','.storybook','storybook','benchmarks','.idea','.vscode','.dart_tool','.gradle','pods','.cache','.turbo','.codegraph','.terrain','.litho-agent']);
// These names also describe application domains. Only nested runtime paths may
// use them; repository-level documentation/output trees remain excluded.
const DOMAIN_DIRS=new Set(['docs','reports','artifacts','todo']);
const DOMAIN_ROOTS=new Set(['app','resources','routes','config','src','server','dist','build']);
const SECRET_FILES=new Set(['.npmrc','.pypirc','.netrc','id_rsa','id_ed25519','id_ecdsa','credentials','credentials.json','service-account.json','secrets.json','auth.json']);
const CONTROL_FILES=/^(?:\.?executionkit(?:[.-].*)?|execution\.config|quality\.contract|phpunit|phpstan|pint|infection|playwright\.config|vite\.config|AGENTS|TODO(?:_ARCHIVE)?|PLAYBOOK|STANDARD(?:_V\d+)?)(?:\.[^/]*)?$/i;
const DEV_FILES=/^(?:\.gitignore|\.gitattributes|\.gitkeep|\.editorconfig|\.DS_Store|\.browserslistrc|\.prettierignore|\.prettierrc(?:\..*)?|\.eslintrc(?:\..*)?)$/i;
const PRIVATE_EXT=/\.(?:pem|key|p12|pfx|jks|keystore)$/i;
const NON_RUNTIME_EXT=/\.(?:md|markdown|sql|sqlite|sqlite3|db|bak|orig|log|psd|ai|sketch|fig|tar|tgz|gz|zip|7z)$/i;

export const DEFAULT_ARTIFACT_BUDGET=Object.freeze({maxFiles:50000,maxTotalBytes:1073741824,maxFileBytes:134217728});
export function productionPathDenied(rel,{sourceMaps=false,nodeStandalone=false,dependencies=false}={}){
  const parts=String(rel).replaceAll('\\','/').split('/'),base=parts.at(-1),normalized=parts.join('/');
  if(parts.some(p=>!p||p==='.'||p==='..')||path.isAbsolute(rel))return 'unsafe_relative_path';
  // Composer-installed production package content is verified by its lock/install metadata.
  // Do not mutilate package licenses, PHP source, or internal runtime assets.
  const productionDependency=(dependencies&&parts[0]==='vendor')||(nodeStandalone&&normalized.startsWith('.next/standalone/node_modules/'));
  const runtimeDomain=DOMAIN_ROOTS.has(parts[0]);
  if(!productionDependency&&parts.some((p,index)=>DEV_DIRS.has(p.toLowerCase())&&!(index>0&&runtimeDomain&&DOMAIN_DIRS.has(p.toLowerCase()))))return 'non_production_control_or_dev_tree';
  if(!productionDependency&&DEV_FILES.test(base))return 'non_runtime_metadata';
  if(/^\.env(?:\.|$)/i.test(base)||SECRET_FILES.has(base.toLowerCase())||(PRIVATE_EXT.test(base)&&!(productionDependency&&base.endsWith('.pem')))||/^(?:secrets|credentials?)[.-]/i.test(base))return 'sensitive_path';
  if(!productionDependency&&(CONTROL_FILES.test(base)||/(^|\/)bin\/(?:executionkit|repository-|documentation-|production-deployment|validate-|state-|agent-|coordinate-|next-|audit-|setup-|integrate-|bootstrap-|release-|collect-|build-evidence|discover-|reconcile-|archive-|runtime-)/i.test(normalized)))return 'executionkit_or_control_plane';
  if(!productionDependency&&(NON_RUNTIME_EXT.test(base)||/^(?:README|CHANGELOG|CONTRIBUTING|LICENSE)(?:\.|$)/i.test(base)))return 'non_runtime_file';
  if(!productionDependency&&!sourceMaps&&base.endsWith('.map'))return 'source_map_disabled';
  if(parts.some(p=>p.toLowerCase()==='node_modules')&&!(nodeStandalone&&normalized.startsWith('.next/standalone/node_modules/')))return 'build_dependency_tree';
  if(parts.includes('vendor')&&!productionDependency&&!normalized.startsWith('resources/views/vendor/')&&!normalized.startsWith('public/vendor/'))return 'source_dependency_tree';
  return null;
}

export function hashProductionFile(file){
  const hash=crypto.createHash('sha256'),fd=fs.openSync(file,'r'),buffer=Buffer.allocUnsafe(65536);
  try{let n;while((n=fs.readSync(fd,buffer,0,buffer.length,null))>0)hash.update(buffer.subarray(0,n));}
  finally{fs.closeSync(fd);}
  return hash.digest('hex');
}

export function inventoryProductionTree(root,{ignoreLinks=[]}={}){
  const files=[],errors=[],links=new Map(ignoreLinks.map(x=>[x.path,path.resolve(x.target)]));
  function visit(dir,prefix=''){
    for(const name of fs.readdirSync(dir).sort()){
      const rel=prefix?`${prefix}/${name}`:name,full=path.join(dir,name),stat=fs.lstatSync(full);
      if(stat.isSymbolicLink()){
        const allowed=links.get(rel);
        if(!allowed||!fs.existsSync(full)||fs.realpathSync(full)!==fs.realpathSync(allowed))errors.push({code:'ARTIFACT_SYMLINK_FORBIDDEN',path:rel});
        continue;
      }
      if(links.has(rel)){errors.push({code:'SHARED_PATH_NOT_SYMLINK',path:rel});continue;}
      if(stat.isDirectory())visit(full,rel);
      else if(stat.isFile())files.push({path:rel,size:stat.size,mode:stat.mode&0o777,sha256:hashProductionFile(full)});
      else errors.push({code:'ARTIFACT_SPECIAL_FILE_FORBIDDEN',path:rel});
    }
  }
  visit(root);return {files,errors};
}

export function enforceArtifactBudget(files,budget=DEFAULT_ARTIFACT_BUDGET){
  for(const key of Object.keys(DEFAULT_ARTIFACT_BUDGET))if(!Number.isSafeInteger(budget[key])||budget[key]<=0)throw new Error(`Invalid deployment.artifactBudget.${key}`);
  const totalBytes=files.reduce((n,f)=>n+f.size,0),largest=files.reduce((a,b)=>b.size>(a?.size??-1)?b:a,null);
  if(files.length>budget.maxFiles||totalBytes>budget.maxTotalBytes||largest?.size>budget.maxFileBytes)throw new Error(`Production artifact exceeds configured budget: files=${files.length}, bytes=${totalBytes}, largest=${largest?.path??'none'}`);
  const groups=new Map();for(const file of files){const parts=file.path.split('/'),key=parts[0]==='vendor'&&parts.length>2?parts.slice(0,3).join('/'):parts[0];const group=groups.get(key)??{path:key,files:0,bytes:0};group.files++;group.bytes+=file.size;groups.set(key,group);}
  return {files:files.length,totalBytes,byRoot:[...groups.values()].sort((a,b)=>b.bytes-a.bytes),largestFile:largest?{path:largest.path,bytes:largest.size}:null,limits:budget};
}

export function compareProductionInventory(expected,actual){
  const errors=[],wanted=new Map();
  for(const item of expected){
    if(wanted.has(item.path)){errors.push({code:'ARTIFACT_DUPLICATE_MANIFEST_PATH',path:item.path});continue;}
    wanted.set(item.path,item);
  }
  const observed=new Map(actual.map(item=>[item.path,item]));
  for(const [rel,item] of wanted){
    const found=observed.get(rel);
    if(!found){errors.push({code:'ARTIFACT_FILE_MISSING',path:rel});continue;}
    if(item.sha256!==found.sha256)errors.push({code:'ARTIFACT_HASH_MISMATCH',path:rel});
    if(item.size!==found.size)errors.push({code:'ARTIFACT_SIZE_MISMATCH',path:rel});
    if((item.mode??found.mode)!==found.mode)errors.push({code:'ARTIFACT_MODE_MISMATCH',path:rel});
  }
  for(const rel of observed.keys())if(!wanted.has(rel))errors.push({code:'ARTIFACT_UNMANIFESTED_FILE',path:rel});
  return errors;
}

export function verifyComposerProductionDependencies(releaseDir){
  const lockFile=path.join(releaseDir,'composer.lock'),installedFile=path.join(releaseDir,'vendor/composer/installed.json');
  if(!fs.existsSync(installedFile))throw new Error('Composer production dependencies are missing: run locked composer install --no-dev in the staged release');
  const lock=JSON.parse(fs.readFileSync(lockFile,'utf8')),installed=JSON.parse(fs.readFileSync(installedFile,'utf8'));
  if(Array.isArray(installed)||installed.dev!==false||!Array.isArray(installed.packages))throw new Error('Composer installed metadata must prove --no-dev production installation');
  const wanted=new Map((lock.packages??[]).map(p=>[p.name,p]));
  for(const pkg of installed.packages){
    const expected=wanted.get(pkg.name);
    if(!expected||pkg.version!==expected.version||
      JSON.stringify(pkg.dist?.reference??pkg.source?.reference??null)!==JSON.stringify(expected.dist?.reference??expected.source?.reference??null))throw new Error(`Composer installed package does not match production lock: ${pkg.name}`);
    const installPath=path.resolve(path.join(releaseDir,'vendor/composer'),pkg['install-path']??`../${pkg.name}`);
    if(!installPath.startsWith(path.join(releaseDir,'vendor')+path.sep))throw new Error('Composer dependency escapes staged vendor directory');
    wanted.delete(pkg.name);
  }
  if(wanted.size)throw new Error(`Composer production installation is incomplete: ${[...wanted.keys()].join(', ')}`);
  return {status:'PASS',packages:installed.packages.length,noDev:true};
}
