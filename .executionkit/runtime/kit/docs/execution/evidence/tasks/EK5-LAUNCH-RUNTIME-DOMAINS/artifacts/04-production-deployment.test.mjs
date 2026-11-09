import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import crypto from 'node:crypto';
import {inspectVhostGuard} from '../lib/vhost-guard.mjs';
import { acquireDeploymentLock, processUsesRelease, retainSuccessfulReleases } from '../lib/production-retention.mjs';
import { verifyComposerProductionDependencies } from '../lib/production-artifact-policy.mjs';
import { buildProductionArtifact, deployProductionArtifact, planProductionArtifact, productionDeploymentHostCheck, productionDeploymentHostPlan, productionDeploymentStatus, rollbackProductionDeployment, validateProductionArtifact, validateProductionDeploymentReadiness } from '../lib/production-deployment.mjs';

function git(root,args){const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'ek-deploy-fabric-')),target=fs.mkdtempSync(path.join(os.tmpdir(),'ek-deploy-target-'));
  t.after(()=>{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(target,{recursive:true,force:true});});
  git(root,['init']);git(root,['config','user.email','deploy@example.invalid']);git(root,['config','user.name','Deploy Test']);
  fs.writeFileSync(path.join(root,'.gitignore'),'.executionkit/\npublic/build/hot\n');
  for(const d of ['app/Http','bootstrap','config','database/migrations','public/build','resources/views','routes','docs','tests','.agents','todo']){
    fs.mkdirSync(path.join(root,d),{recursive:true});
  }
  fs.writeFileSync(path.join(root,'artisan'),'<?php echo "artisan";\n');
  fs.writeFileSync(path.join(root,'composer.json'),JSON.stringify({require:{'laravel/framework':'^13'}},null,2)+'\n');
  fs.writeFileSync(path.join(root,'composer.lock'),'{}\n');
  fs.writeFileSync(path.join(root,'app/Http/Kernel.php'),'<?php class Kernel {}\n');
  fs.writeFileSync(path.join(root,'bootstrap/app.php'),'<?php return [];\n');
  fs.writeFileSync(path.join(root,'config/app.php'),'<?php return [];\n');
  fs.writeFileSync(path.join(root,'database/migrations/001.php'),'<?php // migration\n');
  fs.writeFileSync(path.join(root,'public/index.php'),'<?php echo "ok";\n');
  fs.writeFileSync(path.join(root,'public/build/app.js'),'console.log("built");\n');
  fs.writeFileSync(path.join(root,'resources/views/welcome.blade.php'),'<h1>Hi</h1>\n');
  fs.writeFileSync(path.join(root,'routes/web.php'),'<?php // routes\n');
  fs.writeFileSync(path.join(root,'docs/architecture.md'),'must never deploy\n');
  fs.writeFileSync(path.join(root,'tests/FeatureTest.php'),'must never deploy\n');
  fs.writeFileSync(path.join(root,'.agents/manifest.json'),'must never deploy\n');
  fs.writeFileSync(path.join(root,'TODO.md'),'must never deploy\n');
  fs.writeFileSync(path.join(root,'TODO_ARCHIVE.md'),'must never deploy\n');
  fs.writeFileSync(path.join(root,'todo/P01.md'),'must never deploy shard\n');
  fs.writeFileSync(path.join(root,'quality.contract.json'),'{}\n');
  fs.writeFileSync(path.join(root,'executionkit.integration.json'),'{}\n');
  fs.writeFileSync(path.join(root,'STANDARD_V4.md'),'must never deploy v4 standard\n');
  fs.writeFileSync(path.join(root,'.env'),'SECRET=must-never-deploy\n');
  const sharedDir=path.join(target,'shared-storage');fs.mkdirSync(sharedDir,{recursive:true});
  const sharedEnv=path.join(target,'shared.env');fs.writeFileSync(sharedEnv,'APP_ENV=production\n');
  const deployment={
    retention:{enabled:true,keepRollbacks:3,minimumAgeMinutes:0,cleanupLegacyReleases:false},enabled:true,requiredForRelease:true,artifactRoot:'.executionkit/deployment',requireCleanGit:true,
    extraInclude:[],extraExclude:[],buildCommands:[],preActivateCommands:[],postActivateCommands:[],
    smokeCommands:[{command:process.execPath,args:['-e','process.exit(0)'],cwd:'release'}],
    sharedLinks:[{releasePath:'.env',target:sharedEnv},{releasePath:'storage',target:sharedDir}],
    healthUrl:'data:text/plain,ok',healthTimeoutMs:1000,
    target:{type:'local-release-root',releaseRoot:path.join(target,'release-store'),currentLink:path.join(target,'current')}
  };
  fs.writeFileSync(path.join(root,'execution.config.json'),JSON.stringify({deployment},null,2)+'\n');
  git(root,['add','.']);git(root,['commit','-m','baseline']);
  return {root,target,deployment};
}
function vhostFixture(t,{type='apache',cwp=false}={}){
  const {root,target,deployment}=fixture(t),config=path.join(target,'domain.conf'),domain='client.example.com';
  const expected=path.join(deployment.target.currentLink,'public');
  const apache=()=>[80,443].map(port=>`<VirtualHost *:${port}>\nServerName ${domain}\nDocumentRoot "${expected}"\n</VirtualHost>\n`).join('');
  const nginx=()=>[80,443].map(port=>`server { listen ${port}; server_name ${domain}; root "${expected}"; }\n`).join('');
  fs.writeFileSync(config,type==='apache'?apache():nginx());
  const engine={type},policy={domains:[domain],engines:[engine],panel:cwp?'cwp':false};
  const loaded={standardVersion:'5.0.0-dev',deployment:{...deployment,vhost:policy,attestationUrl:'https://'+domain+'/.well-known/executionkit-release.json'}};
  const run=(_binary,args)=>({status:0,stdout:type==='nginx'?'# configuration file '+config+':\n'+fs.readFileSync(config,'utf8'):args.includes('DUMP_INCLUDES')?'Included configuration files:\n (*) '+config+'\n':`*:80 ${domain} (${config}:1)\n*:443 ${domain} (${config}:5)\n`,stderr:''});
  fs.writeFileSync(path.join(root,'execution.config.json'),JSON.stringify(loaded));
  return {root,target,config,domain,expected,loaded,policy,run};
}

test('Vhost Guard observes selected Apache HTTP and HTTPS roots and detects rebuilt drift',t=>{
  const f=vhostFixture(t);assert.equal(inspectVhostGuard(f.root,{run:f.run}).status,'PASS');
  fs.writeFileSync(f.config,fs.readFileSync(f.config,'utf8').replaceAll(f.expected,path.join(f.target,'public_html')));
  const bad=inspectVhostGuard(f.root,{run:f.run});assert.equal(bad.status,'BLOCKED');assert.ok(bad.findings.some(e=>e.code==='VHOST_DOCUMENT_ROOT_DRIFT'));assert.equal(bad.checks.length,2);
});

