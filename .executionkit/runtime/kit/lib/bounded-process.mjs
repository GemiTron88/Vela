import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const runner=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../bin/bounded-process-runner.mjs');

export function resolveNodeHost(execPath=process.execPath){
  const raw=String(execPath);
  const base=(raw.includes('\\') ? path.win32.basename(raw) : path.basename(raw)).toLowerCase();
  return base==='node'||base==='node.exe' ? execPath : 'node';
}

export function spawnBoundedSync(command,args=[],{
  cwd=process.cwd(),
  timeoutMs=300000,
  maxBuffer=16*1024*1024,
  encoding='utf8',
  windowsHide=true,
  env=process.env,
  forwardProgress=false,
  progressContext=null,
  progressMode=env.EXECUTIONKIT_CLI_PROGRESS_MODE??'stages',
}={}){
  if(!Number.isFinite(Number(timeoutMs))||Number(timeoutMs)<=0||Number(timeoutMs)>2147483647)throw new RangeError('Bounded process timeout must be a positive finite timer budget');
  if(!Number.isFinite(Number(maxBuffer))||Number(maxBuffer)<=0)throw new RangeError('Bounded process buffer must be positive and finite');
  const budget=Math.max(1,Math.ceil(Number(timeoutMs)));
  maxBuffer=Math.max(1024,Math.floor(Number(maxBuffer)));
  const nodeHost=resolveNodeHost();
  const effectiveCommand=command===process.execPath&&nodeHost!==process.execPath ? nodeHost : command;
  const payload=Buffer.from(JSON.stringify({command:effectiveCommand,args,cwd,timeoutMs:budget,maxBuffer,forwardProgress,progressContext,progressMode})).toString('base64');
  const outer=spawnSync(nodeHost,[runner],{
    cwd,
    encoding:'utf8',
    timeout:budget+5000,
    // JSON can escape one byte as six characters (for example a NUL).
    maxBuffer:Math.max(maxBuffer*6+65536,1024*1024),
    windowsHide,
    stdio:['ignore','pipe','inherit'],
    env:{...env,EXECUTIONKIT_BOUNDED_PAYLOAD:payload},
  });
  if(outer.error){
    return {status:null,signal:outer.signal??null,stdout:String(outer.stdout??''),stderr:'',error:outer.error,timedOut:outer.error.code==='ETIMEDOUT'};
  }
  let parsed;
  try{parsed=JSON.parse(String(outer.stdout??'').trim());}
  catch{
    return {status:outer.status,signal:outer.signal??null,stdout:'',stderr:String(outer.stdout||'bounded runner returned invalid output'),error:new Error('bounded runner returned invalid output'),timedOut:false};
  }
  const error=parsed.error?Object.assign(new Error(parsed.error.message),{code:parsed.error.code??undefined}):null;
  return {
    status:parsed.status??null,
    signal:parsed.signal??null,
    stdout:String(parsed.stdout??''),
    stderr:String(parsed.stderr??''),
    error,
    timedOut:parsed.timedOut===true,
    durationMs:Number(parsed.durationMs??0),
    invocation:parsed.invocation??null,
  };
}
