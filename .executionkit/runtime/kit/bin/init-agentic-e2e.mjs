#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveProjectPathSafe } from '../lib/derived-state.mjs';
import { E2E_VERSIONS } from '../lib/agentic-e2e.mjs';

const root=path.resolve(process.argv[2]??'.');
const platform=(process.argv.find((x)=>x.startsWith('--platform='))??'--platform=web').split('=')[1];
const kit=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
try{
  if(!['web','android','ios'].includes(platform))throw new Error('Use web, android or ios');
  const rel='tests/agentic',suite=resolveProjectPathSafe(root,rel,'Agentic suite',{createParents:true});
  const files=['package.json','package-lock.json','e2e.config.ts','environment-probe.mjs','postconditions.mjs','.gitignore'];
  if(fs.existsSync(path.join(root,'executionkit.journeys.json'))||fs.existsSync(suite))throw new Error('Refuse to overwrite an existing native journey suite/manifest');
  fs.mkdirSync(suite);
  try{
    for(const file of files){
      if(file==='postconditions.mjs')fs.copyFileSync(path.join(kit,'lib/agentic-postconditions.mjs'),path.join(suite,file));
      else fs.copyFileSync(path.join(kit,'templates/agentic',file),path.join(suite,file));
    }
    const pkg=JSON.parse(fs.readFileSync(path.join(suite,'package.json'),'utf8'));
    if(platform!=='web'){fs.rmSync(path.join(suite,'package-lock.json'));delete pkg.devDependencies['@e2e-dev/web'];pkg.devDependencies['@e2e-dev/mobile']=E2E_VERSIONS.mobile;}
    fs.writeFileSync(path.join(suite,'package.json'),JSON.stringify(pkg,null,2)+'\n');
    fs.writeFileSync(path.join(root,'executionkit.journeys.json'),JSON.stringify({
      schemaVersion:'executionkit-agentic/v1',app:{identity:'',revision:'',environment:'staging'},suiteDir:rel,config:rel+'/e2e.config.ts',
      targets:[{name:platform,platform,role:'',locale:'ar-EG'}],journeys:[],
      budgets:{timeoutMs:600000,maxModelCalls:60,maxModelTokens:200000,maxJourneys:9},
      environmentProbe:{command:'node',args:[rel+'/environment-probe.mjs']}
    },null,2)+'\n',{flag:'wx'});
  }catch(error){fs.rmSync(suite,{recursive:true,force:true});throw error;}
  console.log(JSON.stringify({status:'INITIALIZED_NOT_ACCEPTED',suite:rel,platform,next:'Fill the real app/role/revision and three risk journeys, implement their live oracles, then npm install in tests/agentic and commit its lockfile. Read contracts/agentic-e2e-contract.md.'}));
}catch(error){console.error(error.message);process.exitCode=1;}
