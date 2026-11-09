#!/usr/bin/env node
import path from 'node:path';
import { documentationFabricStatus, searchDocumentationFabric, validateDocumentationFabric, writeDocumentationFabric } from '../lib/documentation-fabric.mjs';

const args=process.argv.slice(2);
const action=args[0]&&!args[0].startsWith('--')?args.shift():'status';
const root=path.resolve(args[0]&&!args[0].startsWith('--')?args.shift():'.');
const value=(name)=>{const eq=args.find((x)=>x.startsWith(`--${name}=`));if(eq)return eq.slice(name.length+3);const i=args.indexOf(`--${name}`);return i>=0?args[i+1]??null:null;};
try{
  let result;
  if(action==='status')result=documentationFabricStatus(root);
  else if(action==='build'||action==='refresh')result=writeDocumentationFabric(root);
  else if(action==='validate')result=validateDocumentationFabric(root);
  else if(action==='search')result=searchDocumentationFabric(root,value('query')??'',{limit:Number.parseInt(value('limit')??'20',10)});
  else if(action==='help')result={usage:'node bin/documentation-fabric.mjs status|build|refresh|validate|search [project] [--query text --limit N]',authority:'derived source-grounded; live source and canonical TODO win'};
  else throw new Error(`Unknown Documentation Fabric action: ${action}`);
  console.log(JSON.stringify(result,null,2));
  if(action==='validate'&&result.ok===false)process.exitCode=1;
}catch(error){console.error(JSON.stringify({status:'BLOCKED',error:error.message}));process.exitCode=1;}