test('Vhost Guard refuses missing HTTPS, syntax failure and inactive Apache config',t=>{
  const f=vhostFixture(t);
  const missing=inspectVhostGuard(f.root,{run:(binary,args)=>args.includes('-S')?{status:0,stdout:`*:80 ${f.domain} (${f.config}:1)\n`}:f.run(binary,args)});
  assert.equal(missing.status,'BLOCKED');assert.ok(missing.findings.some(e=>e.code==='VHOST_HTTP_HTTPS_COVERAGE_REQUIRED'));
  assert.equal(inspectVhostGuard(f.root,{run:()=>({status:1,stderr:'invalid syntax'})}).status,'BLOCKED');
  const inactive=inspectVhostGuard(f.root,{run:(binary,args)=>args.includes('DUMP_INCLUDES')?{status:0,stdout:'Included configuration files:\n (*) /etc/unrelated.conf\n'}:f.run(binary,args)});
  assert.ok(inactive.findings.some(e=>e.code==='VHOST_APACHE_INACTIVE_FILE'));
});

test('Nginx effective dump guard parses selected nested roots and rejects unresolved includes',t=>{
  const f=vhostFixture(t,{type:'nginx'});assert.equal(inspectVhostGuard(f.root,{run:f.run}).status,'PASS');
  fs.writeFileSync(f.config,fs.readFileSync(f.config,'utf8').replace('root "'+f.expected+'";','root "'+f.expected+'"; location / { root /wrong/client; }'));
  assert.ok(inspectVhostGuard(f.root,{run:f.run}).findings.some(e=>e.code==='VHOST_DOCUMENT_ROOT_DRIFT'));
  fs.writeFileSync(f.config,`server { listen 80; listen 443; server_name ${f.domain}; root "${f.expected}"; include /unobserved/*.conf; }`);
  assert.ok(inspectVhostGuard(f.root,{run:f.run}).findings.some(e=>e.code==='VHOST_INCLUDE_UNVERIFIABLE'));
});

test('CWP guard pins custom tpl/stpl pair and verifies per-domain selection after rebuild',t=>{
  const f=vhostFixture(t,{cwp:true}),selection=path.join(f.target,'domain-selection.conf');
  const template={engine:'apache',name:'client_laravel',selectionKey:'owner_verified_template_key'};
  for(const [kind,ext] of [['http','.tpl'],['https','.stpl']]){
    const file=path.join(f.target,template.name+ext),body='DocumentRoot /home/%username%/current/public\n';fs.writeFileSync(file,body);
    template[kind]={path:file,sha256:crypto.createHash('sha256').update(body).digest('hex')};
  }
  f.policy.cwpBindings=[{domain:f.domain,selectionFile:selection,templates:[template]}];fs.writeFileSync(selection,'owner_verified_template_key=client_laravel\n');
  assert.equal(inspectVhostGuard(f.root,{config:f.loaded,run:f.run}).status,'PASS');
  fs.writeFileSync(selection,'owner_verified_template_key=default\n');assert.ok(inspectVhostGuard(f.root,{config:f.loaded,run:f.run}).findings.some(e=>e.code==='VHOST_CWP_CUSTOM_TEMPLATE_NOT_SELECTED'));
  fs.writeFileSync(selection,'owner_verified_template_key=client_laravel\n');fs.appendFileSync(template.http.path,'changed by update');assert.ok(inspectVhostGuard(f.root,{config:f.loaded,run:f.run}).findings.some(e=>e.code==='VHOST_CWP_TEMPLATE_DRIFT'));
});

test('native Laravel host-check cannot pass paths alone without vhost policy',t=>{
  const {root}=fixture(t),file=path.join(root,'execution.config.json'),loaded=JSON.parse(fs.readFileSync(file));loaded.standardVersion='5.0.0-dev';fs.writeFileSync(file,JSON.stringify(loaded));
  const value=productionDeploymentHostCheck(root);assert.equal(value.ok,false);assert.ok(value.errors.some(e=>e.code==='VHOST_POLICY_REQUIRED'));
});

test('Vhost Guard rejects ambiguous domain selection and hidden Apache routing',t=>{
  const f=vhostFixture(t);const original=f.run;
  assert.ok(inspectVhostGuard(f.root,{run:(binary,args)=>{const value=original(binary,args);return args.includes('-S')?{...value,stdout:value.stdout+value.stdout}:value;}}).findings.some(e=>e.code==='VHOST_AMBIGUOUS_DOMAIN_SELECTION'));
  fs.writeFileSync(f.config,fs.readFileSync(f.config,'utf8').replace('DocumentRoot','ProxyPass / http://unverified/\nDocumentRoot'));
  assert.ok(inspectVhostGuard(f.root,{run:f.run}).findings.some(e=>e.code==='VHOST_APACHE_ROUTING_UNVERIFIABLE'));
});
test('Nginx included root truth changes the fingerprint and cannot hide a script-root override',t=>{
  const f=vhostFixture(t,{type:'nginx'}),include=path.join(f.target,'php.conf');
  fs.writeFileSync(f.config,`server { listen 80; listen 443; server_name ${f.domain}; include ${include}; }`);
  let body=`root "${f.expected}";`;
  const run=()=>({status:0,stdout:`# configuration file ${f.config}:\n${fs.readFileSync(f.config,'utf8')}\n# configuration file ${include}:\n${body}\n`});
  const valid=inspectVhostGuard(f.root,{run});assert.equal(valid.status,'PASS');
  body+=` fastcgi_param SCRIPT_FILENAME /wrong/index.php;`;
  const invalid=inspectVhostGuard(f.root,{run});assert.notEqual(invalid.fingerprint,valid.fingerprint);assert.ok(invalid.findings.some(e=>e.code==='VHOST_SCRIPT_ROOT_UNVERIFIABLE'));
});
test('production artifact is allowlist-built and excludes docs kit tests controls and secrets',(t)=>{
  const {root}=fixture(t),plan=planProductionArtifact(root);
  assert.ok(plan.stacks.includes('laravel'));
  for(const required of ['artisan','composer.json','public/index.php'])assert.ok(plan.files.some((x)=>x.path===required),required);
  for(const forbidden of ['docs/architecture.md','tests/FeatureTest.php','.agents/manifest.json','TODO.md','todo/P01.md','quality.contract.json','executionkit.integration.json','STANDARD_V4.md','.env']){
    assert.equal(plan.files.some((x)=>x.path===forbidden),false,forbidden);
    assert.ok(plan.excluded.some((x)=>x.path===forbidden||(x.path.endsWith('/')&&forbidden.startsWith(x.path))),forbidden);
  }
  assert.equal(plan.policy.mode,'ALLOWLIST');
  assert.equal(plan.policy.docsExcluded,true);
  assert.equal(plan.policy.executionKitExcluded,true);
  assert.equal(plan.policy.secretsExcluded,true);
});
test('built production artifact validates against exact current source and detects tampering/staleness',(t)=>{
  const {root}=fixture(t),built=buildProductionArtifact(root);
  assert.equal(validateProductionArtifact(root,{releaseId:built.manifest.releaseId}).ok,true);
  const payload=path.join(built.artifactPath,'payload/public/index.php');
  fs.appendFileSync(payload,'// tamper\n');
  assert.ok(validateProductionArtifact(root,{releaseId:built.manifest.releaseId}).errors.some((e)=>e.code==='ARTIFACT_HASH_MISMATCH'));
  fs.rmSync(built.artifactPath,{recursive:true,force:true});
  const rebuilt=buildProductionArtifact(root);
  fs.appendFileSync(path.join(root,'routes/web.php'),'// source change\n');git(root,['add','.']);git(root,['commit','-m','source change']);
  assert.ok(validateProductionArtifact(root,{releaseId:rebuilt.manifest.releaseId}).errors.some((e)=>e.code==='ARTIFACT_STALE'));
});
test('deployment is explicitly authorized and activates staged release with shared production links',async(t)=>{
  const {root,deployment}=fixture(t),built=buildProductionArtifact(root);
  await assert.rejects(()=>deployProductionArtifact(root,{releaseId:built.manifest.releaseId}),/authorized=true/);
  const state=await deployProductionArtifact(root,{releaseId:built.manifest.releaseId,authorized:true});
  assert.equal(state.status,'DEPLOYED');
  assert.equal(fs.lstatSync(deployment.target.currentLink).isSymbolicLink(),true);
  const current=fs.realpathSync(deployment.target.currentLink);
  assert.equal(current,state.releaseDir);
  assert.equal(fs.lstatSync(path.join(current,'.env')).isSymbolicLink(),true);
  assert.equal(fs.lstatSync(path.join(current,'storage')).isSymbolicLink(),true);
  assert.equal(fs.existsSync(path.join(current,'docs')),false);
  assert.equal(fs.existsSync(path.join(current,'.agents')),false);
  assert.equal(productionDeploymentStatus(root).productionVerified,true);
});
test('v4 deployment cannot bypass exact-candidate release orchestration readiness',async(t)=>{
  const {root}=fixture(t);
  const cfg=JSON.parse(fs.readFileSync(path.join(root,'execution.config.json'),'utf8'));
  cfg.standardVersion='4.0.2';
  fs.writeFileSync(path.join(root,'execution.config.json'),JSON.stringify(cfg,null,2)+'\n');
  git(root,['add','.']);git(root,['commit','-m','enable v4 deployment contract']);

  const built=buildProductionArtifact(root);
  await assert.rejects(
    ()=>deployProductionArtifact(root,{releaseId:built.manifest.releaseId,authorized:true}),
    /requires current release orchestration readiness/
  );

  const readinessDir=path.join(root,'.executionkit','release');
  fs.mkdirSync(readinessDir,{recursive:true});
  fs.writeFileSync(path.join(readinessDir,'release-readiness.json'),JSON.stringify({
    schemaVersion:'executionkit-release-readiness/v1',
    status:'PASS',
    candidateId:'candidate-'+built.manifest.repository.head.slice(0,12),
    commit:built.manifest.repository.head,
    releaseId:built.manifest.releaseId
  },null,2)+'\n');

  await assert.rejects(()=>deployProductionArtifact(root,{releaseId:built.manifest.releaseId,authorized:true}),/VHOST_POLICY_REQUIRED/);
  assert.equal(productionDeploymentStatus(root).productionVerified,false);
});

