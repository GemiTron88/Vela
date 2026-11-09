import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildSourcePack } from './repository-source.mjs';
import { buildNativeMacroContext } from './repository-context.mjs';
import { measureArtifactFreshness } from './repository-freshness.mjs';
import { evaluateRepositoryIntelligence } from './repository-evaluation.mjs';

export const repositoryBenchmarkScenarios=Object.freeze({
  small:Object.freeze({modules:2,filesPerModule:20,monorepo:false}),
  medium:Object.freeze({modules:6,filesPerModule:80,monorepo:false}),
  large:Object.freeze({modules:12,filesPerModule:180,monorepo:false}),
  monorepo:Object.freeze({modules:8,filesPerModule:220,monorepo:true}),
});

function git(root,args){
  const r=spawnSync('git',args,{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024,windowsHide:true});
  if(r.status!==0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr||r.stdout}`);
  return r.stdout.trim();
}
function write(root,rel,content){
  const full=path.join(root,...rel.split('/'));fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,content);
}
export function createRepositoryBenchmarkScenario(name,{baseDir=null,definition=null}={}){
  const def=definition??repositoryBenchmarkScenarios[name];
  if(!def)throw new Error(`Unknown benchmark scenario: ${name}`);
  const parent=baseDir??os.tmpdir(),root=fs.mkdtempSync(path.join(parent,`ek-ri-bench-${name}-`));
  git(root,['init']);git(root,['config','user.email','benchmark@example.invalid']);git(root,['config','user.name','RI Benchmark']);
  write(root,'.gitignore','.executionkit/\nnode_modules/\n');
  write(root,'package.json',JSON.stringify({name:`ri-${name}`,private:true,dependencies:{express:'1.0.0'}},null,2)+'\n');
  const expectedPaths=[];
  for(let m=0;m<def.modules;m++){
    const base=def.monorepo?`packages/pkg-${m}/src`:`src/module-${m}`;
    for(let i=0;i<def.filesPerModule;i++){
      const rel=`${base}/file-${i}.js`;
      const needle=(m===0&&i===0)?`needle_${name}`:`symbol_${m}_${i}`;
      write(root,rel,`export function ${needle}() { return "${name}:${m}:${i}"; }\n`);
      if(m===0&&i===0)expectedPaths.push(rel);
    }
    write(root,`${base}/index.js`,`export const moduleId = ${m};\n`);
  }
  if(def.monorepo){
    write(root,'apps/web/src/main.js','export const app = "web";\n');
    write(root,'apps/api/src/main.js','export const app = "api";\n');
    write(root,'pnpm-workspace.yaml','packages:\n  - "packages/*"\n  - "apps/*"\n');
  }
  write(root,'routes/api.js','export const routes = ["/health"];\n');
  write(root,'database/migrations/001.sql','CREATE TABLE benchmark_items(id integer);\n');
  write(root,'tests/integration/benchmark.test.js','export const benchmarkTest = true;\n');
  write(root,'Dockerfile','FROM node:22\n');
  git(root,['add','.']);git(root,['commit','-m','benchmark baseline']);
  return {root,name,definition:def,query:{query:`needle_${name}`,expectedPaths},mutationPath:expectedPaths[0]};
}

export function evaluateRepositoryBenchmarkScenario(name,{iterations=3,contextMaxBytes=16*1024,definition=null}={}){
  const fixture=createRepositoryBenchmarkScenario(name,{definition});
  try{
    const baselinePack=buildSourcePack(fixture.root),baselineContext=buildNativeMacroContext(baselinePack,{maxBytes:contextMaxBytes});
    const evaluation=evaluateRepositoryIntelligence(fixture.root,{queries:[fixture.query],iterations,contextMaxBytes});
    fs.appendFileSync(path.join(fixture.root,...fixture.mutationPath.split('/')),'// stale-answer mutation\n');
    git(fixture.root,['add','.']);git(fixture.root,['commit','-m','benchmark stale mutation']);
    const stale=measureArtifactFreshness(fixture.root,baselineContext);
    return {
      schemaVersion:'repository-intelligence-benchmark-scenario/v1',
      scenario:name,
      definition:fixture.definition,
      evaluation,
      staleKnowledgeCheck:{
        state:stale.trust.state,
        score:stale.trust.score,
        sourceValidationRequired:stale.trust.sourceValidationRequired,
        relevantChangedPaths:stale.drift.relevantChangedPaths,
        baselineSha:stale.baselineSha,
        currentHead:stale.currentHead,
        passed:stale.trust.sourceValidationRequired===true&&stale.drift.relevantChangedPaths.includes(fixture.mutationPath),
      },
    };
  }finally{fs.rmSync(fixture.root,{recursive:true,force:true});}
}

export function evaluateRepositoryBenchmarkSuite({scenarios=Object.keys(repositoryBenchmarkScenarios),iterations=3,contextMaxBytes=16*1024}={}){
  const startedAt=new Date().toISOString();
  const results=scenarios.map((name)=>evaluateRepositoryBenchmarkScenario(name,{iterations,contextMaxBytes}));
  return {
    schemaVersion:'repository-intelligence-benchmark-suite/v1',
    startedAt,
    completedAt:new Date().toISOString(),
    environment:{node:process.version,platform:process.platform,arch:process.arch},
    results,
    allStaleChecksPassed:results.every((item)=>item.staleKnowledgeCheck.passed),
    note:'Synthetic scale evidence is a reproducible regression benchmark, not a substitute for real-project exact-candidate performance evidence.',
  };
}
