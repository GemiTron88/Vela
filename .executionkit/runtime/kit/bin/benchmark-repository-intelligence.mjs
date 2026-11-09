#!/usr/bin/env node
import path from 'node:path';
import { evaluateRepositoryIntelligence, loadEvaluationQueries } from '../lib/repository-evaluation.mjs';

const args=process.argv.slice(2),root=path.resolve(args.find((arg)=>!arg.startsWith('--'))??'.');
const get=(name)=>{const v=args.find((arg)=>arg.startsWith(`--${name}=`));return v?v.slice(name.length+3):null;};
try{
  const queries=loadEvaluationQueries(root,get('queries'));
  const iterations=Number.parseInt(get('iterations')??'3',10);
  const contextMaxBytes=Number.parseInt(get('context-max-bytes')??String(16*1024),10);
  console.log(JSON.stringify(evaluateRepositoryIntelligence(root,{queries,iterations,contextMaxBytes}),null,2));
}catch(error){console.error(JSON.stringify({status:'BLOCKED',error:error.message}));process.exit(1);}