test('second release can roll back atomically to recorded previous release',(t)=>{
  const {root,deployment}=fixture(t);
  const first=buildProductionArtifact(root);
  return deployProductionArtifact(root,{releaseId:first.manifest.releaseId,authorized:true}).then(async(firstState)=>{
    fs.writeFileSync(path.join(root,'public/index.php'),'<?php echo "v2";\n');git(root,['add','.']);git(root,['commit','-m','v2']);
    const second=buildProductionArtifact(root),secondState=await deployProductionArtifact(root,{releaseId:second.manifest.releaseId,authorized:true});
    assert.equal(secondState.previousReleaseDir,firstState.releaseDir);
    assert.equal(fs.realpathSync(deployment.target.currentLink),secondState.releaseDir);
    const rolled=await rollbackProductionDeployment(root,{authorized:true});
    assert.equal(rolled.status,'ROLLED_BACK');
    assert.equal(fs.realpathSync(deployment.target.currentLink),firstState.releaseDir);
  });
});
test('failed first post-activation command removes failed current link',(t)=>{
  const {root,deployment}=fixture(t),cfg=JSON.parse(fs.readFileSync(path.join(root,'execution.config.json'),'utf8'));
  cfg.deployment.postActivateCommands=[{command:process.execPath,args:['-e','process.exit(7)'],cwd:'release'}];
  fs.writeFileSync(path.join(root,'execution.config.json'),JSON.stringify(cfg,null,2)+'\n');git(root,['add','.']);git(root,['commit','-m','failing hook']);
  const built=buildProductionArtifact(root);
  return assert.rejects(()=>deployProductionArtifact(root,{releaseId:built.manifest.releaseId,authorized:true}),/post-activate command failed/).then(()=>{
    assert.equal(fs.lstatSync(deployment.target.currentLink,{throwIfNoEntry:false}),undefined);
  });
});
test('release readiness fails closed on unconfigured target, smoke or health',(t)=>{
  const {root}=fixture(t),cfg=JSON.parse(fs.readFileSync(path.join(root,'execution.config.json'),'utf8'));
  cfg.deployment.target={type:'UNCONFIGURED',releaseRoot:'',currentLink:''};
  cfg.deployment.smokeCommands=[];
  cfg.deployment.healthUrl='';
  fs.writeFileSync(path.join(root,'execution.config.json'),JSON.stringify(cfg,null,2)+'\n');git(root,['add','.']);git(root,['commit','-m','unconfigured']);
  const result=validateProductionDeploymentReadiness(root);
  assert.equal(result.ok,false);
  assert.ok(result.errors.some((e)=>e.code==='DEPLOYMENT_TARGET_UNCONFIGURED'));
  assert.ok(result.errors.some((e)=>e.code==='DEPLOYMENT_SMOKE_UNCONFIGURED'));
  assert.ok(result.errors.some((e)=>e.code==='DEPLOYMENT_HEALTH_UNCONFIGURED'));
});


test('strong secret content or control-plane files cannot enter production artifacts even through explicit include',(t)=>{
  const {root}=fixture(t);
  let cfg=JSON.parse(fs.readFileSync(path.join(root,'execution.config.json'),'utf8'));
  cfg.deployment.extraInclude=['execution.config.json','todo','quality.contract.json','executionkit.integration.json','STANDARD_V4.md'];
  fs.writeFileSync(path.join(root,'execution.config.json'),JSON.stringify(cfg,null,2)+'\n');
  git(root,['add','.']);git(root,['commit','-m','try control include']);
  const plan=planProductionArtifact(root);
  assert.equal(plan.files.some((x)=>x.path==='execution.config.json'),false);
  assert.ok(plan.excluded.some((x)=>x.path==='execution.config.json'&&x.reason==='executionkit_or_control_plane'));
  for(const rel of ['todo/P01.md','quality.contract.json','executionkit.integration.json','STANDARD_V4.md'])assert.equal(plan.files.some((x)=>x.path===rel),false,rel);

  fs.writeFileSync(path.join(root,'config/app.php'),"<?php $token='sk-"+'A'.repeat(40)+"';\n");
  git(root,['add','.']);git(root,['commit','-m','accidental secret']);
  assert.throws(()=>planProductionArtifact(root),/secret-like content detected in config\/app\.php/);
});


