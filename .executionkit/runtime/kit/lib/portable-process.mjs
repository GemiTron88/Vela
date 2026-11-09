import fs from 'node:fs';
import {assertNativeCommandHost} from './native-host-policy.mjs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const WINDOWS_BATCH_EXTENSIONS=new Set(['.cmd','.bat']);
const WINDOWS_DIRECT_EXTENSIONS=new Set(['.exe','.com']);
const WINDOWS_SHELL_META=/[\r\n&|<>^%]/;

function npmCliCandidates(command,execPath,pathApi=path){
  const cli=command==='npx'?'npx-cli.js':'npm-cli.js',dir=pathApi.dirname(execPath);
  return [
    pathApi.join(dir,'node_modules','npm','bin',cli),
    pathApi.resolve(dir,'..','node_modules','npm','bin',cli),
  ];
}
function defaultWhere(command){
  const r=spawnSync('where.exe',[command],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024,windowsHide:true,shell:false});
  if(r.error||r.status!==0)return [];
  return String(r.stdout??'').split(/\r?\n/).map((x)=>x.trim()).filter(Boolean);
}
function selectWindowsCommand(paths){
  const values=[...new Set((paths??[]).map((x)=>String(x).trim()).filter(Boolean))];
  return values.find((x)=>WINDOWS_DIRECT_EXTENSIONS.has(path.win32.extname(x).toLowerCase()))
    ?? values.find((x)=>WINDOWS_BATCH_EXTENSIONS.has(path.win32.extname(x).toLowerCase()))
    ?? values[0]
    ?? null;
}
function assertBatchArgsSafe(command,args){
  const values=[command,...args].map(String);
  const unsafe=values.find((value)=>WINDOWS_SHELL_META.test(value));
  if(unsafe!==undefined)throw new Error('Windows batch invocation contains shell metacharacters that cannot be safely forwarded: '+unsafe);
}

export function resolvePortableInvocation(command,args=[],{
  platform=process.platform,
  execPath=process.execPath,
  env=process.env,
  where=defaultWhere,
  exists=(file)=>fs.existsSync(file),
}={}){
  if(typeof command!=='string'||!command.trim())throw new Error('Portable command requires a non-empty executable name');
  if(!Array.isArray(args))throw new Error('Portable command args must be an array');
  const normalizedArgs=args.map((x)=>String(x));
  if(platform!=='win32')return {command,args:normalizedArgs,shell:false,strategy:'direct'};

  const pathApi=path.win32;
  const base=pathApi.basename(command).toLowerCase().replace(/\.(?:cmd|bat|exe|com)$/,'');
  if(base==='node')return {command:execPath,args:normalizedArgs,shell:false,strategy:'node-executable'};
  if(base==='npm'||base==='npx'){
    for(const candidate of npmCliCandidates(base,execPath,pathApi)){
      if(exists(candidate))return {command:execPath,args:[candidate,...normalizedArgs],shell:false,strategy:'node-package-cli'};
    }
  }

  let resolved=command;
  const isNodeShebang=(candidate)=>{
    try{
      if(exists(candidate)&&fs.statSync(candidate).isFile()){
        const head=fs.readFileSync(candidate,'utf8').slice(0,256).split(/\r?\n/)[0]??'';
        return head.startsWith('#!')&&/node(?:\.exe)?$/i.test(head.slice(2).trim());
      }
    }catch{}
    return false;
  };
  const hasPath=pathApi.isAbsolute(command)||/[\\/]/.test(command);
  if(hasPath&&isNodeShebang(resolved)){
    return {command:execPath,args:[resolved,...normalizedArgs],shell:false,strategy:'node-shebang-script',resolvedCommand:resolved};
  }
  if(!hasPath){
    const pathVar=env?.PATH??env?.Path??'';
    for(const dir of String(pathVar).split(path.delimiter).filter(Boolean)){
      const candidate=pathApi.join(dir,command);
      if(isNodeShebang(candidate)){
        return {command:execPath,args:[candidate,...normalizedArgs],shell:false,strategy:'node-shebang-script',resolvedCommand:candidate};
      }
    }
    const found=selectWindowsCommand(where(command));
    if(found)resolved=found;
  }
  const ext=pathApi.extname(resolved).toLowerCase();
  if(WINDOWS_BATCH_EXTENSIONS.has(ext)){
    const comspec=env?.ComSpec||env?.COMSPEC;
    if(!comspec)throw new Error('Windows batch invocation requires ComSpec');
    assertBatchArgsSafe(resolved,normalizedArgs);
    return {command:comspec,args:['/d','/v:off','/s','/c',resolved,...normalizedArgs],shell:false,strategy:'windows-batch-wrapper',resolvedCommand:resolved};
  }
  return {command:resolved,args:normalizedArgs,shell:false,strategy:'direct'};
}

export function spawnPortableSync(command,args=[],spawnOptions={},resolveOptions={}){
  assertNativeCommandHost(command,args);
  const invocation=resolvePortableInvocation(command,args,resolveOptions);
  const result=spawnSync(invocation.command,invocation.args,{...spawnOptions,shell:false});
  return {result,invocation};
}
