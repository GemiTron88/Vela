import {createHash,createHmac,createPrivateKey,randomUUID,sign} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,cpSync,existsSync,realpathSync,statSync,lstatSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {requireNativeWorkstation,nativeHostObservation,readWorkstationPolicy} from './native-host-policy.mjs';
import {spawnPortableSync} from './portable-process.mjs';
import {inspectApk,resolveAndroidSdkTool,sdkToolEnvironment} from './launch-service/src/apk.mjs';
import {inspectBundle} from './launch-service/src/bundle.mjs';

const schema='executionkit-launch-mobile/v1';
const sha=/^[a-f0-9]{40}$/;
const sha256Re=/^[a-f0-9]{64}$/;
const slug=/^[a-z][a-z0-9-]{0,63}$/;
const flutterSemverRe=/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
export const MOBILE_LIFECYCLE_STATES=Object.freeze(['BUILT','INSPECTED','HANDOFF_READY','IMPORTED','RELEASE_READY','PUBLISHED']);
export const MOBILE_MANDATORY_TEST_GATES=Object.freeze(['analyze','unit','widget']);
const ALLOWED_CONFIG_KEYS=new Set(['projectId','repository','schemaVersion','serviceOrigin','flutterPath','packageId','flutterVersion','mobileUpdateStrategy','shorebird','signing']);
const REQUIRED_CONFIG_KEYS=['projectId','repository','schemaVersion','serviceOrigin'];
function check(ok,code){if(!ok)throw Error(code);}
function fileSha256(filePath){return createHash('sha256').update(readFileSync(filePath)).digest('hex');}
function git(root,...args){
  try{return execFileSync('git',['-c','core.longpaths=true','-C',root,...args],{encoding:'utf8',timeout:15000,windowsHide:true,stdio:['ignore','pipe','ignore']}).trim();}
  catch{throw Error('MOBILE_GIT_UNAVAILABLE');}
}
function repoName(remote){
  const m=/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(remote);
  return m?.[1].replace(/\.git$/,'').toLowerCase()??null;
}
function origin(value){
  let url;try{url=new URL(value);}catch{throw Error('MOBILE_HTTPS_ORIGIN_REQUIRED');}
  check(typeof value==='string'&&value===url.origin&&url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/','MOBILE_HTTPS_ORIGIN_REQUIRED');
  return url.origin;
}
function configuration(root,env,{requireOrigin=true}={}){
  let cfg;try{cfg=JSON.parse(readFileSync(path.join(root,'launch.mobile.json'),'utf8'));}catch{throw Error('MOBILE_CONFIG_REQUIRED');}
  const keys=cfg&&typeof cfg==='object'&&!Array.isArray(cfg)?Object.keys(cfg):[];
  check(REQUIRED_CONFIG_KEYS.every(k=>keys.includes(k))&&keys.every(k=>ALLOWED_CONFIG_KEYS.has(k))&&
    cfg.schemaVersion===schema&&slug.test(cfg.projectId)&&
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cfg.repository),'MOBILE_CONFIG_INVALID');
  if(cfg.mobileUpdateStrategy!==undefined)check(['SIGNED_APK','SHOREBIRD_OPTIONAL'].includes(cfg.mobileUpdateStrategy),'MOBILE_CONFIG_INVALID');
  cfg.mobileUpdateStrategy=cfg.mobileUpdateStrategy??'SIGNED_APK';
  cfg.buildAgentRequired=false;
  cfg.shorebirdRequired=false;
  if(!requireOrigin){
    if(cfg.serviceOrigin==='@host'||cfg.serviceOrigin==='@local'){
      cfg.serviceOrigin=env.EXECUTIONKIT_LAUNCH_MOBILE_ORIGIN?origin(env.EXECUTIONKIT_LAUNCH_MOBILE_ORIGIN):null;
    }else if(cfg.serviceOrigin){
      cfg.serviceOrigin=origin(cfg.serviceOrigin);
      if(env.EXECUTIONKIT_LAUNCH_MOBILE_ORIGIN)check(origin(env.EXECUTIONKIT_LAUNCH_MOBILE_ORIGIN)===cfg.serviceOrigin,'MOBILE_HOST_ORIGIN_PIN_REQUIRED');
    }
    return cfg;
  }
  cfg.serviceOrigin=cfg.serviceOrigin==='@host'?origin(env.EXECUTIONKIT_LAUNCH_MOBILE_ORIGIN):origin(cfg.serviceOrigin);
  check(env.EXECUTIONKIT_LAUNCH_MOBILE_ORIGIN&&origin(env.EXECUTIONKIT_LAUNCH_MOBILE_ORIGIN)===cfg.serviceOrigin,'MOBILE_HOST_ORIGIN_PIN_REQUIRED');
  return cfg;
}
export function planLaunchMobile(root,{kind='verify',expectedCommit=null,env=process.env,localOnly=false}={}){
  check(['verify','apk','debug_apk','aab'].includes(kind),'MOBILE_JOB_KIND_FORBIDDEN');
  root=path.resolve(root);
  const cfg=configuration(root,env,{requireOrigin:!localOnly});
  check(repoName(git(root,'config','--get','remote.origin.url'))===cfg.repository.toLowerCase(),'MOBILE_REPOSITORY_MISMATCH');
  const commit=git(root,'rev-parse','HEAD');
  check(sha.test(commit),'MOBILE_HEAD_INVALID');
  check(!expectedCommit||expectedCommit===commit,'MOBILE_EXPECTED_HEAD_MISMATCH');
  check(!git(root,'status','--porcelain','--untracked-files=all'),'MOBILE_DIRTY_WORKTREE');
  return {schemaVersion:schema,status:'PLANNED',service:'APKrelease/v1',executionModel:'LOCAL_WORKSTATION_DIRECT',mobileUpdateStrategy:cfg.mobileUpdateStrategy,buildAgentRequired:false,shorebirdRequired:false,projectId:cfg.projectId,repository:cfg.repository,sourceCommit:commit,kind,productionAuthorization:false};
}
async function request(cfg,route,{method='GET',token,body,rawBody=null,extraHeaders={},transport=fetch}={}){
  const headers={Accept:'application/json',...extraHeaders};
  if(token)headers.Authorization='Bearer '+token;
  let payloadBody;
  if(rawBody!==null){
    headers['Content-Type']=headers['Content-Type']??'application/octet-stream';
    headers['Content-Length']=String(rawBody.length);
    payloadBody=rawBody;
  }else if(body){
    headers['Content-Type']='application/json';
    headers['Idempotency-Key']=headers['Idempotency-Key']??createHash('sha256').update(schema+':'+route+':'+JSON.stringify(body)).digest('hex');
    payloadBody=JSON.stringify(body);
  }
  let response;
  try{response=await transport(cfg.serviceOrigin+route,{method,headers,body:payloadBody,redirect:'error',signal:AbortSignal.timeout(30000)});}
  catch{throw Error('MOBILE_UPSTREAM_UNREACHABLE');}
  check(response?.ok,'MOBILE_HTTP_'+String(response?.status??'UNKNOWN'));
  let data;try{data=await response.json();}catch{throw Error('MOBILE_INVALID_JSON');}
  check(data&&typeof data==='object'&&!Array.isArray(data),'MOBILE_INVALID_RESPONSE');
  return data;
}
async function requireMobileReleaseGates(root,providerArtifactSha256=null,providerBoundary='release'){
  try{const {validateV4ReleaseGates}=await import('./v4-release-gates.mjs');const r=validateV4ReleaseGates(root,{checkDeployment:false,providerArtifactSha256,providerBoundary});check(r.status==='PASS','MOBILE_CANONICAL_RELEASE_GATES_REQUIRED');return r;}
  catch{throw Error('MOBILE_CANONICAL_RELEASE_GATES_REQUIRED');}
}
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
export function signMobileReleaseGate(validation,{project,repository,artifact,keyId,privateKey,now=Date.now()}={}){
  check(validation?.status==='PASS'&&sha.test(validation.commit??'')&&typeof validation.candidateId==='string','MOBILE_CANONICAL_RELEASE_GATES_REQUIRED');
  check(slug.test(project??'')&&slug.test(keyId??'')&&sha256Re.test(artifact??''),'MOBILE_GATE_SIGNING_SCOPE_REQUIRED');
  const evidence={test:validation.gates?.test,audit:validation.gates?.audit,visual:validation.gates?.visual,providers:validation.gates?.providers};
  check(evidence.providers?.ok===true&&['PASS','NOT_APPLICABLE'].includes(evidence.providers.status),'MOBILE_EXTERNAL_PROVIDER_GATE_REQUIRED');
  if(evidence.providers.status==='PASS')check(evidence.providers.context?.commit===validation.commit&&evidence.providers.context?.candidateId===validation.candidateId&&evidence.providers.context?.environment==='production'&&evidence.providers.context?.artifactSha256===artifact,'MOBILE_PROVIDER_ARTIFACT_MISMATCH');
  check(evidence.test?.status==='PASS'&&evidence.audit?.status==='PASS'&&['PASS','NOT_APPLICABLE'].includes(evidence.visual?.status),'MOBILE_ALL_RELEASE_SYSTEMS_REQUIRED');
  for(const g of [evidence.test,evidence.audit])check(g.commit===validation.commit&&g.candidateId===validation.candidateId,'MOBILE_GATE_CANDIDATE_MISMATCH');
  let key;try{key=createPrivateKey(privateKey);}catch{throw Error('MOBILE_LAUNCH_ATTESTATION_KEY_REQUIRED');}
  check(key.asymmetricKeyType==='ed25519','MOBILE_LAUNCH_ED25519_REQUIRED');
  const payload={schema:'executionkit-mobile-release-gate/v1',id:randomUUID(),project,repository,commit:validation.commit,candidate_id:validation.candidateId,artifact_sha256:artifact,
    issued_at:new Date(now).toISOString(),expires_at:new Date(now+86400000).toISOString(),gates:Object.fromEntries(Object.entries(evidence).map(([name,g])=>[name,{status:g.status,evidence_sha256:createHash('sha256').update(canonical(g)).digest('hex')}]))};
  return {key_id:keyId,payload,signature:sign(null,Buffer.from(canonical(payload)),key).toString('hex')};
}
export function signManualWorkstationInspection(inspected,{project,workerId,principalId,commit,format='apk',secret,id=randomUUID(),inspectedAt=new Date().toISOString(),hostFingerprint=undefined}={}){
  check(slug.test(project??'')&&slug.test(workerId??'')&&slug.test(principalId??'')&&sha.test(commit??''),'MOBILE_MANUAL_INSPECTION_SCOPE_INVALID');
  check(typeof secret==='string'&&secret.length>=16,'MOBILE_WORKSTATION_SECRET_REQUIRED');
  check(inspected&&inspected.debug_signed===false&&sha256Re.test(inspected.sha256??'')&&sha256Re.test(inspected.signing_sha256??''),'MOBILE_INSPECTION_ARTIFACT_INVALID');
  const payload={
    type:'workstation.manual_inspection.v1',
    id,
    project,
    worker_id:workerId,
    principal_id:principalId,
    commit,
    artifact_sha256:inspected.sha256,
    size:inspected.size,
    format,
    package_id:inspected.package_id,
    version_code:inspected.version_code,
    version:inspected.version,
    minimum_android_sdk:inspected.minimum_android_sdk,
    signing_sha256:inspected.signing_sha256,
    debug_signed:false,
    verifier:inspected.verifier??'android-sdk-apksigner+apkanalyzer',
    inspected_at:inspectedAt,
    ...(format==='apk'?{architectures:inspected.architectures}:{}),
    ...(hostFingerprint?{host_fingerprint:hostFingerprint}:{}),
  };
  return {payload,signature:createHmac('sha256',secret).update(canonical(payload)).digest('hex')};
}
export function signManualWorkstationReceipt({id=randomUUID(),project,commit,artifactSha256,inspectionId,runnerId,flutterVersion,toolchain=null,startedAt=new Date().toISOString(),finishedAt=new Date().toISOString(),gates,secret,resourceEnforcement='watchdog-soft'}={}){
  check(slug.test(project??'')&&slug.test(runnerId??'')&&sha.test(commit??'')&&sha256Re.test(artifactSha256??''),'MOBILE_MANUAL_RECEIPT_SCOPE_INVALID');
  check(typeof inspectionId==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(inspectionId),'MOBILE_MANUAL_RECEIPT_INSPECTION_ID_REQUIRED');
  check(typeof secret==='string'&&secret.length>=16,'MOBILE_WORKSTATION_SECRET_REQUIRED');
  const resolvedFlutter=toolchain?.flutter??flutterVersion;
  check(typeof resolvedFlutter==='string'&&flutterSemverRe.test(resolvedFlutter),'MOBILE_FLUTTER_VERSION_INVALID');
  check(Array.isArray(gates)&&gates.length>0,'MOBILE_RECEIPT_GATES_REQUIRED');
  for(const g of gates){
    check(g&&typeof g.name==='string'&&['PASS','FAIL','NOT_TESTED'].includes(g.status),'MOBILE_RECEIPT_GATE_INVALID');
    if(g.status==='PASS'){
      check(g.exit_code===0&&sha256Re.test(g.evidence_sha256??''),'MOBILE_RECEIPT_FALSE_PASS');
    }else if(g.status==='FAIL'){
      check(Number.isInteger(g.exit_code)&&g.exit_code!==0&&sha256Re.test(g.evidence_sha256??''),'MOBILE_RECEIPT_GATE_INVALID');
    }else{
      check(g.exit_code===null&&g.evidence_sha256===null,'MOBILE_RECEIPT_NOT_TESTED_MUST_BE_NULL');
    }
  }
  const normalizedToolchain={
    flutter:resolvedFlutter,
    ...(toolchain?.dart?{dart:toolchain.dart}:{}),
    ...(toolchain?.engine?{engine:toolchain.engine}:{}),
    ...(toolchain?.channel?{channel:toolchain.channel}:{}),
  };
  const payload={
    id,
    project,
    commit,
    artifact_sha256:artifactSha256,
    mode:'manual_workstation',
    inspection_id:inspectionId,
    runner_id:runnerId,
    toolchain:normalizedToolchain,
    started_at:startedAt,
    finished_at:finishedAt,
    resource_enforcement:resourceEnforcement,
    gates:gates.map(g=>({name:g.name,status:g.status,exit_code:g.exit_code,evidence_sha256:g.evidence_sha256})),
  };
  return {payload,signature:createHmac('sha256',secret).update(canonical(payload)).digest('hex')};
}
export function resolveFlutterAppRoot(root,cfg={}){
  root=path.resolve(root);
  const rootReal=realpathSync(root);
  const candidates=cfg.flutterPath?[cfg.flutterPath]:['.','flutter_app','app','mobile'];
  let appDir=null,relPath=null;
  for(const c of candidates){
    const candidate=path.resolve(root,c);
    const pubspec=path.join(candidate,'pubspec.yaml');
    if(existsSync(pubspec)&&!lstatSync(pubspec).isSymbolicLink()){
      const realCandidate=realpathSync(candidate);
      check(realCandidate===rootReal||realCandidate.startsWith(rootReal+path.sep),'MOBILE_FLUTTER_PATH_ESCAPE');
      appDir=realCandidate;relPath=c;break;
    }
  }
  check(appDir,'MOBILE_FLUTTER_PROJECT_NOT_FOUND');
  const pubspecText=readFileSync(path.join(appDir,'pubspec.yaml'),'utf8');
  const nameMatch=/^name:\s*([a-zA-Z0-9_]+)/m.exec(pubspecText);
  const versionMatch=/^version:\s*([^\s+#]+)(?:\+(\d+))?/m.exec(pubspecText);
  check(nameMatch&&versionMatch,'MOBILE_PUBSPEC_IDENTITY_INVALID');
  const versionName=versionMatch[1],versionCode=Number(versionMatch[2]??1);
  check(Number.isSafeInteger(versionCode)&&versionCode>=1,'MOBILE_VERSION_CODE_INVALID');
  const gradleKts=path.join(appDir,'android','app','build.gradle.kts');
  const gradleGroovy=path.join(appDir,'android','app','build.gradle');
  const gradleFile=existsSync(gradleKts)?gradleKts:existsSync(gradleGroovy)?gradleGroovy:null;
  check(gradleFile,'MOBILE_ANDROID_GRADLE_NOT_FOUND');
  const gradleText=readFileSync(gradleFile,'utf8');
  const appIdMatch=/applicationId\s*(?:=|\s)\s*["']([A-Za-z][\w]*(?:\.[A-Za-z][\w]*)+)["']/.exec(gradleText);
  const packageId=cfg.packageId??appIdMatch?.[1]??null;
  check(packageId&&/^[A-Za-z][\w]*(?:\.[A-Za-z][\w]*)+$/.test(packageId),'MOBILE_PACKAGE_ID_NOT_FOUND');
  return {appDir,flutterPath:relPath,pubspecName:nameMatch[1],versionName,versionCode,packageId,gradleFile};
}
export function detectLocalFlutterToolchain(env=process.env,commandRunner=null,{expectedVersion=null}={}){
  if(expectedVersion!==null&&expectedVersion!==undefined){
    check(typeof expectedVersion==='string'&&flutterSemverRe.test(expectedVersion.trim()),'MOBILE_FLUTTER_VERSION_MALFORMED');
  }
  let res;
  try{
    if(commandRunner){
      res=commandRunner('flutter',['--version','--machine'],{env,timeout:60000});
    }else{
      const safeEnv={...sdkToolEnvironment(),...mobileProviderEnvironment(env)};
      res=spawnPortableSync('flutter',['--version','--machine'],{env:safeEnv,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024,windowsHide:true}).result;
    }
  }catch{
    throw Error('MOBILE_FLUTTER_CLI_UNAVAILABLE');
  }
  check(res&&res.status===0&&!res.error&&typeof res.stdout==='string'&&res.stdout.trim().length>0,'MOBILE_FLUTTER_CLI_UNAVAILABLE');
  let parsed;
  try{parsed=JSON.parse(res.stdout.trim());}catch{throw Error('MOBILE_FLUTTER_VERSION_MALFORMED');}
  check(parsed&&typeof parsed==='object'&&!Array.isArray(parsed),'MOBILE_FLUTTER_VERSION_MALFORMED');
  const frameworkVersion=typeof parsed.frameworkVersion==='string'?parsed.frameworkVersion.trim():'';
  check(flutterSemverRe.test(frameworkVersion)&&Number(frameworkVersion.split('.')[0])>=3,'MOBILE_FLUTTER_VERSION_MALFORMED');
  if(expectedVersion!==null&&expectedVersion!==undefined){
    check(frameworkVersion===expectedVersion.trim(),'MOBILE_FLUTTER_VERSION_MISMATCH');
  }
  const dartRaw=typeof parsed.dartSdkVersion==='string'?parsed.dartSdkVersion.trim().split(/\s+/)[0]:'';
  const dart=flutterSemverRe.test(dartRaw)?dartRaw:null;
  const engine=typeof parsed.engineRevision==='string'&&/^[a-f0-9]{7,40}$/i.test(parsed.engineRevision.trim())?parsed.engineRevision.trim():null;
  const channel=typeof parsed.channel==='string'&&/^[a-zA-Z0-9._-]+$/.test(parsed.channel.trim())?parsed.channel.trim():null;
  return Object.freeze({
    flutter:frameworkVersion,
    ...(dart?{dart}:{}),
    ...(engine?{engine}:{}),
    ...(channel?{channel}:{}),
  });
}
export function detectLocalFlutterVersion(env=process.env,commandRunner=null,options={}){
  return detectLocalFlutterToolchain(env,commandRunner,options).flutter;
}
function isSyntheticGateHash(gateName,sourceCommit,digest){
  if(!sha256Re.test(digest??''))return false;
  const candidates=[
    `verified-at-commit:${sourceCommit}`,
    `handoff:${gateName}:${sourceCommit}`,
    `skip:${gateName}:${sourceCommit}`,
    `synthetic:${gateName}:${sourceCommit}`,
  ];
  return candidates.some(c=>createHash('sha256').update(c).digest('hex')===digest);
}
export function verifyMobileTestEvidence(evidenceSource,{projectId,repository,sourceCommit,packageId,artifactSha256=null,signingSha256=null,flutterVersion=null,secret=null,maxAgeMs=86400000,now=Date.now(),requirePassed=true}={}){
  check(Boolean(evidenceSource),'MOBILE_TEST_EVIDENCE_MISSING');
  let rawDoc=evidenceSource;
  if(typeof evidenceSource==='string'){
    check(existsSync(evidenceSource)&&!lstatSync(evidenceSource).isSymbolicLink()&&statSync(evidenceSource).isFile(),'MOBILE_TEST_EVIDENCE_MISSING');
    try{rawDoc=JSON.parse(readFileSync(evidenceSource,'utf8'));}catch{throw Error('MOBILE_TEST_EVIDENCE_MALFORMED');}
  }
  check(rawDoc&&typeof rawDoc==='object'&&!Array.isArray(rawDoc),'MOBILE_TEST_EVIDENCE_MALFORMED');
  const payload=rawDoc.payload&&typeof rawDoc.payload==='object'?rawDoc.payload:rawDoc;
  check(payload.schema==='workstation.mobile_test_evidence.v1','MOBILE_TEST_EVIDENCE_MALFORMED');
  if(secret){
    check(typeof rawDoc.signature==='string'&&sha256Re.test(rawDoc.signature),'MOBILE_TEST_EVIDENCE_FORGED');
    const expectedSig=createHmac('sha256',secret).update(canonical(payload)).digest('hex');
    check(rawDoc.signature===expectedSig,'MOBILE_TEST_EVIDENCE_FORGED');
  }
  if(projectId)check(payload.projectId===projectId,'MOBILE_TEST_EVIDENCE_PROJECT_MISMATCH');
  if(repository)check(typeof payload.repository==='string'&&payload.repository.toLowerCase()===repository.toLowerCase(),'MOBILE_TEST_EVIDENCE_PROJECT_MISMATCH');
  if(packageId)check(payload.packageId===packageId,'MOBILE_TEST_EVIDENCE_PACKAGE_MISMATCH');
  if(sourceCommit)check(payload.sourceCommit===sourceCommit,'MOBILE_TEST_EVIDENCE_COMMIT_MISMATCH');
  if(artifactSha256&&payload.artifactSha256)check(payload.artifactSha256===artifactSha256,'MOBILE_TEST_EVIDENCE_ARTIFACT_MISMATCH');
  if(signingSha256&&payload.signingSha256)check(payload.signingSha256===signingSha256,'MOBILE_TEST_EVIDENCE_SIGNING_MISMATCH');
  if(flutterVersion)check(payload.flutterVersion===flutterVersion&&payload.toolchain?.flutter===flutterVersion,'MOBILE_FLUTTER_VERSION_MISMATCH');
  const generatedMs=Date.parse(payload.generatedAt??payload.finishedAt??'');
  check(Number.isFinite(generatedMs)&&generatedMs<=now+300000&&generatedMs>=now-maxAgeMs,'MOBILE_TEST_EVIDENCE_STALE');
  check(Array.isArray(payload.gates),'MOBILE_TEST_EVIDENCE_MALFORMED');
  const verifiedGates=[];
  for(const reqName of MOBILE_MANDATORY_TEST_GATES){
    const g=payload.gates.find(x=>x&&x.name===reqName);
    check(Boolean(g)&&['PASS','FAIL','NOT_TESTED'].includes(g.status),'MOBILE_TEST_EVIDENCE_INCOMPLETE');
    if(g.evidence_sha256){
      check(!isSyntheticGateHash(reqName,payload.sourceCommit,g.evidence_sha256),'MOBILE_TEST_EVIDENCE_SYNTHETIC');
    }
    if(g.status==='PASS'){
      check(g.exit_code===0&&sha256Re.test(g.evidence_sha256??''),'MOBILE_TEST_EVIDENCE_FORGED');
      check(typeof g.log_file==='string'&&g.log_file.length>0&&existsSync(g.log_file)&&!lstatSync(g.log_file).isSymbolicLink()&&statSync(g.log_file).isFile(),'MOBILE_TEST_EVIDENCE_FORGED');
      const actualLogSha=fileSha256(g.log_file);
      check(actualLogSha===g.evidence_sha256,'MOBILE_TEST_EVIDENCE_FORGED');
    }else if(g.status==='FAIL'){
      check(Number.isInteger(g.exit_code)&&g.exit_code!==0&&sha256Re.test(g.evidence_sha256??''),'MOBILE_TEST_EVIDENCE_MALFORMED');
    }else{
      check(g.exit_code===null&&g.evidence_sha256===null,'MOBILE_TEST_EVIDENCE_MALFORMED');
    }
    if(requirePassed){
      check(g.status!=='NOT_TESTED','MOBILE_TEST_EVIDENCE_NOT_TESTED');
      check(g.status==='PASS'&&g.exit_code===0,'MOBILE_TEST_EVIDENCE_FAILED');
    }
    verifiedGates.push({name:g.name,status:g.status,exit_code:g.exit_code,evidence_sha256:g.evidence_sha256});
  }
  return {
    payload,
    gates:verifiedGates,
    allPassed:verifiedGates.every(g=>g.status==='PASS'&&g.exit_code===0),
  };
}
export async function inspectMobileDoctor(root,{env=process.env,commandRunner=null,hostCheck={}}={}){
  const {observed:host}=requireNativeWorkstation(hostCheck);
  root=path.resolve(root);
  const cfg=configuration(root,env,{requireOrigin:false});
  const plan=planLaunchMobile(root,{kind:'apk',env,localOnly:true});
  const app=resolveFlutterAppRoot(root,cfg);
  const apksigner=resolveAndroidSdkTool('apksigner');
  const apkanalyzer=resolveAndroidSdkTool('apkanalyzer');
  const sdkEnv=sdkToolEnvironment();
  return {
    schemaVersion:schema,
    status:'READY',
    executionModel:'LOCAL_WORKSTATION_DIRECT',
    mobileUpdateStrategy:cfg.mobileUpdateStrategy,
    buildAgentRequired:false,
    shorebirdRequired:false,
    projectId:cfg.projectId,
    repository:cfg.repository,
    sourceCommit:plan.sourceCommit,
    workstation:{platform:process.platform,arch:process.arch,physical:host.physical,fingerprint:host.fingerprint},
    flutterApp:{flutterPath:app.flutterPath,packageId:app.packageId,versionName:app.versionName,versionCode:app.versionCode},
    toolchains:{apksigner,apkanalyzer,javaHome:sdkEnv.JAVA_HOME??null,androidSdkRoot:sdkEnv.ANDROID_HOME??null},
  };
}
export async function inspectLocalMobileArtifact(root,{artifactFile,kind='apk',expectedCommit=null,worker=null,principal=null,env=process.env,artifactInspector=null,hostCheck={},preverifiedPlan=null}={}){
  const {policy}=requireNativeWorkstation(hostCheck);
  check(['apk','debug_apk','aab'].includes(kind),'MOBILE_ARTIFACT_KIND_INVALID');
  check(typeof artifactFile==='string'&&artifactFile.length>0,'MOBILE_ARTIFACT_FILE_REQUIRED');
  const resolvedArtifact=path.resolve(root,artifactFile);
  check(existsSync(resolvedArtifact)&&!lstatSync(resolvedArtifact).isSymbolicLink()&&statSync(resolvedArtifact).isFile(),'MOBILE_ARTIFACT_FILE_NOT_FOUND');
  const cfg=configuration(path.resolve(root),env,{requireOrigin:false});
  const plan=preverifiedPlan??planLaunchMobile(root,{kind,expectedCommit,env,localOnly:true});
  const app=resolveFlutterAppRoot(root,cfg);
  const format=kind==='aab'?'aab':'apk';
  const inspectFn=artifactInspector??(format==='aab'?inspectBundle:inspectApk);
  const sdkEnv=sdkToolEnvironment();
  const javaBin=sdkEnv.JAVA_HOME?path.join(sdkEnv.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java'):'java';
  const jarsignerBin=env.EXECUTIONKIT_JARSIGNER_BIN??(sdkEnv.JAVA_HOME?path.join(sdkEnv.JAVA_HOME,'bin',process.platform==='win32'?'jarsigner.exe':'jarsigner'):'jarsigner');
  const keytoolBin=env.EXECUTIONKIT_KEYTOOL_BIN??(sdkEnv.JAVA_HOME?path.join(sdkEnv.JAVA_HOME,'bin',process.platform==='win32'?'keytool.exe':'keytool'):'keytool');
  const bundletoolJar=env.EXECUTIONKIT_BUNDLETOOL_JAR??env.BUNDLETOOL_JAR??null;
  const info=await inspectFn(resolvedArtifact,format==='aab'?{bundletool:bundletoolJar,jarsigner:jarsignerBin,keytool:keytoolBin,java:javaBin,observationOnly:kind==='debug_apk'}:{observationOnly:kind==='debug_apk'});
  check(info.package_id===app.packageId,'MOBILE_PACKAGE_ID_MISMATCH');
  if(kind!=='debug_apk')check(info.debug_signed===false,'MOBILE_DEBUG_SIGNED_FORBIDDEN');
  const secret=env.EXECUTIONKIT_LAUNCH_WORKSTATION_KEY??env.EXECUTIONKIT_LAUNCH_RUNNER_KEY??null;
  let signedInspection=null;
  if(worker&&principal&&secret){
    signedInspection=signManualWorkstationInspection(info,{project:cfg.projectId,workerId:worker,principalId:principal,commit:plan.sourceCommit,format,secret,hostFingerprint:policy?.fingerprint});
  }
  return {
    schemaVersion:schema,
    status:'INSPECTED',
    lifecycleState:'INSPECTED',
    releaseReady:false,
    published:false,
    executionModel:'LOCAL_WORKSTATION_DIRECT',
    mobileUpdateStrategy:cfg.mobileUpdateStrategy,
    buildAgentRequired:false,
    shorebirdRequired:false,
    projectId:cfg.projectId,
    sourceCommit:plan.sourceCommit,
    format,
    artifact:info,
    signedInspection,
  };
}
export async function buildLocalMobileArtifact(root,{kind='apk',expectedCommit=null,authorize=false,outputFile=null,handoffFile=null,testEvidenceFile=null,worker=null,principal=null,flutterVersion=null,skipTests=false,env=process.env,commandRunner=null,artifactInspector=null,hostCheck={}}={}){
  requireNativeWorkstation(hostCheck);
  check(authorize===true,'MOBILE_BUILD_AUTHORIZATION_REQUIRED');
  check(['apk','debug_apk','aab'].includes(kind),'MOBILE_BUILD_KIND_INVALID');
  root=path.resolve(root);
  const cfg=configuration(root,env,{requireOrigin:false});
  const plan=planLaunchMobile(root,{kind,expectedCommit,env,localOnly:true});
  const app=resolveFlutterAppRoot(root,cfg);
  const safeEnv={...sdkToolEnvironment(),...mobileProviderEnvironment(env)};
  const runCmd=commandRunner??((cmd,args,opts={})=>spawnPortableSync(cmd,args,{cwd:opts.cwd??app.appDir,env:safeEnv,encoding:'utf8',timeout:opts.timeout??1800000,maxBuffer:16*1024*1024,windowsHide:true}).result);
  const toolchain=detectLocalFlutterToolchain(env,runCmd,{expectedVersion:flutterVersion??cfg.flutterVersion??null});
  const resolvedFlutterVersion=toolchain.flutter;
  const secret=env.EXECUTIONKIT_LAUNCH_WORKSTATION_KEY??env.EXECUTIONKIT_LAUNCH_RUNNER_KEY??null;
  const defaultOutDir=path.join(tmpdir(),'executionkit-mobile-releases',cfg.projectId,plan.sourceCommit);
  const evidenceDir=path.join(defaultOutDir,'evidence');
  mkdirSync(evidenceDir,{recursive:true});
  const stagingDir=mkdtempSync(path.join(tmpdir(),'ek-local-mobile-build-'));
  const startedAt=new Date().toISOString();
  const writeTestEvidence=(testGates,extra={})=>{
    const finishedAt=new Date().toISOString();
    const payload={
      schema:'workstation.mobile_test_evidence.v1',
      projectId:cfg.projectId,
      repository:cfg.repository,
      sourceCommit:plan.sourceCommit,
      packageId:app.packageId,
      flutterVersion:resolvedFlutterVersion,
      toolchain,
      testsExecuted:testGates.every(g=>g.status!=='NOT_TESTED'),
      startedAt,
      finishedAt,
      generatedAt:finishedAt,
      ...extra,
      gates:testGates,
    };
    const doc=secret&&secret.length>=16
      ? {payload,signature:createHmac('sha256',secret).update(canonical(payload)).digest('hex')}
      : {payload,signature:null};
    const defaultEvFile=path.join(defaultOutDir,'test-execution-evidence.json');
    writeFileSync(defaultEvFile,JSON.stringify(doc,null,2));
    if(outputFile){
      const customEvFile=path.join(path.dirname(path.resolve(root,outputFile)),'test-execution-evidence.json');
      mkdirSync(path.dirname(customEvFile),{recursive:true});
      writeFileSync(customEvFile,JSON.stringify(doc,null,2));
      return {doc,file:customEvFile,defaultFile:defaultEvFile,finishedAt};
    }
    return {doc,file:defaultEvFile,defaultFile:defaultEvFile,finishedAt};
  };
  try{
    const testGates=[];
    if(!skipTests){
      const analyzeRes=runCmd('flutter',['analyze','--no-pub','--no-fatal-infos'],{cwd:app.appDir,timeout:300000});
      const analyzeExit=Number.isInteger(analyzeRes?.status)?analyzeRes.status:1;
      const analyzeLogPath=path.join(evidenceDir,'analyze.log');
      const analyzeOutput=String(analyzeRes?.stdout??'')+String(analyzeRes?.stderr??'')||(analyzeExit===0?'flutter analyze exit 0\n':'flutter analyze failed\n');
      writeFileSync(analyzeLogPath,analyzeOutput,'utf8');
      const analyzeSha=fileSha256(analyzeLogPath);
      if(analyzeExit!==0){
        testGates.push({name:'analyze',status:'FAIL',exit_code:analyzeExit,evidence_sha256:analyzeSha,log_file:analyzeLogPath});
        testGates.push({name:'unit',status:'NOT_TESTED',exit_code:null,evidence_sha256:null,log_file:null});
        testGates.push({name:'widget',status:'NOT_TESTED',exit_code:null,evidence_sha256:null,log_file:null});
        const saved=writeTestEvidence(testGates);
        throw Object.assign(Error('MOBILE_LOCAL_ANALYZE_FAILED'),{gates:testGates.map(({log_file,...g})=>g),testEvidenceFile:saved.file});
      }
      testGates.push({name:'analyze',status:'PASS',exit_code:0,evidence_sha256:analyzeSha,log_file:analyzeLogPath});
      const testRes=runCmd('flutter',['test','--no-pub'],{cwd:app.appDir,timeout:600000});
      const testExit=Number.isInteger(testRes?.status)?testRes.status:1;
      const testLogPath=path.join(evidenceDir,'test.log');
      const testOutput=String(testRes?.stdout??'')+String(testRes?.stderr??'')||(testExit===0?'flutter test exit 0\n':'flutter test failed\n');
      writeFileSync(testLogPath,testOutput,'utf8');
      const testSha=fileSha256(testLogPath);
      if(testExit!==0){
        testGates.push({name:'unit',status:'FAIL',exit_code:testExit,evidence_sha256:testSha,log_file:testLogPath});
        testGates.push({name:'widget',status:'FAIL',exit_code:testExit,evidence_sha256:testSha,log_file:testLogPath});
        const saved=writeTestEvidence(testGates);
        throw Object.assign(Error('MOBILE_LOCAL_TEST_FAILED'),{gates:testGates.map(({log_file,...g})=>g),testEvidenceFile:saved.file});
      }
      testGates.push({name:'unit',status:'PASS',exit_code:0,evidence_sha256:testSha,log_file:testLogPath});
      testGates.push({name:'widget',status:'PASS',exit_code:0,evidence_sha256:testSha,log_file:testLogPath});
    }else if(testEvidenceFile){
      const resolvedEv=path.resolve(root,testEvidenceFile);
      const verified=verifyMobileTestEvidence(resolvedEv,{
        projectId:cfg.projectId,
        repository:cfg.repository,
        sourceCommit:plan.sourceCommit,
        packageId:app.packageId,
        flutterVersion:resolvedFlutterVersion,
        secret,
        requirePassed:true,
      });
      for(const g of verified.payload.gates){
        if(MOBILE_MANDATORY_TEST_GATES.includes(g.name)){
          testGates.push({name:g.name,status:g.status,exit_code:g.exit_code,evidence_sha256:g.evidence_sha256,log_file:g.log_file??null});
        }
      }
    }else{
      testGates.push({name:'analyze',status:'NOT_TESTED',exit_code:null,evidence_sha256:null,log_file:null});
      testGates.push({name:'unit',status:'NOT_TESTED',exit_code:null,evidence_sha256:null,log_file:null});
      testGates.push({name:'widget',status:'NOT_TESTED',exit_code:null,evidence_sha256:null,log_file:null});
    }
    const buildArgs=kind==='aab'?['build','appbundle','--release']:kind==='debug_apk'?['build','apk','--debug']:['build','apk','--release'];
    const buildRes=runCmd('flutter',buildArgs,{cwd:app.appDir,timeout:1800000});
    check(buildRes?.status===0,'MOBILE_LOCAL_BUILD_FAILED');
    const buildOutputRel=kind==='aab'
      ? path.join('build','app','outputs','bundle','release','app-release.aab')
      : kind==='debug_apk'
        ? path.join('build','app','outputs','flutter-apk','app-debug.apk')
        : path.join('build','app','outputs','flutter-apk','app-release.apk');
    const builtPath=path.join(app.appDir,buildOutputRel);
    check(existsSync(builtPath)&&statSync(builtPath).isFile(),'MOBILE_BUILT_ARTIFACT_NOT_FOUND');
    const ext=kind==='aab'?'aab':'apk';
    mkdirSync(defaultOutDir,{recursive:true});
    const targetArtifactPath=outputFile?path.resolve(root,outputFile):path.join(defaultOutDir,`${cfg.projectId}-${app.versionName}+${app.versionCode}.${ext}`);
    mkdirSync(path.dirname(targetArtifactPath),{recursive:true});
    cpSync(builtPath,targetArtifactPath);
    const inspected=await inspectLocalMobileArtifact(root,{artifactFile:targetArtifactPath,kind,expectedCommit:plan.sourceCommit,worker,principal,env,artifactInspector,hostCheck,preverifiedPlan:plan});
    const info=inspected.artifact;
    check(info.version_code===app.versionCode,'MOBILE_BUILT_VERSION_CODE_MISMATCH');
    const savedEvidence=writeTestEvidence(testGates,{artifactSha256:info.sha256,signingSha256:info.signing_sha256??null});
    const gates=testGates.map(({log_file,...g})=>g);
    const buildGateName=kind==='aab'?'aab_build':kind==='debug_apk'?'debug_apk_build':'apk_build';
    gates.push({name:buildGateName,status:'PASS',exit_code:0,evidence_sha256:info.sha256});
    if(kind!=='debug_apk'){
      gates.push({name:kind==='aab'?'aab_signature':'apk_signature',status:'PASS',exit_code:0,evidence_sha256:info.signing_sha256});
    }
    const finishedAt=savedEvidence.finishedAt;
    const testsExecuted=testGates.every(g=>g.status!=='NOT_TESTED');
    const testsPassed=testGates.every(g=>g.status==='PASS'&&g.exit_code===0);
    let signedReceipt=null;
    if(inspected.signedInspection&&worker&&secret){
      signedReceipt=signManualWorkstationReceipt({
        project:cfg.projectId,
        commit:plan.sourceCommit,
        artifactSha256:info.sha256,
        inspectionId:inspected.signedInspection.payload.id,
        runnerId:worker,
        flutterVersion:resolvedFlutterVersion,
        toolchain,
        startedAt,
        finishedAt,
        gates,
        secret,
      });
    }
    const handoffPayload={
      schemaVersion:'executionkit-local-mobile-release-receipt/v1',
      executionModel:'LOCAL_WORKSTATION_DIRECT',
      mobileUpdateStrategy:cfg.mobileUpdateStrategy,
      buildAgentRequired:false,
      shorebirdRequired:false,
      lifecycleState:'BUILT',
      testsExecuted,
      testsPassed,
      releaseReady:false,
      published:false,
      projectId:cfg.projectId,
      repository:cfg.repository,
      commit:plan.sourceCommit,
      kind,
      format:ext,
      flutterVersion:resolvedFlutterVersion,
      toolchain,
      artifactPath:targetArtifactPath,
      testEvidenceFile:savedEvidence.file,
      artifact:info,
      gates,
      startedAt,
      finishedAt,
      signedInspection:inspected.signedInspection,
      signedReceipt,
    };
    const targetHandoffPath=handoffFile?path.resolve(root,handoffFile):path.join(defaultOutDir,'handoff-receipt.json');
    mkdirSync(path.dirname(targetHandoffPath),{recursive:true});
    writeFileSync(targetHandoffPath,JSON.stringify(handoffPayload,null,2));
    return {
      schemaVersion:schema,
      status:'BUILT',
      lifecycleState:'BUILT',
      testsExecuted,
      testsPassed,
      releaseReady:false,
      published:false,
      executionModel:'LOCAL_WORKSTATION_DIRECT',
      mobileUpdateStrategy:cfg.mobileUpdateStrategy,
      buildAgentRequired:false,
      shorebirdRequired:false,
      projectId:cfg.projectId,
      repository:cfg.repository,
      sourceCommit:plan.sourceCommit,
      kind,
      flutterVersion:resolvedFlutterVersion,
      toolchain,
      artifactPath:targetArtifactPath,
      handoffFile:targetHandoffPath,
      testEvidenceFile:savedEvidence.file,
      artifact:info,
      gates,
      signedInspection:inspected.signedInspection,
      signedReceipt,
      productionAuthorization:false,
    };
  }finally{
    rmSync(stagingDir,{recursive:true,force:true});
  }
}
export async function createLocalMobileHandoff(root,{artifactFile,handoffFile=null,testEvidenceFile=null,kind='apk',expectedCommit=null,worker,principal,flutterVersion=null,maxEvidenceAgeMs=86400000,now=Date.now(),allowUntested=false,env=process.env,commandRunner=null,artifactInspector=null,hostCheck={}}={}){
  requireNativeWorkstation(hostCheck);
  check(typeof worker==='string'&&slug.test(worker)&&typeof principal==='string'&&slug.test(principal),'MOBILE_WORKSTATION_IDENTITY_REQUIRED');
  const inspected=await inspectLocalMobileArtifact(root,{artifactFile,kind,expectedCommit,worker,principal,env,artifactInspector,hostCheck});
  check(inspected.signedInspection,'MOBILE_WORKSTATION_SECRET_REQUIRED');
  const cfg=configuration(path.resolve(root),env,{requireOrigin:false});
  const toolchain=detectLocalFlutterToolchain(env,commandRunner,{expectedVersion:flutterVersion??cfg.flutterVersion??null});
  const resolvedFlutterVersion=toolchain.flutter;
  const secret=env.EXECUTIONKIT_LAUNCH_WORKSTATION_KEY??env.EXECUTIONKIT_LAUNCH_RUNNER_KEY;
  const info=inspected.artifact;
  const defaultOutDir=path.join(tmpdir(),'executionkit-mobile-releases',cfg.projectId,inspected.sourceCommit);
  const resolvedArtifactPath=path.resolve(root,artifactFile);
  let candidateEvidence=testEvidenceFile;
  if(!candidateEvidence){
    const siblingEv=path.join(path.dirname(resolvedArtifactPath),'test-execution-evidence.json');
    const defaultEv=path.join(defaultOutDir,'test-execution-evidence.json');
    candidateEvidence=existsSync(siblingEv)?siblingEv:existsSync(defaultEv)?defaultEv:null;
  }else if(typeof candidateEvidence==='string'){
    candidateEvidence=path.resolve(root,candidateEvidence);
  }
  const verifiedEvidence=verifyMobileTestEvidence(candidateEvidence,{
    projectId:cfg.projectId,
    repository:cfg.repository,
    sourceCommit:inspected.sourceCommit,
    packageId:info.package_id,
    artifactSha256:info.sha256,
    signingSha256:info.signing_sha256,
    flutterVersion:resolvedFlutterVersion,
    secret,
    maxAgeMs:maxEvidenceAgeMs,
    now,
    requirePassed:!allowUntested,
  });
  const nowIso=new Date(now).toISOString();
  const gates=[
    ...verifiedEvidence.gates,
    {name:kind==='aab'?'aab_build':'apk_build',status:'PASS',exit_code:0,evidence_sha256:info.sha256},
    {name:kind==='aab'?'aab_signature':'apk_signature',status:'PASS',exit_code:0,evidence_sha256:info.signing_sha256},
  ];
  const signedReceipt=signManualWorkstationReceipt({
    project:cfg.projectId,
    commit:inspected.sourceCommit,
    artifactSha256:info.sha256,
    inspectionId:inspected.signedInspection.payload.id,
    runnerId:worker,
    flutterVersion:resolvedFlutterVersion,
    toolchain,
    startedAt:verifiedEvidence.payload.startedAt??nowIso,
    finishedAt:verifiedEvidence.payload.finishedAt??nowIso,
    gates,
    secret,
  });
  const targetHandoffPath=handoffFile?path.resolve(root,handoffFile):path.join(defaultOutDir,'handoff-receipt.json');
  mkdirSync(path.dirname(targetHandoffPath),{recursive:true});
  const handoffPayload={
    schemaVersion:'executionkit-local-mobile-release-receipt/v1',
    executionModel:'LOCAL_WORKSTATION_DIRECT',
    mobileUpdateStrategy:cfg.mobileUpdateStrategy,
    buildAgentRequired:false,
    shorebirdRequired:false,
    lifecycleState:'HANDOFF_READY',
    testsExecuted:verifiedEvidence.gates.every(g=>g.status!=='NOT_TESTED'),
    testsPassed:verifiedEvidence.allPassed,
    releaseReady:false,
    published:false,
    projectId:cfg.projectId,
    repository:cfg.repository,
    commit:inspected.sourceCommit,
    kind,
    format:inspected.format,
    flutterVersion:resolvedFlutterVersion,
    toolchain,
    artifactPath:resolvedArtifactPath,
    testEvidenceFile:typeof candidateEvidence==='string'?candidateEvidence:null,
    artifact:info,
    gates,
    startedAt:verifiedEvidence.payload.startedAt??nowIso,
    finishedAt:verifiedEvidence.payload.finishedAt??nowIso,
    signedInspection:inspected.signedInspection,
    signedReceipt,
  };
  writeFileSync(targetHandoffPath,JSON.stringify(handoffPayload,null,2));
  return {
    schemaVersion:schema,
    status:'HANDOFF_READY',
    lifecycleState:'HANDOFF_READY',
    testsExecuted:handoffPayload.testsExecuted,
    testsPassed:handoffPayload.testsPassed,
    releaseReady:false,
    published:false,
    projectId:cfg.projectId,
    sourceCommit:inspected.sourceCommit,
    flutterVersion:resolvedFlutterVersion,
    toolchain,
    handoffFile:targetHandoffPath,
    artifact:info,
    gates,
    signedInspection:inspected.signedInspection,
    signedReceipt,
    productionAuthorization:false,
  };
}
export async function importLocalMobileHandoff(root,{authorize=false,artifactFile=null,handoffFile,expectedCommit=null,env=process.env,transport=fetch}={}){
  check(authorize===true,'MOBILE_IMPORT_AUTHORIZATION_REQUIRED');
  check(typeof handoffFile==='string'&&handoffFile.length>0,'MOBILE_HANDOFF_FILE_REQUIRED');
  root=path.resolve(root);
  const cfg=configuration(root,env,{requireOrigin:true});
  const token=env.EXECUTIONKIT_LAUNCH_MOBILE_TOKEN;
  check(typeof token==='string'&&token.length>=16,'MOBILE_SCOPED_TOKEN_REQUIRED');
  const resolvedHandoff=path.resolve(root,handoffFile);
  check(existsSync(resolvedHandoff)&&!lstatSync(resolvedHandoff).isSymbolicLink()&&statSync(resolvedHandoff).isFile(),'MOBILE_HANDOFF_FILE_NOT_FOUND');
  let handoff;try{handoff=JSON.parse(readFileSync(resolvedHandoff,'utf8'));}catch{throw Error('MOBILE_HANDOFF_JSON_INVALID');}
  check(handoff&&handoff.schemaVersion==='executionkit-local-mobile-release-receipt/v1'&&handoff.projectId===cfg.projectId&&repoName('https://github.com/'+handoff.repository)===cfg.repository.toLowerCase(),'MOBILE_HANDOFF_PROJECT_MISMATCH');
  const plan=planLaunchMobile(root,{kind:handoff.kind??'apk',expectedCommit:expectedCommit??handoff.commit,env});
  check(handoff.commit===plan.sourceCommit,'MOBILE_HANDOFF_COMMIT_MISMATCH');
  check(handoff.signedInspection?.payload&&handoff.signedInspection?.signature&&handoff.signedReceipt?.payload&&handoff.signedReceipt?.signature,'MOBILE_HANDOFF_SIGNATURES_REQUIRED');
  const receiptGates=handoff.signedReceipt.payload.gates??[];
  for(const reqName of MOBILE_MANDATORY_TEST_GATES){
    const g=receiptGates.find(x=>x&&x.name===reqName);
    check(Boolean(g)&&['PASS','FAIL','NOT_TESTED'].includes(g.status),'MOBILE_HANDOFF_GATES_INCOMPLETE');
    if(g.evidence_sha256){
      check(!isSyntheticGateHash(reqName,handoff.commit,g.evidence_sha256),'MOBILE_HANDOFF_SYNTHETIC_EVIDENCE_FORBIDDEN');
    }
  }
  const resolvedArtifact=path.resolve(root,artifactFile??handoff.artifactPath??'');
  check(existsSync(resolvedArtifact)&&!lstatSync(resolvedArtifact).isSymbolicLink()&&statSync(resolvedArtifact).isFile(),'MOBILE_ARTIFACT_FILE_NOT_FOUND');
  const bytes=readFileSync(resolvedArtifact);
  const actualSha=createHash('sha256').update(bytes).digest('hex');
  check(actualSha===handoff.artifact?.sha256&&actualSha===handoff.signedInspection.payload.artifact_sha256&&actualSha===handoff.signedReceipt.payload.artifact_sha256&&bytes.length===handoff.signedInspection.payload.size,'MOBILE_HANDOFF_BYTES_MISMATCH');
  const projectRoute='/v1/projects/'+encodeURIComponent(cfg.projectId);
  const registry=await request(cfg,projectRoute,{token,transport});
  check(typeof registry.repository==='string'&&repoName(registry.repository)===cfg.repository.toLowerCase(),'MOBILE_SERVICE_REPOSITORY_MISMATCH');
  const format=handoff.format==='aab'?'aab':'apk';
  const inspectionHeader=Buffer.from(JSON.stringify(handoff.signedInspection)).toString('base64');
  const uploaded=await request(cfg,`${projectRoute}/artifacts/${actualSha}${format==='aab'?'?format=aab':''}`,{
    method:'PUT',
    token,
    rawBody:bytes,
    extraHeaders:{'X-Workstation-Inspection':inspectionHeader},
    transport,
  });
  check(uploaded.sha256===actualSha&&uploaded.verification==='VERIFIED','MOBILE_IMPORT_UPLOAD_INVALID');
  const recordedReceipt=await request(cfg,`${projectRoute}/receipts`,{
    method:'POST',
    token,
    body:handoff.signedReceipt,
    transport,
  });
  check(recordedReceipt.id===handoff.signedReceipt.payload.id&&recordedReceipt.artifact_sha256===actualSha,'MOBILE_IMPORT_RECEIPT_INVALID');
  const testsPassed=MOBILE_MANDATORY_TEST_GATES.every(name=>recordedReceipt.gates?.some(g=>g.name===name&&g.status==='PASS'&&g.exit_code===0));
  return {
    schemaVersion:schema,
    status:'IMPORTED',
    lifecycleState:'IMPORTED',
    testsPassed,
    releaseReady:false,
    published:false,
    projectId:cfg.projectId,
    sourceCommit:plan.sourceCommit,
    artifact:uploaded,
    receipt:recordedReceipt,
    productionAuthorization:false,
  };
}
export function validateMobileProviderSource(root,input,candidateCommit){
  check(sha.test(candidateCommit??'')&&input.commit===candidateCommit,'MOBILE_PROVIDER_SOURCE_MISMATCH');
  check(typeof input.workspace==='string'&&input.workspace.length>0,'MOBILE_PROVIDER_WORKSPACE_REQUIRED');
  const workspace=path.resolve(input.workspace);
  check(repoName(git(workspace,'config','--get','remote.origin.url'))===repoName(git(root,'config','--get','remote.origin.url')),'MOBILE_PROVIDER_REPOSITORY_MISMATCH');
  check(git(workspace,'rev-parse','HEAD')===candidateCommit&&!git(workspace,'status','--porcelain','--untracked-files=all'),'MOBILE_PROVIDER_WORKSPACE_MISMATCH');
}
const uuidRe=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function mobileProviderEnvironment(env){
  const safe={...env,MOBILE_NODE_EXECUTABLE:process.execPath};
  delete safe.EXECUTIONKIT_LAUNCH_ATTESTATION_PRIVATE_KEY;
  delete safe.EXECUTIONKIT_LAUNCH_MOBILE_TOKEN;
  delete safe.EXECUTIONKIT_LAUNCH_WORKSTATION_KEY;
  delete safe.EXECUTIONKIT_LAUNCH_RUNNER_KEY;
  return safe;
}
export function resolveLaunchMobileAdapter(root,{adapterRoot=null,adapterSha=null}={}){
  root=path.resolve(root);
  if(adapterRoot||adapterSha)check(adapterRoot&&sha.test(adapterSha??''),'MOBILE_PINNED_ADAPTER_REQUIRED');
  else {
    const receipt=path.join(root,'.executionkit/installation.json');
    if(existsSync(receipt)){
      let installed;try{installed=JSON.parse(readFileSync(receipt,'utf8'));}catch{throw Error('MOBILE_INSTALLATION_RECEIPT_INVALID');}
      check(sha.test(installed.sourceCommit??''),'MOBILE_PINNED_ADAPTER_REQUIRED');
      adapterSha=installed.sourceCommit;
      adapterRoot=path.join(root,'.executionkit/source/AI-ExecutionKit',adapterSha);
    }else{
      adapterRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
      adapterSha=git(adapterRoot,'rev-parse','HEAD');
    }
  }
  const source=path.resolve(adapterRoot);
  check(existsSync(source)&&realpathSync(source)===source,'MOBILE_ADAPTER_PATH_INVALID');
  check(path.resolve(git(source,'rev-parse','--show-toplevel'))===source,'MOBILE_ADAPTER_ROOT_REQUIRED');
  const repository=repoName(git(source,'config','--get','remote.origin.url'));
  check(repository==='elwazeery/ai-excutionkit'&&git(source,'rev-parse','HEAD')===adapterSha&&!git(source,'status','--porcelain','--untracked-files=all'),'MOBILE_ADAPTER_IDENTITY_MISMATCH');
  const serviceRoot=path.join(source,'lib/launch-service');
  const files={classifier:path.join(serviceRoot,'src/classify-cli.mjs'),provider:path.join(serviceRoot,'src/provider-cli.mjs'),runner:path.join(serviceRoot,'scripts/provider_runner.py')};
  for(const file of Object.values(files))check(existsSync(file)&&statSync(file).isFile()&&realpathSync(file)===file,'MOBILE_ADAPTER_ENTRYPOINT_REQUIRED');
  return {repository,sourceCommit:adapterSha,layout:'CONSOLIDATED_KIT',serviceRoot,...files};
}
export async function executeLaunchMobile(root,{mode='status',kind='verify',expectedCommit=null,authorize=false,job=null,worker=null,principal=null,desired=null,release=null,channel=null,receipt=null,artifact=null,artifactFile=null,outputFile=null,handoffFile=null,testEvidenceFile=null,flutterVersion=null,skipTests=false,allowUntested=false,maxEvidenceAgeMs=86400000,now=Date.now(),notes='',digest=null,operation=null,adapterRoot=null,adapterSha=null,projectFile=null,inputFile=null,env=process.env,transport=fetch,commandRunner=null,artifactInspector=null,hostCheck={}}={}){
  check(['status','plan','doctor','build','inspect','handoff','import','submit','agents','cancel','control','attest','release','approve','publish','rollback','provider','classify','history'].includes(mode),'MOBILE_MODE_INVALID');
  if(mode==='plan')return planLaunchMobile(root,{kind,expectedCommit,env});
  if(mode==='doctor')return inspectMobileDoctor(root,{env,commandRunner,hostCheck});
  if(mode==='inspect')return inspectLocalMobileArtifact(root,{artifactFile:artifactFile??artifact,kind,expectedCommit,worker,principal,env,artifactInspector,hostCheck});
  if(mode==='build')return buildLocalMobileArtifact(root,{kind,expectedCommit,authorize,outputFile,handoffFile,testEvidenceFile,worker,principal,flutterVersion,skipTests,env,commandRunner,artifactInspector,hostCheck});
  if(mode==='handoff')return createLocalMobileHandoff(root,{artifactFile:artifactFile??artifact,handoffFile,testEvidenceFile,kind,expectedCommit,worker,principal,flutterVersion,maxEvidenceAgeMs,now,allowUntested,env,commandRunner,artifactInspector,hostCheck});
  if(mode==='import')return importLocalMobileHandoff(root,{authorize,artifactFile:artifactFile??artifact,handoffFile,expectedCommit,env,transport});
  const cfg=configuration(path.resolve(root),env);
  if(['provider','classify'].includes(mode)){
    const adapter=resolveLaunchMobileAdapter(root,{adapterRoot,adapterSha});
    const action=mode==='classify'?'classify':operation;
    const scopedToken=env.EXECUTIONKIT_LAUNCH_MOBILE_TOKEN;check(typeof scopedToken==='string'&&scopedToken.length>=16,'MOBILE_SCOPED_TOKEN_REQUIRED');
    const registered=await request(cfg,'/v1/projects/'+cfg.projectId,{token:scopedToken,transport});
    check(repoName(registered.repository)===cfg.repository.toLowerCase(),'MOBILE_SERVICE_REPOSITORY_MISMATCH');

    check(['classify','patch','release','promote','rollback','history','usage'].includes(action),'MOBILE_PROVIDER_OPERATION_INVALID');
    if(['patch','release','promote','rollback'].includes(action)){
      requireNativeWorkstation();
      check(authorize===true,'MOBILE_PUBLICATION_AUTHORIZATION_REQUIRED');
      check(!['/usr/local/cwp','/usr/local/cwpsrv','/etc/cwp'].some(existsSync),'MOBILE_PROVIDER_WORKSTATION_REQUIRED');
    }
    check(projectFile&&inputFile,'MOBILE_PROVIDER_INPUT_REQUIRED');
    const declared=JSON.parse(readFileSync(projectFile,'utf8'));
    check(declared.id===cfg.projectId&&repoName(declared.repository)===cfg.repository.toLowerCase(),'MOBILE_PROVIDER_PROJECT_MISMATCH');
    check(['package_id','flutter_version','signing_sha256','shorebird_app_id','shorebird_public_key_sha256'].every(k=>declared[k]===registered[k]),'MOBILE_PROVIDER_REGISTRY_MISMATCH');
    const input=JSON.parse(readFileSync(inputFile,'utf8'));
    if(['patch','release','promote','rollback'].includes(action)){
      const gates=['patch','release'].includes(action)?await requireMobileReleaseGates(root,artifact,action):null;
      if(['patch','release'].includes(action)){
        planLaunchMobile(root,{kind:'apk',expectedCommit:gates.commit,env});
        validateMobileProviderSource(root,input,gates.commit);
      }
    }
    const argv=action==='classify'?[path.resolve(input.repository),declared.flutter_path,input.base_commit,input.commit,path.resolve(input.baseline_path),path.resolve(input.target_snapshot_path),path.resolve(input.output_path)]:[action,path.resolve(projectFile),path.resolve(inputFile)];
    if(action==='classify'){check(sha.test(input.base_commit??'')&&sha.test(input.commit??''),'MOBILE_CLASSIFICATION_SOURCE_REQUIRED');check(repoName(git(path.resolve(input.repository),'config','--get','remote.origin.url'))===cfg.repository.toLowerCase(),'MOBILE_REPOSITORY_MISMATCH');}
    const heavy=['patch','release','promote','rollback'].includes(action);
    const executable=heavy?(env.EXECUTIONKIT_LOCAL_PYTHON??(process.platform==='win32'?'python':'python3')):process.execPath;
    const parameters=heavy?[adapter.runner,action,path.resolve(projectFile),path.resolve(inputFile)]:[action==='classify'?adapter.classifier:adapter.provider,...argv];
    const {result}=spawnPortableSync(executable,parameters,{cwd:root,env:mobileProviderEnvironment(env),encoding:'utf8',timeout:3600000,maxBuffer:2*1024*1024});
    check(result.status===0,'MOBILE_PROVIDER_COMMAND_FAILED_OR_UNCERTAIN');
    return {schemaVersion:schema,status:'COMMAND_SUCCEEDED',operation:action,adapter:{layout:adapter.layout,repository:adapter.repository,sourceCommit:adapter.sourceCommit},output:JSON.parse(result.stdout),productionAcceptance:'REQUIRES_DEVICE_AND_PROVIDER_READBACK'};
  }

  if(mode==='submit'){
    check(authorize===true,'MOBILE_ENQUEUE_AUTHORIZATION_REQUIRED');
    check(typeof expectedCommit==='string'&&sha.test(expectedCommit),'MOBILE_EXPECTED_HEAD_REQUIRED');
    planLaunchMobile(root,{kind,expectedCommit,env});
  }
  const token=env.EXECUTIONKIT_LAUNCH_MOBILE_TOKEN;
  check(typeof token==='string'&&token.length>=16,'MOBILE_SCOPED_TOKEN_REQUIRED');
  const caps=await request(cfg,'/v1/capabilities',{transport});
  check(caps.api_version==='v1'&&caps.arbitrary_shell===false&&caps.production_requires_independent_approval===true&&
    Array.isArray(caps.capabilities)&&['jobs.enqueue','jobs.claim','journal.read'].every(k=>caps.capabilities.includes(k)),'MOBILE_INCOMPATIBLE_SERVICE');
  const projectRoute='/v1/projects/'+encodeURIComponent(cfg.projectId);
  const registry=await request(cfg,projectRoute,{token,transport});
  check(typeof registry.repository==='string'&&repoName(registry.repository)===cfg.repository.toLowerCase(),
    'MOBILE_SERVICE_REPOSITORY_MISMATCH');
  const route=projectRoute+'/jobs';
  if(mode==='history'){
    const [releases,tracks]=await Promise.all([request(cfg,projectRoute+'/releases?limit=50',{token,transport}),request(cfg,projectRoute+'/tracks?limit=50',{token,transport})]);
    return {schemaVersion:schema,status:'CONNECTED',releases:releases.items,tracks:tracks.items};
  }
  if(mode==='rollback')return {schemaVersion:schema,status:'BLOCKED',reason:'NATIVE_ROLLBACK_REQUIRES_HIGHER_VERSION_CODE',providerRollback:'Publish a newly signed higher-versionCode APK release through Launch OS (or use provider mode if optional Shorebird is enabled)'};
  if(['attest','release','approve','publish'].includes(mode)){
    check(authorize===true,'MOBILE_PUBLICATION_AUTHORIZATION_REQUIRED');
    const gates=['release','attest'].includes(mode)?await requireMobileReleaseGates(root,artifact,mode):null;
    check(caps.canonical_launch_gates_required===true&&caps.capabilities.includes('launch.gates.signed'),'MOBILE_CANONICAL_SERVICE_REQUIRED');
    let payload,suffix;
    if(mode==='attest'){
      check(sha.test(expectedCommit??'')&&sha256Re.test(artifact??''),'MOBILE_RELEASE_IDENTITY_REQUIRED');
      planLaunchMobile(root,{kind:'apk',expectedCommit,env});
      const proof=signMobileReleaseGate(gates,{project:cfg.projectId,repository:registry.repository,artifact,keyId:env.EXECUTIONKIT_LAUNCH_ATTESTATION_KEY_ID,privateKey:env.EXECUTIONKIT_LAUNCH_ATTESTATION_PRIVATE_KEY});
      const result=await request(cfg,projectRoute+'/launch/gates',{method:'POST',token,body:proof,transport});
      check(result.status==='PASS'&&result.commit===expectedCommit&&result.artifact_sha256===artifact,'MOBILE_CANONICAL_GATE_RESPONSE_INVALID');
      return {schemaVersion:schema,status:'ATTESTED',projectId:cfg.projectId,result};
    }
    if(mode==='release'){
      check(sha.test(expectedCommit??'')&&sha256Re.test(artifact??'')&&typeof receipt==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(receipt),'MOBILE_RELEASE_IDENTITY_REQUIRED');
      planLaunchMobile(root,{kind:'apk',expectedCommit,env});
      const proof=signMobileReleaseGate(gates,{project:cfg.projectId,repository:registry.repository,artifact,keyId:env.EXECUTIONKIT_LAUNCH_ATTESTATION_KEY_ID,privateKey:env.EXECUTIONKIT_LAUNCH_ATTESTATION_PRIVATE_KEY});
      const recorded=await request(cfg,projectRoute+'/launch/gates',{method:'POST',token,body:proof,transport});
      check(recorded.status==='PASS'&&recorded.commit===expectedCommit&&recorded.artifact_sha256===artifact,'MOBILE_CANONICAL_GATE_RESPONSE_INVALID');
      payload={artifact_sha256:artifact,commit:expectedCommit,receipt_id:receipt,notes,minimum_supported_version_code:1,required:false};suffix='releases';
    }else{
      check(uuidRe.test(release??'')&&['internal','staging','beta','stable'].includes(channel),'MOBILE_RELEASE_AND_CHANNEL_REQUIRED');
      const selected=await request(cfg,projectRoute+'/releases/'+release,{token,transport});check(selected.commit===git(root,'rev-parse','HEAD'),'MOBILE_RELEASE_SOURCE_MISMATCH');planLaunchMobile(root,{kind:'apk',expectedCommit:selected.commit,env});await requireMobileReleaseGates(root,selected.artifact?.sha256??selected.artifact_sha256,mode);
      if(mode==='approve'){check(sha256Re.test(digest??''),'MOBILE_RELEASE_DIGEST_REQUIRED');payload={release_id:release,channel,release_digest:digest};suffix='approvals';}
      else{payload={release_id:release,channel,rollout_percent:100};suffix='promotions';}
    }
    const result=await request(cfg,projectRoute+'/'+suffix,{method:'POST',token,body:payload,transport});
    const status=mode==='release'?'RELEASE_READY':mode==='publish'?'PUBLISHED':'RECORDED';
    const lifecycleState=mode==='release'?'RELEASE_READY':mode==='publish'?'PUBLISHED':'APPROVED';
    return {schemaVersion:schema,status,lifecycleState,releaseReady:true,published:mode==='publish',operation:mode,result};
  }

  if(mode==='agents'){
    check(caps.capabilities.includes('agents.list'),'MOBILE_INCOMPATIBLE_SERVICE');
    const result=await request(cfg,projectRoute+'/agents',{token,transport});
    check(Array.isArray(result.agents),'MOBILE_AGENTS_INVALID');
    return {schemaVersion:schema,status:'CONNECTED',projectId:cfg.projectId,agents:result.agents.map(a=>({workerId:a.worker_id,platform:a.platform,status:a.status,
      presence:a.presence??'UNKNOWN',lastSeenAt:a.last_seen_at??null,desiredState:a.desired_state??null,capabilities:a.capabilities}))};
  }
  if(mode==='cancel'){
    check(authorize===true,'MOBILE_CANCEL_AUTHORIZATION_REQUIRED');
    check(typeof job==='string'&&uuidRe.test(job),'MOBILE_JOB_ID_INVALID');
    check(caps.capabilities.includes('jobs.cancel'),'MOBILE_INCOMPATIBLE_SERVICE');
    const r=await request(cfg,route+'/'+job+'/cancel',{method:'POST',token,body:{reason:'executionkit-launch-os'},transport});
    check(r.id===job&&r.state==='CANCELLED','MOBILE_CANCEL_RESPONSE_INVALID');
    return {schemaVersion:schema,status:'CANCELLED',projectId:cfg.projectId,jobId:job,previousState:r.previous_state??null};
  }
  if(mode==='control'){
    check(authorize===true,'MOBILE_CONTROL_AUTHORIZATION_REQUIRED');
    check(typeof worker==='string'&&slug.test(worker)&&['ACTIVE','PAUSED','STOP'].includes(desired),'MOBILE_DIRECTIVE_INVALID');
    check(caps.capabilities.includes('agents.control'),'MOBILE_INCOMPATIBLE_SERVICE');
    const r=await request(cfg,projectRoute+'/agents/control',{method:'POST',token,body:{worker_id:worker,desired},transport});
    check(r.worker_id===worker&&r.desired===desired,'MOBILE_CONTROL_RESPONSE_INVALID');
    return {schemaVersion:schema,status:'DIRECTED',projectId:cfg.projectId,workerId:worker,desired,effective:r.effective??null};
  }
  if(mode==='status'){
    const result=await request(cfg,route+'?limit=50',{token,transport});
    check(Array.isArray(result.items),'MOBILE_JOBS_INVALID');
    return {schemaVersion:schema,status:'CONNECTED',projectId:cfg.projectId,executionModel:'LOCAL_WORKSTATION_DIRECT',mobileUpdateStrategy:cfg.mobileUpdateStrategy,buildAgentRequired:false,shorebirdRequired:false,jobs:result.items.map(x=>({id:x.id,state:x.state,leaseUntil:x.lease_until??null,commit:x.data?.commit??null,kind:x.data?.kind??null,attempts:x.attempts??null,outcomeReason:x.outcome_reason??null}))};
  }
  const plan=planLaunchMobile(root,{kind,expectedCommit,env});
  const queued=await request(cfg,route,{method:'POST',token,body:{commit:plan.sourceCommit,kind},transport});
  check(queued.project===cfg.projectId&&queued.commit===plan.sourceCommit&&queued.kind===kind&&typeof queued.id==='string','MOBILE_ENQUEUE_RESPONSE_INVALID');
  return {schemaVersion:schema,status:'QUEUED',projectId:cfg.projectId,jobId:queued.id,sourceCommit:plan.sourceCommit,kind,productionAuthorization:false};
}