test('failed candidate reactivates and verifies the previous release after pointer rollback',async(t)=>{
  const {root,target,deployment}=fixture(t);
  const activationLog=path.join(target,'activation.log');
  let cfg=JSON.parse(fs.readFileSync(path.join(root,'execution.config.json'),'utf8'));
  cfg.deployment.postActivateCommands=[{
    command:process.execPath,
    args:['-e',"require('fs').appendFileSync(process.argv[1], process.argv[2]+'\\n')",activationLog,'{release}'],
    cwd:'project'
  }];
  cfg.deployment.smokeCommands=[{
    command:process.execPath,
    args:['-e',"const fs=require('fs');const body=fs.readFileSync(process.argv[1]+'/public/index.php','utf8');process.exit(body.includes('v2')?7:0)",'{release}'],
    cwd:'project'
  }];
  fs.writeFileSync(path.join(root,'execution.config.json'),JSON.stringify(cfg,null,2)+'\n');
  git(root,['add','.']);git(root,['commit','-m','activation-aware deployment']);

  const first=buildProductionArtifact(root);
  const firstState=await deployProductionArtifact(root,{releaseId:first.manifest.releaseId,authorized:true});

  fs.writeFileSync(path.join(root,'public/index.php'),'<?php echo "v2";\n');
  git(root,['add','.']);git(root,['commit','-m','v2 candidate']);
  const second=buildProductionArtifact(root);

  await assert.rejects(
    ()=>deployProductionArtifact(root,{releaseId:second.manifest.releaseId,authorized:true}),
    /production smoke command failed/
  );

  assert.equal(fs.realpathSync(deployment.target.currentLink),firstState.releaseDir);
  const activations=fs.readFileSync(activationLog,'utf8').trim().split(/\r?\n/);
  assert.deepEqual(activations.slice(-2),[
    path.join(deployment.target.releaseRoot,'releases',second.manifest.releaseId),
    firstState.releaseDir,
  ],'automatic rollback must reactivate the restored release after switching the pointer');
});

test('explicit rollback reactivates the previous release before smoke and health',async(t)=>{
  const {root,target,deployment}=fixture(t);
  const activationLog=path.join(target,'explicit-rollback-activation.log');
  const cfg=JSON.parse(fs.readFileSync(path.join(root,'execution.config.json'),'utf8'));
  cfg.deployment.postActivateCommands=[{
    command:process.execPath,
    args:['-e',"require('fs').appendFileSync(process.argv[1], process.argv[2]+'\\n')",activationLog,'{release}'],
    cwd:'project'
  }];
  fs.writeFileSync(path.join(root,'execution.config.json'),JSON.stringify(cfg,null,2)+'\n');
  git(root,['add','.']);git(root,['commit','-m','explicit rollback activation']);

  const first=buildProductionArtifact(root);
  const firstState=await deployProductionArtifact(root,{releaseId:first.manifest.releaseId,authorized:true});
  fs.writeFileSync(path.join(root,'public/index.php'),'<?php echo "v2";\n');
  git(root,['add','.']);git(root,['commit','-m','v2']);
  const second=buildProductionArtifact(root);
  await deployProductionArtifact(root,{releaseId:second.manifest.releaseId,authorized:true});

  const rolled=await rollbackProductionDeployment(root,{authorized:true});
  assert.equal(rolled.status,'ROLLED_BACK');
  assert.equal(fs.realpathSync(deployment.target.currentLink),firstState.releaseDir);
  const activations=fs.readFileSync(activationLog,'utf8').trim().split(/\r?\n/);
  assert.equal(activations.at(-1),firstState.releaseDir,'rollback must reactivate the restored release');
  assert.ok(Array.isArray(rolled.postActivate) && rolled.postActivate.length===1);
});

test('host isolation accepts a declared workspace and current pointer beside immutable releases',(t)=>{
  const {root,target}=fixture(t),cfg=JSON.parse(fs.readFileSync(path.join(root,'execution.config.json'),'utf8'));
  const productionRoot=path.join(target,'production');
  fs.mkdirSync(productionRoot,{recursive:true});
  cfg.deployment.workspace={mode:'PROJECT_ROOT',allowedRoots:[path.dirname(root)],requireOutsideProduction:true};
  cfg.deployment.privilege={model:'UNPRIVILEGED_AFTER_BOOTSTRAP',sudoDuringDeploy:false,requireWritableTarget:true,deploymentUser:'deploy-test'};
  cfg.deployment.target={type:'local-release-root',releaseRoot:productionRoot,currentLink:path.join(productionRoot,'current')};
  fs.writeFileSync(path.join(root,'execution.config.json'),JSON.stringify(cfg,null,2)+'\n');
  const plan=productionDeploymentHostPlan(root),check=productionDeploymentHostCheck(root);
  assert.equal(plan.policy.buildInProductionRoot,false);
  assert.equal(plan.policy.gitPullInProductionRoot,false);
  assert.equal(check.ok,true,JSON.stringify(check.errors));
});

test('host isolation blocks source outside declared execution workspace',(t)=>{
  const {root,target}=fixture(t),cfg=JSON.parse(fs.readFileSync(path.join(root,'execution.config.json'),'utf8'));
  cfg.deployment.workspace={mode:'PROJECT_ROOT',allowedRoots:[path.join(target,'different-workspace')],requireOutsideProduction:true};
  cfg.deployment.privilege={model:'UNPRIVILEGED_AFTER_BOOTSTRAP',sudoDuringDeploy:false,requireWritableTarget:true};
  fs.writeFileSync(path.join(root,'execution.config.json'),JSON.stringify(cfg,null,2)+'\n');
  const check=productionDeploymentHostCheck(root);
  assert.equal(check.ok,false);
  assert.ok(check.errors.some((e)=>e.code==='DEPLOYMENT_WORKSPACE_OUTSIDE_ALLOWED_ROOT'));
});

test('deployment readiness forbids sudo in normal release transactions',(t)=>{
  const {root}=fixture(t),cfg=JSON.parse(fs.readFileSync(path.join(root,'execution.config.json'),'utf8'));
  cfg.deployment.privilege={model:'UNPRIVILEGED_AFTER_BOOTSTRAP',sudoDuringDeploy:true,requireWritableTarget:true};
  fs.writeFileSync(path.join(root,'execution.config.json'),JSON.stringify(cfg,null,2)+'\n');
  git(root,['add','.']);git(root,['commit','-m','forbidden deploy sudo']);
  buildProductionArtifact(root);
  const ready=validateProductionDeploymentReadiness(root);
  assert.equal(ready.ok,false);
  assert.ok(ready.errors.some((e)=>e.code==='DEPLOYMENT_SUDO_DURING_DEPLOY_FORBIDDEN'));
});

