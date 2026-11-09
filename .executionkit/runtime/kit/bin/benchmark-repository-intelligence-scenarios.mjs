#!/usr/bin/env node
import { evaluateRepositoryBenchmarkSuite, repositoryBenchmarkScenarios } from '../lib/repository-benchmark-scenarios.mjs';

const args=process.argv.slice(2);
const get=(name)=>{const x=args.find((arg)=>arg.startsWith(`--${name}=`));return x?x.slice(name.length+3):null;};
try{
  const requested=get('scenarios');
  const scenarios=requested?requested.split(',').map((x)=>x.trim()).filter(Boolean):Object.keys(repositoryBenchmarkScenarios);
  const iterations=Number.parseInt(get('iterations')??'3',10);
  const contextMaxBytes=Number.parseInt(get('context-max-bytes')??String(16*1024),10);
  const result=evaluateRepositoryBenchmarkSuite({scenarios,iterations,contextMaxBytes});
  console.log(JSON.stringify(result,null,2));
  process.exit(result.allStaleChecksPassed?0:1);
}catch(error){console.error(JSON.stringify({status:'BLOCKED',error:error.message}));process.exit(1);}
