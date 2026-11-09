#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../lib/execution-model.mjs';
import { planAntigravityV4, validateAntigravityV4 } from '../lib/antigravity-v4.mjs';
import { projectFile } from '../lib/quality-model.mjs';

const args=process.argv.slice(2);
const root=path.resolve(args.find((x)=>!x.startsWith('--'))??'.');
try{
  const {config,source}=loadConfig(root);
  if(!source)throw new Error('execution.config.json is required');
  const plan=planAntigravityV4(root,config);
  const changes=[];
  for(const [rel,content] of plan.writes){
    const full=projectFile(root,rel),before=fs.existsSync(full)?fs.readFileSync(full,'utf8').replaceAll('\r\n','\n'):null;
    if(before!==content)changes.push({rel,full,before,content});
  }
  if(args.includes('--apply')){
    try{
      for(const c of changes){fs.mkdirSync(path.dirname(c.full),{recursive:true});fs.writeFileSync(c.full,c.content);}
      const checked=validateAntigravityV4(root,config);
      if(checked.errors.length)throw new Error(checked.errors.map((x)=>x.message).join('; '));
    }catch(error){
      for(const c of [...changes].reverse()){if(c.before===null)fs.rmSync(c.full,{force:true});else fs.writeFileSync(c.full,c.before);}
      throw error;
    }
  }
  console.log(JSON.stringify({schemaVersion:'executionkit-v4-antigravity/v1',apply:args.includes('--apply'),changes:changes.map((x)=>x.rel),cliFirst:true,mcp:false,sequentialOnly:false,dependencySafeParallel:true},null,2));
}catch(error){console.error(JSON.stringify({status:'BLOCKED',error:error.message}));process.exit(1);}
