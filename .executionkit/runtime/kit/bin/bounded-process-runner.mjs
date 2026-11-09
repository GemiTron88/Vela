#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { resolvePortableInvocation } from '../lib/portable-process.mjs';
import {assertNativeCommandHost} from '../lib/native-host-policy.mjs';

// Cancellation can close a nested runner's parent pipe before its child exits.
// The parent owns the failure receipt; a broken pipe is normal in that path.
for(const stream of [process.stdout,process.stderr])stream.on('error',error=>{if(error.code!=='EPIPE')throw error;});
function emit(value){if(!process.stdout.destroyed)process.stdout.write(JSON.stringify(value));}
function progress(value){if(!process.stderr.destroyed)process.stderr.write(value);}
function fail(message,code='BOUNDED_RUNNER_ERROR'){emit({status:null,signal:null,stdout:'',stderr:'',timedOut:false,durationMs:0,error:{message,code}});process.exit(0);}
const encoded=process.env.EXECUTIONKIT_BOUNDED_PAYLOAD;
if(!encoded)fail('bounded process payload is missing');

let payload;
try{payload=JSON.parse(Buffer.from(encoded,'base64').toString('utf8'));}catch(error){fail(error.message,'BOUNDED_PAYLOAD_INVALID');}
const timeoutMs=Math.max(1,Number(payload.timeoutMs)||300000);
const maxBuffer=Math.max(1024,Number(payload.maxBuffer)||16*1024*1024);
let invocation;
try{assertNativeCommandHost(payload.command,payload.args??[]);invocation=resolvePortableInvocation(payload.command,payload.args??[]);}catch(error){fail(error.message,'BOUNDED_INVOCATION_INVALID');}

const started=Date.now();
const chunks={stdout:[],stderr:[]};
let outputBytes=0,timedOut=false,cancelled=false,bufferExceeded=false,settled=false,hardKillTimer=null,killing=false,lastStage=null,stageBuffer='';
const heartbeat=setInterval(()=>{progress(JSON.stringify({schemaVersion:'executionkit-v4-process-progress/v1',status:'RUNNING',command:String(payload.command),...(payload.progressContext??{}),stage:lastStage,elapsedMs:Date.now()-started,remainingMs:Math.max(0,timeoutMs-(Date.now()-started)),timeoutMs})+'\n');},payload.forwardProgress?10000:30000);
heartbeat.unref?.();
const child=spawn(invocation.command,invocation.args,{
  cwd:payload.cwd,
  shell:false,
  windowsHide:true,
  detached:process.platform!=='win32',
  stdio:['ignore','pipe','pipe'],
});

function append(kind,chunk){
  if(bufferExceeded)return;
  const bytes=Buffer.from(chunk),remaining=maxBuffer-outputBytes;
  chunks[kind].push(bytes.subarray(0,Math.max(0,remaining)));
  outputBytes+=bytes.length;
  if(outputBytes>maxBuffer){
    bufferExceeded=true;
    killTree();
  }
}
child.stdout?.on('data',(chunk)=>append('stdout',chunk));
child.stderr?.on('data',(chunk)=>append('stderr',chunk));
if(payload.forwardProgress)child.stderr?.on('data',chunk=>{
  if(payload.progressMode==='full')progress(chunk);
  stageBuffer=(stageBuffer+String(chunk)).slice(-16384);
  const lines=stageBuffer.split('\n');stageBuffer=lines.pop();
  for(const line of lines){try{
    const event=JSON.parse(line);
    if(typeof event.stage==='string')lastStage=event.stage.slice(0,160);
    if(payload.progressMode!=='full'&&payload.progressMode!=='heartbeat'&&event.schemaVersion?.includes('progress')&&event.status!=='RUNNING')progress(JSON.stringify({operation:event.operation??payload.progressContext?.operation,stage:lastStage,status:event.status,durationMs:event.durationMs})+'\n');
  }catch{}}
});

function forceKill(){
  if(!child.pid)return;
  if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:5000});
  else {try{process.kill(-child.pid,'SIGKILL');}catch{try{child.kill('SIGKILL');}catch{}}}
}
function killTree(){
  if(killing||!child.pid)return;
  killing=true;
  if(process.platform==='win32'){
    spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:5000});
  }else{
    try{process.kill(-child.pid,'SIGTERM');}catch{try{child.kill('SIGTERM');}catch{}}
    hardKillTimer=setTimeout(forceKill,1000);
  }
}

function finish(value){
  if(settled)return;settled=true;
  clearTimeout(timer);clearInterval(heartbeat);
  // The leader may exit on TERM while a descendant ignores it and closes stdio.
  // Kill the remaining group before clearing its forced-termination timer.
  if(killing)forceKill();
  if(hardKillTimer)clearTimeout(hardKillTimer);
  emit({...value,stdout:Buffer.concat(chunks.stdout).toString('utf8'),stderr:Buffer.concat(chunks.stderr).toString('utf8'),timedOut,durationMs:Date.now()-started,invocation});
}

const timer=setTimeout(()=>{timedOut=true;killTree();},timeoutMs);
// A parent bounded runner cancels our group. Propagate cancellation into any
// detached child group immediately, before the parent's forced kill arrives.
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{cancelled=true;killTree();forceKill();});
child.on('error',(error)=>{
  finish({status:null,signal:null,error:{message:error.message,code:error.code??null}});
});
child.on('close',(code,signal)=>{
  const error=timedOut?{message:'process tree exceeded '+timeoutMs+'ms deadline',code:'ETIMEDOUT'}:cancelled?{message:'process tree was cancelled by its parent',code:'ECANCELED'}:bufferExceeded?{message:'process output exceeded bounded buffer',code:'MAXBUFFER'}:null;
  finish({status:code,signal,error});
});