test('non-deployable distribution repository release returns RELEASE_READY_NON_DEPLOYABLE', (t) => {
  const { root } = fixture(t);
  
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'execution.config.json'), 'utf8'));
  cfg.distributionRepository = true;
  cfg.deployment.enabled = false;
  cfg.projectState = 'ACTIVE';
  fs.writeFileSync(path.join(root, 'execution.config.json'), JSON.stringify(cfg, null, 2) + '\n');
  fs.mkdirSync(path.join(root, '.executionkit'), { recursive: true });
  fs.writeFileSync(path.join(root, '.executionkit', 'tasks.json'), JSON.stringify({schemaVersion:"executionkit-tasks/v1",tasks:[]}));
  git(root, ['add', '.']); git(root, ['commit', '-m', 'distribution config']);

  const origRelease = fs.readFileSync(path.resolve('bin/release-project.mjs'), 'utf8');
  const modifiedRelease = origRelease.replace(
    `import {spawnBoundedSync} from '../lib/bounded-process.mjs';`,
    `import {spawnBoundedSync as _spawnBoundedSync} from '../lib/bounded-process.mjs';
const spawnBoundedSync = function(cmd, args, opts) {
  if (Array.isArray(args) && args.some(a => typeof a === 'string' && a.replaceAll(String.fromCharCode(92), '/').includes('bin/'))) {
    return { status: 0, stdout: '', stderr: '', error: null };
  }
  return _spawnBoundedSync.apply(this, arguments);
};`
  );
  
  // Keep generated test code out of the shared distribution: parallel installer
  // inventory and exact-source SEA tests must see immutable source bytes.
  const tempRelease = path.join(root, '.executionkit', 'release-project-mock.mjs');
  const moduleUrl = pathToFileURL(path.resolve('bin/release-project.mjs'));
  fs.writeFileSync(tempRelease, modifiedRelease.replace(/from '(\.\.\/lib\/[^']+)'/g, (_, rel) => `from '${new URL(rel, moduleUrl).href}'`));
  t.after(() => fs.rmSync(tempRelease, { force: true }));
  
  const result = spawnSync(process.execPath, [tempRelease, root], {cwd: root, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  
  const payload = JSON.parse(result.stdout.trim());
// 
  // 
  assert.equal(payload.status, 'RELEASE_READY_NON_DEPLOYABLE');
  assert.equal(payload.distributionRepository, true);
  assert.equal(payload.releaseId, null);
});

test('non-deployable distribution rejects launch deploy --authorize', (t) => {
  const { root } = fixture(t);
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'execution.config.json'), 'utf8'));
  cfg.distributionRepository = true;
  cfg.deployment.enabled = false;
  cfg.projectState = 'ACTIVE';
  fs.writeFileSync(path.join(root, 'execution.config.json'), JSON.stringify(cfg, null, 2) + '\n');
  git(root, ['add', '.']); git(root, ['commit', '-m', 'make non-deployable distribution']);
  
  const result = spawnSync(process.execPath, [path.resolve('bin/release-project.mjs'), root, '--authorize'], {cwd: root, encoding: 'utf8'});
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes('Production deployment is disabled for this repository; release certification/publication is non-deploying.'));
});

test('host-plan for non-deployable repository reports unconfigured target without error', (t) => {
  const { root } = fixture(t);
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'execution.config.json'), 'utf8'));
  cfg.distributionRepository = true;
  cfg.deployment.enabled = false;
  cfg.deployment.target = { type: 'UNCONFIGURED' };
  fs.writeFileSync(path.join(root, 'execution.config.json'), JSON.stringify(cfg, null, 2) + '\n');
  
  const plan = productionDeploymentHostPlan(root);
  assert.equal(plan.status, 'PLANNED');
  assert.equal(plan.target, null);
  assert.ok(plan.requirements.some(r => r.code === 'DEPLOYMENT_TARGET_UNCONFIGURED'));
});

test('host-check for non-deployable repository reports unconfigured target', (t) => {
  const { root } = fixture(t);
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'execution.config.json'), 'utf8'));
  cfg.distributionRepository = true;
  cfg.deployment.enabled = false;
  cfg.deployment.target = { type: 'UNCONFIGURED' };
  fs.writeFileSync(path.join(root, 'execution.config.json'), JSON.stringify(cfg, null, 2) + '\n');
  
  const check = productionDeploymentHostCheck(root);
  assert.equal(check.ok, false);
  assert.equal(check.status, 'NEEDS_PROVISIONING');
  assert.ok(check.errors.some(e => e.code === 'DEPLOYMENT_TARGET_UNCONFIGURED'));
});

test('deployment privilege model UNPRIVILEGED_AFTER_BOOTSTRAP is enforced', (t) => {
  const { root } = fixture(t);
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'execution.config.json'), 'utf8'));
  cfg.deployment.privilege = { model: 'UNPRIVILEGED_AFTER_BOOTSTRAP', sudoDuringDeploy: true };
  fs.writeFileSync(path.join(root, 'execution.config.json'), JSON.stringify(cfg, null, 2) + '\n');
  
  const check = productionDeploymentHostCheck(root);
  assert.equal(check.ok, false);
  assert.ok(check.errors.some(e => e.code === 'DEPLOYMENT_SUDO_DURING_DEPLOY_FORBIDDEN'));
});

test('deployment target inside source repository is rejected', (t) => {
  const { root } = fixture(t);
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'execution.config.json'), 'utf8'));
  cfg.deployment.target.releaseRoot = path.join(root, 'release-store');
  fs.writeFileSync(path.join(root, 'execution.config.json'), JSON.stringify(cfg, null, 2) + '\n');
  
  const check = productionDeploymentHostCheck(root);
  assert.equal(check.ok, false);
  assert.ok(check.errors.some(e => e.code === 'DEPLOYMENT_TARGET_INSIDE_SOURCE'));
});

test('production deployment refuses without smoke commands', async (t) => {
  const { root } = fixture(t);
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'execution.config.json'), 'utf8'));
  cfg.deployment.smokeCommands = [];
  fs.writeFileSync(path.join(root, 'execution.config.json'), JSON.stringify(cfg, null, 2) + '\n');
  
  await assert.rejects(() => deployProductionArtifact(root, { releaseId: 'foo', authorized: true }), /smoke command/);
});

test('production deployment refuses without health URL', async (t) => {
  const { root } = fixture(t);
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'execution.config.json'), 'utf8'));
  cfg.deployment.healthUrl = '';
  fs.writeFileSync(path.join(root, 'execution.config.json'), JSON.stringify(cfg, null, 2) + '\n');
  
  await assert.rejects(() => deployProductionArtifact(root, { releaseId: 'foo', authorized: true }), /deployment\.healthUrl/);
});


async function deployNext(root, version) {
  fs.writeFileSync(path.join(root, 'public/index.php'), `<?php echo "version-${version}";\n`);
  git(root, ['add', '.']); git(root, ['commit', '-m', `version-${version}`]);
  const artifact = buildProductionArtifact(root);
  return deployProductionArtifact(root, { releaseId: artifact.manifest.releaseId, authorized: true });
}
function setRetention(root, retention) {
  const file = path.join(root, 'execution.config.json'), config = JSON.parse(fs.readFileSync(file));
  config.deployment.retention = {cleanupLegacyReleases:false,...retention};
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
  git(root, ['add', '.']); git(root, ['commit', '-m', 'retention policy']);
  return config.deployment;
}

test('retention automatically keeps current plus three successful rollbacks and shared bytes', async(t) => {
  const { root } = fixture(t);
  const cfg = setRetention(root, { enabled: true, keepRollbacks: 3, minimumAgeMinutes: 0 });
  const states = [];
  for (let version = 1; version <= 6; version++) states.push(await deployNext(root, version));
  const last = states.at(-1);
  assert.ok(['PASS','DEFERRED'].includes(last.retention.status));
  if(last.retention.status==='DEFERRED') assert.ok(last.retention.skipped.length>0,'deferred release cleanup must disclose skipped reasons');
  assert.equal(last.retention.kept.length, 4);
  // Restricted containers can hide same-user /proc entries; verify the deletion
  // transaction separately with an explicit completed-worker observation.
  retainSuccessfulReleases(cfg, last, { busy: () => false });
  assert.equal(fs.readdirSync(path.join(cfg.target.releaseRoot, 'releases')).length, 4);
  assert.equal(fs.existsSync(states[0].releaseDir), false);
  assert.equal(fs.existsSync(states[1].releaseDir), false);
  for (const state of states.slice(2)) assert.equal(fs.existsSync(state.releaseDir), true);
  assert.equal(fs.readFileSync(cfg.sharedLinks[0].target, 'utf8'), 'APP_ENV=production\n');
  assert.equal((await rollbackProductionDeployment(root, { authorized: true })).releaseDir, states[4].releaseDir);
  assert.equal(productionDeploymentStatus(root).retentionHealthy,last.retention.status==='PASS');
});

test('retention preserves unknown historical releases staging and directory symlinks', async(t) => {
  const { root, target } = fixture(t);
  const cfg = setRetention(root, { enabled: true, keepRollbacks: 1, minimumAgeMinutes: 0 });
  const releases = path.join(cfg.target.releaseRoot, 'releases');
  fs.mkdirSync(path.join(releases, 'historic-release'), { recursive: true });
  fs.mkdirSync(path.join(releases, 'candidate.tmp-123'), { recursive: true });
  fs.symlinkSync(target, path.join(releases, 'external-directory'), 'dir');
  for (let version = 1; version <= 4; version++) await deployNext(root, version);
  for (const name of ['historic-release', 'candidate.tmp-123', 'external-directory']) assert.ok(fs.lstatSync(path.join(releases, name)));
});

test('retention supports project overrides disabled policy and age grace', async(t) => {
  const { root } = fixture(t);
  setRetention(root, { enabled: false, keepRollbacks: 1, minimumAgeMinutes: 0 });
  const first = await deployNext(root, 1);
  assert.equal(first.retention.status, 'DISABLED');
  const cfg = setRetention(root, { enabled: true, keepRollbacks: 1, minimumAgeMinutes: 10 });
  const second = await deployNext(root, 2);
  await deployNext(root, 3);
  const fourth = await deployNext(root, 4);
  assert.equal(fs.existsSync(second.releaseDir), true);
  assert.ok(fourth.retention.skipped.some(item => item.reason === 'MINIMUM_RELEASE_AGE'));
  assert.equal(fourth.retention.status,'DEFERRED','pending cleanup must not return PASS');
  const aged = retainSuccessfulReleases(cfg, fourth, { now: Date.now() + 11 * 60000, busy: () => false });
  assert.ok(aged.removed.includes(second.releaseDir));
  assert.ok(fs.existsSync(first.releaseDir)); // untracked while policy was disabled
});

test('retention rejects unsafe or failed receipts and preserves running workers', async(t) => {
  const { root } = fixture(t);
  const cfg = setRetention(root, { enabled: true, keepRollbacks: 1, minimumAgeMinutes: 10 });
  const first = await deployNext(root, 1);
  await deployNext(root, 2);
  const third = await deployNext(root, 3);
  assert.throws(() => retainSuccessfulReleases(cfg, { ...third, health: { ok: false } }), /successful deployment/);
  assert.throws(() => retainSuccessfulReleases(cfg, { ...third, smoke: [] }), /smoke command/);
  assert.throws(() => retainSuccessfulReleases(cfg, { ...third, releaseDir: path.dirname(third.releaseDir) }), /direct child/);
  const cleanup = retainSuccessfulReleases(cfg, third, { now: Date.now() + 11 * 60000, busy: () => true });
  assert.equal(cleanup.removed.length, 0);
  assert.ok(cleanup.skipped.some(item => item.reason === 'WORKER_RUNNING_OR_VISIBILITY_UNPROVEN'));
  assert.ok(fs.existsSync(first.releaseDir));
});

test('retention refuses deletion of unshared persistent state or a symlinked registered release', async(t) => {
  const { root, target } = fixture(t);
  const cfg = setRetention(root, { enabled: true, keepRollbacks: 1, minimumAgeMinutes: 10 });
  const first = await deployNext(root, 1);
  await deployNext(root, 2);
  const third = await deployNext(root, 3);
  try { fs.unlinkSync(path.join(first.releaseDir, 'storage')); } catch { fs.rmdirSync(path.join(first.releaseDir, 'storage')); }
  fs.mkdirSync(path.join(first.releaseDir, 'storage'));
  fs.writeFileSync(path.join(first.releaseDir, 'storage', 'upload'), 'keep me');
  assert.throws(() => retainSuccessfulReleases(cfg, third, { now: Date.now() + 11 * 60000, busy: () => false }), /persistent storage/);
  assert.equal(fs.readFileSync(path.join(first.releaseDir, 'storage', 'upload'), 'utf8'), 'keep me');
  fs.rmSync(first.releaseDir, { recursive: true });
  fs.symlinkSync(target, first.releaseDir, 'dir');
  assert.throws(() => retainSuccessfulReleases(cfg, third), /real directory/);
  assert.ok(fs.existsSync(target));
});

test('retention corruption reports failure without undoing a healthy deployment', async(t) => {
  const { root } = fixture(t);
  const first = await deployNext(root, 1);
  const registry = path.join(first.target.releaseRoot, '.executionkit-release-retention.json');
  fs.writeFileSync(registry, '{broken');
  const second = await deployNext(root, 2);
  assert.equal(second.status, 'DEPLOYED');
  assert.equal(second.retention.status, 'FAILED');
  assert.equal(productionDeploymentStatus(root).retentionHealthy, false);
  assert.equal(fs.realpathSync(second.target.currentLink), second.releaseDir);
  assert.equal(fs.existsSync(first.releaseDir), true);
});

test('retention failed activation cannot prune previously successful releases', async(t) => {
  const { root } = fixture(t);
  setRetention(root, { enabled: true, keepRollbacks: 1, minimumAgeMinutes: 0 });
  const first = await deployNext(root, 1);
  const registry = path.join(first.target.releaseRoot, '.executionkit-release-retention.json');
  const before = fs.readFileSync(registry, 'utf8');
  const file = path.join(root, 'execution.config.json'), cfg = JSON.parse(fs.readFileSync(file));
  cfg.deployment.healthUrl = 'data:text/plain,ok';
  cfg.deployment.smokeCommands = [{ command: process.execPath, args: ['-e', 'process.exit(8)'] }];
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  await assert.rejects(() => deployNext(root, 2), /smoke command failed/);
  assert.equal(fs.readFileSync(registry, 'utf8'), before);
  assert.equal(fs.realpathSync(first.target.currentLink), first.releaseDir);
});

test('retention serializes deployment rollback and refuses immutable release overwrite', async(t) => {
  const { root } = fixture(t);
  const first = await deployNext(root, 1);
  const unlock = acquireDeploymentLock(first.target.releaseRoot);
  await assert.rejects(() => deployProductionArtifact(root, { authorized: true }), /EEXIST/);
  await assert.rejects(() => rollbackProductionDeployment(root, { authorized: true }), /EEXIST/);
  unlock();
  await assert.rejects(() => deployProductionArtifact(root, { authorized: true }), /already exists/);
  assert.equal(fs.realpathSync(first.target.currentLink), first.releaseDir);
  assert.equal(fs.lstatSync(path.join(first.target.releaseRoot, '.executionkit-deployment.lock'), { throwIfNoEntry: false }), undefined);
});

test('retention validates policy before activation and readiness exposes invalid settings', async(t) => {
  const { root } = fixture(t);
  setRetention(root, { enabled: true, keepRollbacks: -1, minimumAgeMinutes: 0 });
  buildProductionArtifact(root);
  assert.ok(validateProductionDeploymentReadiness(root).errors.some(item => item.code === 'DEPLOYMENT_RETENTION_INVALID'));
  await assert.rejects(() => deployProductionArtifact(root, { authorized: true }), /Invalid deployment.retention/);
});

test('retention Linux worker inspection recognizes release cwd and ignores vanished processes', (t) => {
  if (process.platform !== 'linux') return;
  const { root, target } = fixture(t), proc = path.join(root, 'proc');
  fs.mkdirSync(path.join(proc, '12'), { recursive: true });
  fs.mkdirSync(path.join(proc, '13'), { recursive: true });
  fs.symlinkSync(target, path.join(proc, '12', 'cwd'));
  assert.equal(processUsesRelease(target, proc), true);
  fs.unlinkSync(path.join(proc, '12', 'cwd'));
  fs.symlinkSync(root, path.join(proc, '12', 'cwd'));
  fs.symlinkSync(process.execPath, path.join(proc, '12', 'exe'));
  assert.equal(processUsesRelease(target, proc), false);
});

test('retention current-only removes previous after healthy activation and preserves failure rollback', async t => {
  const {root}=fixture(t),cfg=setRetention(root,{enabled:true,keepRollbacks:0,minimumAgeMinutes:0});
  const first=await deployNext(root,1);
  const file=path.join(root,'execution.config.json'),config=JSON.parse(fs.readFileSync(file));
  config.deployment.postActivateCommands=[{command:process.execPath,args:['-e',"if(require('fs').readFileSync('public/index.php','utf8').includes('version-2'))process.exit(1)"],cwd:'release'}];
  fs.writeFileSync(file,JSON.stringify(config));
  await assert.rejects(()=>deployNext(root,2),/post-activate command failed/);
  assert.equal(fs.realpathSync(cfg.target.currentLink),first.releaseDir);assert.ok(fs.existsSync(first.releaseDir));
  config.deployment.postActivateCommands=[];fs.writeFileSync(file,JSON.stringify(config));
  const current=await deployNext(root,3);retainSuccessfulReleases(cfg,current,{busy:()=>false,retirementCheck:()=>({ok:true,status:'PASS'})});
  assert.equal(fs.existsSync(first.releaseDir),false);assert.equal(productionDeploymentStatus(root).rollbackAvailable,false);
  await assert.rejects(()=>rollbackProductionDeployment(root,{authorized:true}),/no longer exists/);
});

test('retention recognizes old Laravel code releases but protects unknown or private uploads', async t => {
  const {root}=fixture(t),cfg=setRetention(root,{enabled:true,keepRollbacks:0,minimumAgeMinutes:0,cleanupLegacyReleases:true});
  const current=await deployNext(root,1),releases=path.dirname(current.releaseDir);
  const disposable=path.join(releases,'20261001120000-deadbee'),privateData=path.join(releases,'20261001130000-deadbad');
  fs.cpSync(current.releaseDir,disposable,{recursive:true,dereference:false});fs.cpSync(current.releaseDir,privateData,{recursive:true,dereference:false});
  fs.mkdirSync(path.join(privateData,'public/uploads'),{recursive:true});fs.writeFileSync(path.join(privateData,'public/uploads/customer.jpg'),'preserve');
  const unknown=path.join(releases,'owner-backups');fs.mkdirSync(unknown);fs.writeFileSync(path.join(unknown,'backup.sql'),'preserve');
  const result=retainSuccessfulReleases(cfg,current,{busy:()=>false,retirementCheck:()=>({ok:true,status:'PASS'})});
  assert.ok(result.legacyRecognized.includes(disposable));assert.ok(result.removed.includes(disposable));
  assert.ok(result.legacyPreserved.some(item=>item.release===privateData&&item.reason==='UNOWNED_PERSISTENT_TREE'));
  assert.equal(fs.readFileSync(path.join(privateData,'public/uploads/customer.jpg'),'utf8'),'preserve');assert.ok(fs.existsSync(unknown));
  assert.equal(fs.readFileSync(cfg.sharedLinks[0].target,'utf8'),'APP_ENV=production\n');
});

test('retention rechecks legacy persistent state after an in-use candidate was registered', async t => {
  const {root}=fixture(t),cfg=setRetention(root,{enabled:true,keepRollbacks:0,minimumAgeMinutes:0,cleanupLegacyReleases:true});
  const current=await deployNext(root,1),legacy=path.join(path.dirname(current.releaseDir),'20261001120000-deadcab');
  fs.cpSync(current.releaseDir,legacy,{recursive:true,dereference:false});
  const deferred=retainSuccessfulReleases(cfg,current,{busy:()=>true,retirementCheck:()=>({ok:true,status:'PASS'})});assert.ok(deferred.legacyRecognized.includes(legacy));
  try { fs.unlinkSync(path.join(legacy,'storage')); } catch { fs.rmdirSync(path.join(legacy,'storage')); }
  fs.mkdirSync(path.join(legacy,'storage'));fs.writeFileSync(path.join(legacy,'storage','private.txt'),'preserve');
  const result=retainSuccessfulReleases(cfg,current,{busy:()=>false,retirementCheck:()=>({ok:true,status:'PASS'})});assert.ok(result.skipped.some(item=>item.release===legacy&&item.reason==='UNSHARED_PERSISTENT_STATE'));assert.ok(fs.existsSync(path.join(legacy,'storage/private.txt')));
});

test('retention worker inspection fails closed for unreadable runtime owners and checks argv references', t => {
  if(process.platform!=='linux')return;
  const {root,target}=fixture(t),proc=path.join(root,'opaque-proc'),pid=path.join(proc,'12');fs.mkdirSync(pid,{recursive:true});
  const otherUid=process.getuid()+1,readlink=fs.readlinkSync,stat=fs.statSync;
  t.mock.method(fs,'statSync',function(file,...args){const actual=stat.call(fs,file,...args);if(String(file)===pid)actual.uid=otherUid;return actual;});
  t.mock.method(fs,'readlinkSync',function(file,...args){if(String(file).startsWith(pid+path.sep)){const error=new Error('access denied');error.code='EACCES';throw error;}return readlink.call(fs,file,...args);});
  assert.equal(processUsesRelease(target,proc),true);assert.equal(processUsesRelease(target,proc,{workerUids:[otherUid]}),true);assert.equal(processUsesRelease(target,proc,{workerUids:[process.getuid()]}),false);
  fs.writeFileSync(path.join(pid,'cmdline'),`php\0${target}/artisan\0queue:work\0`);assert.equal(processUsesRelease(target,proc,{workerUids:[otherUid]}),true);
});

test('retention current-only defers deletion without proof that loaded runtime workers retired',async t=>{
 const {root}=fixture(t),cfg=setRetention(root,{enabled:true,keepRollbacks:0,minimumAgeMinutes:0});const first=await deployNext(root,1),current=await deployNext(root,2);
 const result=retainSuccessfulReleases(cfg,current,{busy:()=>false});assert.equal(result.status,'DEFERRED');assert.equal(result.currentOnlySatisfied,false);assert.ok(result.skipped.some(item=>item.reason==='WORKER_RETIREMENT_UNVERIFIED'));assert.ok(fs.existsSync(first.releaseDir));
});

test('retention runtime retirement checks start time even when PHP FPM cwd and argv omit the release',async t=>{
 if(process.platform!=='linux')return;
 const {verifyWorkerRetirement,captureWorkerRetirementBarrier}=await import('../lib/production-worker-retirement.mjs'),{root}=fixture(t),proc=path.join(root,'runtime-proc'),pid=path.join(proc,'900000');fs.mkdirSync(pid,{recursive:true});
 fs.writeFileSync(path.join(proc,'uptime'),'2.00 1.00\n');const captured=captureWorkerRetirementBarrier({keepRollbacks:0,workerUsers:[os.userInfo().username]},{procRoot:proc,tickRate:100});assert.equal(captured.status,'PASS');assert.ok(captured.barrierTicks>200);assert.equal(captureWorkerRetirementBarrier({keepRollbacks:0,workerUsers:[]}).status,'UNVERIFIED');
 const barrier={status:'PASS',workerUids:[process.getuid()],barrierTicks:200};fs.writeFileSync(path.join(pid,'cmdline'),'php-fpm: pool example\0');
 function stat(start){const fields=Array(20).fill('0');fields[0]='S';fields[19]=String(start);fs.writeFileSync(path.join(pid,'stat'),'900000 (php-fpm worker) '+fields.join(' '));}
 stat(100);assert.equal(verifyWorkerRetirement(barrier,{procRoot:proc}).reason,'PREACTIVATION_RUNTIME_WORKER_PRESENT');
 stat(250);assert.equal(verifyWorkerRetirement(barrier,{procRoot:proc}).ok,true);
 assert.equal(verifyWorkerRetirement(null,{procRoot:proc}).ok,false);
});

test('v5 deployment policy defaults to one safe rollback and enabled cleanup',async()=>{
 const {DEFAULT_DEPLOYMENT_CONFIG}=await import('../lib/production-deployment.mjs');
 assert.equal(DEFAULT_DEPLOYMENT_CONFIG.retention.keepRollbacks,1);
 assert.equal(DEFAULT_DEPLOYMENT_CONFIG.retention.artifactKeepRollbacks,0);
 assert.equal(DEFAULT_DEPLOYMENT_CONFIG.retention.enabled,true);
 assert.equal(DEFAULT_DEPLOYMENT_CONFIG.retention.cleanupLegacyReleases,true);
});


test('status refuses to certify live release polluted by raw agent/git files',async t=>{
 const {root}=fixture(t),state=await deployNext(root,1);
 const before=productionDeploymentStatus(root);
 assert.equal(before.productionPurityVerified,true);
 const agentFile=path.join(state.releaseDir,'.agents/manifest.json');
 fs.mkdirSync(path.dirname(agentFile),{recursive:true});
 fs.writeFileSync(agentFile,'{"mustNotBeInProduction":true}');
 const report=productionDeploymentStatus(root);
 assert.equal(report.productionPurityVerified,false);
 assert.ok(report.productionPollution.includes('.agents'));
 assert.equal(report.productionVerified,false);
 assert.equal(fs.existsSync(agentFile),true,'status must never delete owner/unknown files');
});
test('read-only launch storage report shows retained current, previous and producer footprint with bounded traversal',async t=>{
 const {root,deployment}=fixture(t);
 const {inspectProductionStorage}=await import('../lib/production-storage-report.mjs');
 const first=await deployNext(root,1),second=await deployNext(root,2);
 const before=fs.readdirSync(path.join(deployment.target.releaseRoot,'releases')).sort();
 const report=inspectProductionStorage(root);
 assert.equal(report.readOnly,true);
 assert.equal(report.complete,true);
 assert.ok(report.totals.measuredBytes>0);
 assert.equal(report.releases.count,2);
 assert.ok(report.releases.largest.some(x=>x.role==='CURRENT'&&x.id===second.releaseId));
 assert.ok(report.releases.largest.some(x=>x.role==='ROLLBACK'&&x.id===first.releaseId));
 assert.equal(report.backups.status,'OPERATOR_MANAGED_NOT_AUTODELETED');
 const bounded=inspectProductionStorage(root,{maxEntries:1});
 assert.equal(bounded.complete,false);
 assert.ok(bounded.warnings.includes('BOUNDED_SCAN_INCOMPLETE'));
 assert.deepEqual(fs.readdirSync(path.join(deployment.target.releaseRoot,'releases')).sort(),before);
});

test('producer cache prunes previous copy while live rollback release stays intact',async t=>{
 const {root}=fixture(t);
 setRetention(root,{enabled:true,keepRollbacks:1,artifactKeepRollbacks:1,minimumAgeMinutes:0});
 const first=await deployNext(root,1),second=await deployNext(root,2);
 const {retainProductionArtifactCache}=await import('../lib/production-artifact-retention.mjs');
 const cacheBase=path.join(root,'.executionkit/deployment/artifacts');
 assert.equal(fs.existsSync(path.join(cacheBase,first.releaseId)),true);
 const policy={enabled:true,keepRollbacks:1,artifactKeepRollbacks:0,minimumAgeMinutes:0};
 const result=retainProductionArtifactCache(cacheBase,second,policy);
 assert.ok(result.removed.includes(first.releaseId));
 assert.ok(fs.existsSync(second.releaseDir));
 assert.ok(fs.existsSync(first.releaseDir),'the live rollback stays available even if its producer artifact is pruned');
 assert.equal(fs.existsSync(path.join(cacheBase,first.releaseId)),false);
 setRetention(root,policy);
 const third=await deployNext(root,3);
 assert.ok(third.artifactRetention.removed.includes(second.releaseId));
 assert.ok(fs.existsSync(second.releaseDir),'deploy-time producer cache pruning preserves live rollback release');
 assert.equal(fs.existsSync(path.join(cacheBase,second.releaseId)),false);
});

test('v5 retention template and strict schema support independent producer-cache policy',async()=>{
 const {default:fs}=await import('node:fs');
 const {default:path}=await import('node:path');
 const template=JSON.parse(fs.readFileSync(path.resolve('templates/execution.config.v5.json'),'utf8'));
 const schema=JSON.parse(fs.readFileSync(path.resolve('schemas/execution-config-v5.schema.json'),'utf8'));
 const actual=template.deployment.retention,policy=schema.properties.deployment.properties.retention;
 assert.equal(actual.keepRollbacks,1);
 assert.equal(actual.artifactKeepRollbacks,0);
 assert.equal(policy.properties.keepRollbacks.default,1);
 assert.equal(policy.properties.artifactKeepRollbacks.default,0);
 assert.equal(policy.additionalProperties,false);
});


test('Launch read-only disk report reveals forbidden .agents and Kit runtime leaked into active production',async t=>{
 const {root}=fixture(t),state=await deployNext(root,1);
 const {inspectProductionStorage}=await import('../lib/production-storage-report.mjs');
 for(const pathName of ['.agents/manifest.json','.executionkit/runtime/kit/docs/obsolete.md']){
   const dest=path.join(state.releaseDir,pathName);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,'not production runtime');
 }
 const result=inspectProductionStorage(root);
 assert.equal(result.status,'REVIEW');
 assert.ok(result.warnings.includes('PRODUCTION_DEV_TREE_DETECTED'));
 assert.deepEqual(result.productionPollution.paths.sort(),['.agents','.executionkit'].sort());
 assert.equal(fs.readFileSync(path.join(state.releaseDir,'.agents/manifest.json'),'utf8'),'not production runtime');
});
