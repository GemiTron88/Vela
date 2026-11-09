import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './execution-model.mjs';
import { spawnPortableSync } from './portable-process.mjs';

export const V4_SUPPORTED_PLATFORMS=Object.freeze(['linux','win32','darwin']);
export const V4_SUPPORTED_TARGETS=Object.freeze([
  'linux-x64',
  'linux-arm64',
  'win32-x64',
  'win32-arm64',
  'darwin-arm64',
  'darwin-x64'
]);
const runtimeRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const CORE_FILES=[
  'bin/executionkit-cli.mjs',
  'bin/integrate-antigravity-v4.mjs',
  'bin/antigravity-v4-hook.mjs',
  'bin/state-status.mjs',
  'bin/state-rehydrate.mjs',
  'bin/state-checkpoint.mjs',
  'bin/state-amnesia-test.mjs',
  'bin/repository-providers.mjs',
  'bin/repository-intelligence.mjs',
  'bin/documentation-fabric.mjs',
  'bin/seo-os.mjs',
  'bin/audit-project.mjs',
  'bin/test-project.mjs',
  'bin/production-deployment.mjs',
  'lib/v4-kernel.mjs',
  'lib/v4-boundary.mjs',
  'lib/v4-activation.mjs',
  'lib/v4-control-plane.mjs',
  'lib/v4-platform.mjs',
  'lib/portable-process.mjs',
  'lib/v4-test-os.mjs',
  'lib/v4-gate-identity.mjs',
  'lib/v4-installer.mjs',
  'lib/v4-source.mjs',
  'lib/v4-product-closure.mjs',
  'lib/v4-reconcile.mjs',
  'lib/v4-agent-runtime.mjs',
  'lib/v4-knowledge-runtime.mjs',
  'lib/v4-content-os.mjs',
  'lib/v4-seo-os.mjs',
  'lib/v4-systems-status.mjs',
  'lib/visual-os.mjs',
  'lib/state-model.mjs',
  'lib/production-deployment.mjs',
  'lib/repository-provider-deployment.mjs'
];
const FORBIDDEN=[
  {code:'V4_PLATFORM_BASH_HARDCODED',re:/\b(?:spawnSync|execFileSync|execSync)\s*\(\s*['"](?:bash|sh)['"]/},
  {code:'V4_PLATFORM_WINDOWS_SHELL_HARDCODED',re:/\b(?:spawnSync|execFileSync|execSync)\s*\(\s*['"](?:cmd(?:\.exe)?|powershell(?:\.exe)?|pwsh(?:\.exe)?)['"]/i},
  {code:'V4_PLATFORM_SHELL_EXEC_SYNC',re:/\bexecSync\s*\(/},
  {code:'V4_PLATFORM_POSIX_TMP_HARDCODED',re:/['"]\/tmp\//},
];
function nodeMajor(){return Number(String(process.versions.node??'0').split('.')[0]||0);}
function executable(command,args=['--version']){
  const r=spawnSync(command,args,{encoding:'utf8',timeout:15000,windowsHide:true,shell:false});
  return {available:!r.error&&r.status===0,exitCode:r.status,version:String(r.stdout||r.stderr||'').trim().split(/\r?\n/)[0]||null,error:r.error?.message??null};
}
function automaticCommandIssues(config){
  const errors=[];
  for(const boundary of ['wave','phase']){
    const values=config.v4?.systems?.test?.commands?.[boundary]??[];
    if(!Array.isArray(values)){errors.push({code:'V4_PLATFORM_TEST_COMMANDS_INVALID',boundary,message:'Test OS automatic commands must be arrays'});continue;}
    values.forEach((item,index)=>{
      if(typeof item==='string')errors.push({code:'V4_PLATFORM_SHELL_TEST_COMMAND',boundary,index,message:'Automatic '+boundary+' Test OS command must use portable {command,args}, not a shell string'});
      else if(!item||typeof item.command!=='string'||!Array.isArray(item.args??[]))errors.push({code:'V4_PLATFORM_TEST_COMMAND_INVALID',boundary,index,message:'Automatic '+boundary+' Test OS command is not a portable structured command'});
    });
  }
  for(const key of ['buildCommands','preActivateCommands','postActivateCommands','smokeCommands']){
    const values=config.deployment?.[key]??[];
    if(!Array.isArray(values)){errors.push({code:'V4_PLATFORM_DEPLOY_COMMANDS_INVALID',key,message:'Deployment '+key+' must be an array'});continue;}
    values.forEach((item,index)=>{
      if(!item||typeof item!=='object'||typeof item.command!=='string'||!Array.isArray(item.args??[]))errors.push({code:'V4_PLATFORM_DEPLOY_COMMAND_INVALID',key,index,message:'Deployment commands must use portable structured {command,args}'});
    });
  }
  return errors;
}
export function auditV4CorePortability(sourceRoot=runtimeRoot){
  const errors=[];
  for(const rel of CORE_FILES){
    const file=path.join(sourceRoot,...rel.split('/'));
    if(!fs.existsSync(file)){errors.push({code:'V4_PLATFORM_CORE_FILE_MISSING',path:rel,message:'Portable v4 core file is missing: '+rel});continue;}
    const text=fs.readFileSync(file,'utf8');
    for(const rule of FORBIDDEN)if(rule.re.test(text))errors.push({code:rule.code,path:rel,message:'v4 core contains a platform-specific shell assumption'});
  }
  return {status:errors.length?'FAIL':'PASS',files:CORE_FILES,errors};
}
export function inspectV4Platform(root,{platform=process.platform,nodeVersion=process.versions.node}={}){
  root=path.resolve(root);
  const {config}=loadConfig(root),errors=[],warnings=[];
  const normalized=String(platform).toLowerCase();
  if(!V4_SUPPORTED_PLATFORMS.includes(normalized))errors.push({code:'V4_PLATFORM_UNSUPPORTED',platform:normalized,message:'v4 CLI supports Linux, Windows and macOS'});
  const major=Number(String(nodeVersion??'0').split('.')[0]||0);
  if(!Number.isFinite(major)||major<20)errors.push({code:'V4_PLATFORM_NODE_TOO_OLD',nodeVersion,message:'ExecutionKit v4 requires Node.js >= 20'});
  const git=executable('git');
  if(!git.available)errors.push({code:'V4_PLATFORM_GIT_UNAVAILABLE',message:'Git executable is required by the v4 CLI',error:git.error});
  const osPolicy=(config.ci?.allowedRunnerOS??[]).map((x)=>String(x).toLowerCase());
  for(const os of ['linux','windows','macos'])if(!osPolicy.includes(os))errors.push({code:'V4_PLATFORM_RUNNER_OS_POLICY_MISSING',os,message:'Self-hosted runner policy must allow '+os});
  const projectRunnerLabel=String(config.ci?.projectRunnerLabel??'').trim();
  if(!/^project-[a-z0-9][a-z0-9._-]*$/i.test(projectRunnerLabel)||projectRunnerLabel.includes('['))errors.push({code:'V4_PLATFORM_PROJECT_RUNNER_LABEL_INVALID',projectRunnerLabel,message:'A concrete project-specific self-hosted runner label is required (project-<ascii-slug>)'});
  errors.push(...automaticCommandIssues(config));
  const configuredRuntime=String(config.installation?.runtimePath??'').trim();
  const portabilityRoot=configuredRuntime?path.resolve(root,configuredRuntime):runtimeRoot;
  const core=auditV4CorePortability(portabilityRoot);
  errors.push(...core.errors);
  let npmProbe;
  try{
    const portable=spawnPortableSync('npm',['--version'],{encoding:'utf8',timeout:15000,windowsHide:true});
    const r=portable.result;
    npmProbe={available:!r.error&&r.status===0,exitCode:r.status,version:String(r.stdout||r.stderr||'').trim().split(/\r?\n/)[0]||null,error:r.error?.message??null,invocation:portable.invocation};
  }catch(error){npmProbe={available:false,exitCode:null,version:null,error:error.message,invocation:null};}
  if(!npmProbe.available)warnings.push({code:'V4_PLATFORM_NPM_UNAVAILABLE',message:'npm is unavailable; optional managed provider installation may be unavailable although core CLI remains usable',error:npmProbe.error});
  return {
    schemaVersion:'executionkit-v4-platform/v1',
    status:errors.length?'FAIL':'PASS',
    current:{platform:normalized,nodeVersion:String(nodeVersion),nodeMajor:major,git,npm:npmProbe},
    portabilityRoot,
    supportedPlatforms:[...V4_SUPPORTED_PLATFORMS],
    supportedTargets:[...V4_SUPPORTED_TARGETS],
    executionRuntime:resolveExecutionRuntime(root,{platform:normalized}),
    runnerPolicy:{projectRunnerLabel,allowedOs:osPolicy,maxProjectRunnersPerDevice:config.ci?.maxProjectRunnersPerDevice??null},
    shellPolicy:{automaticTestCommands:'structured-portable-adapter',deploymentCommands:'structured-portable-adapter',windowsBatchStrategy:'ComSpec-allowlisted-structured-args',taskDebugShell:'manual-only'},
    corePortability:core,
    errors,warnings,
    observedAt:new Date().toISOString()
  };
}

export function detectPlatformArchitecture(platform=process.platform,arch=process.arch){
  const normPlatform=String(platform).toLowerCase();
  const normArch=String(arch).toLowerCase();
  return {platform:normPlatform,arch:normArch,targetId:`${normPlatform}-${normArch}`};
}

export function getPlatformSupportStrategy(platform=process.platform,arch=process.arch){
  const {platform:p,arch:a,targetId}=detectPlatformArchitecture(platform,arch);
  if(!V4_SUPPORTED_PLATFORMS.includes(p)){
    return {
      strategy:'UNSUPPORTED',
      targetId,
      platform:p,
      arch:a,
      seaSupported:false,
      reason:`Platform ${p} is not supported. v4 CLI supports Linux, Windows and macOS.`
    };
  }

  // macOS Intel/x64 uses project-local pinned Node runtime fallback until upstream SEA is maintained
  if(p==='darwin'&&(a==='x64'||a==='ia32')){
    return {
      strategy:'PINNED_NODE_FALLBACK',
      targetId,
      platform:p,
      arch:a,
      seaSupported:false,
      reason:'macOS Intel/x64 uses project-local exact-pinned Node runtime fallback.'
    };
  }

  const supportedSeaTargets=new Set(['linux-x64','linux-arm64','win32-x64','win32-arm64','darwin-arm64']);
  if(supportedSeaTargets.has(targetId)){
    return {
      strategy:'STANDALONE_SEA',
      targetId,
      platform:p,
      arch:a,
      seaSupported:true,
      reason:`Native standalone Single Executable Application is supported on ${targetId}.`
    };
  }

  return {
    strategy:'PINNED_NODE_FALLBACK',
    targetId,
    platform:p,
    arch:a,
    seaSupported:false,
    reason:`Platform architecture ${targetId} falls back to project-local pinned Node runtime.`
  };
}

export function buildArtifactIdentity({
  sourceSha,
  targetId,
  platform,
  arch,
  strategy,
  sha256=null,
  runtimeIdentity=`node-${process.versions.node}`,
  version='4.0.0-dev',
  signing=null
}={}){
  const detected=detectPlatformArchitecture(platform,arch);
  const plat=detected.platform;
  const arc=detected.arch;
  const tid=targetId??detected.targetId;
  const strat=strategy??getPlatformSupportStrategy(plat,arc).strategy;

  return {
    schemaVersion:'executionkit-v4-artifact-identity/v1',
    targetId:tid,
    platform:plat,
    arch:arc,
    strategy:strat,
    version,
    sourceSha:String(sourceSha??'').trim(),
    runtimeIdentity,
    sha256:sha256?String(sha256).toLowerCase():null,
    signing:signing??{
      status:'UNSIGNED_DEVELOPER_BUILD',
      tool:null,
      authority:null,
      notarized:false,
      verified:true
    },
    builtAt:new Date().toISOString()
  };
}

export function verifyArtifactIntegrity(filePath,expectedMetadata=null){
  if(!fs.existsSync(filePath)){
    return {valid:false,code:'ARTIFACT_MISSING',message:`Artifact file not found: ${filePath}`};
  }
  const stat=fs.statSync(filePath);
  if(!stat.isFile()){
    return {valid:false,code:'ARTIFACT_NOT_FILE',message:`Artifact path is not a file: ${filePath}`};
  }

  if(process.platform!=='win32'){
    const isExecutable=Boolean(stat.mode&0o111);
    if(!isExecutable){
      return {valid:false,code:'ARTIFACT_NOT_EXECUTABLE',message:`Artifact file lacks executable permission: ${filePath}`};
    }
  }

  const content=fs.readFileSync(filePath);
  const digest=crypto.createHash('sha256').update(content).digest('hex');

  if(expectedMetadata?.sha256){
    const expected=String(expectedMetadata.sha256).toLowerCase();
    if(digest!==expected){
      return {
        valid:false,
        code:'ARTIFACT_DIGEST_MISMATCH',
        message:`Artifact digest ${digest} does not match expected ${expected}`,
        actualDigest:digest,
        expectedDigest:expected
      };
    }
  }

  return {
    valid:true,
    code:'VALID',
    filePath,
    sha256:digest,
    sizeBytes:stat.size,
    mode:stat.mode&0o777,
    signing:expectedMetadata?.signing??{status:'UNSIGNED_DEVELOPER_BUILD'}
  };
}

export function resolveExecutionRuntime(projectRoot,{platform=process.platform,arch=process.arch}={}){
  const root=path.resolve(projectRoot);
  const binaryExt=platform==='win32'?'.exe':'';
  const localBinary=path.join(root,'.executionkit','bin',`executionkit${binaryExt}`);
  const pinnedNode=path.join(root,'.executionkit','runtime','node','bin',`node${binaryExt}`);
  const installedCli=path.join(root,'.executionkit','runtime','kit','bin','executionkit-cli.mjs');
  const metadataPath=path.join(root,'.executionkit','bin','artifact-identity.json');

  // 1. Prefer verified project-local standalone executable
  if(fs.existsSync(localBinary)){
    let expected=null;
    if(fs.existsSync(metadataPath)){
      try{expected=JSON.parse(fs.readFileSync(metadataPath,'utf8'));}catch{}
    }
    const check=verifyArtifactIntegrity(localBinary,expected);
    if(check.valid){
      return {
        type:'STANDALONE_BINARY',
        executable:localBinary,
        args:[],
        verified:true,
        metadata:expected
      };
    }
  }

  // 2. Verified project-local pinned Node runtime + canonical JS CLI fallback
  if(fs.existsSync(pinnedNode)&&fs.existsSync(installedCli)){
    return {
      type:'PINNED_NODE_FALLBACK',
      executable:pinnedNode,
      args:[installedCli],
      verified:true,
      metadata:{runtimePath:pinnedNode,cliPath:installedCli}
    };
  }

  // 3. Project-local installed JS CLI with current Node
  if(fs.existsSync(installedCli)){
    return {
      type:'PROJECT_LOCAL_CLI',
      executable:process.execPath,
      args:[installedCli],
      verified:true,
      metadata:{cliPath:installedCli}
    };
  }

  // 4. Source Kit fallback (running within the source checkout)
  if(root===runtimeRoot){
    const sourceCli=path.join(runtimeRoot,'bin','executionkit-cli.mjs');
    if(fs.existsSync(sourceCli)){
      return {
        type:'SOURCE_KIT_CLI',
        executable:process.execPath,
        args:[sourceCli],
        verified:true,
        metadata:{cliPath:sourceCli}
      };
    }
  }

  return {
    type:'UNCONFIGURED',
    executable:null,
    args:[],
    verified:false,
    error:'No valid ExecutionKit execution runtime found for project.'
  };
}

export function signWindowsBinary(binaryPath,{certificatePath=null,password=null,timestampServer='http://timestamp.digicert.com'}={}){
  if(!certificatePath||!fs.existsSync(certificatePath)){
    return {
      signed:false,
      status:'UNSIGNED_DEVELOPER_BUILD',
      reason:'No Windows code-signing certificate provided; artifact remains an unsigned developer build.'
    };
  }
  const signtool=spawnSync('signtool.exe',['sign','/f',certificatePath,'/p',password??'','/t',timestampServer,binaryPath],{
    encoding:'utf8',
    windowsHide:true
  });
  if(signtool.status===0){
    return {signed:true,status:'SIGNED',tool:'signtool.exe',timestampServer};
  }
  return {signed:false,status:'SIGNING_FAILED',error:signtool.stderr||signtool.stdout};
}

export function signMacBinary(binaryPath,{identity=null,entitlementsPath=null}={}){
  if(!identity){
    return {
      signed:false,
      status:'UNSIGNED_DEVELOPER_BUILD',
      reason:'No Apple Developer signing identity provided; artifact remains an unsigned developer build.'
    };
  }
  const args=['--force','--sign',identity];
  if(entitlementsPath&&fs.existsSync(entitlementsPath)){
    args.push('--entitlements',entitlementsPath);
  }
  args.push(binaryPath);
  const codesign=spawnSync('codesign',args,{encoding:'utf8',windowsHide:true});
  if(codesign.status===0){
    return {signed:true,status:'SIGNED',identity};
  }
  return {signed:false,status:'SIGNING_FAILED',error:codesign.stderr||codesign.stdout};
}

export function notarizeMacBinary(binaryPath,{appleId=null,password=null,teamId=null}={}){
  if(!appleId||!password||!teamId){
    return {
      notarized:false,
      status:'NOT_NOTARIZED',
      reason:'Apple notarization credentials not provided; skipping notarization for developer build.'
    };
  }
  const notary=spawnSync('xcrun',['notarytool','submit',binaryPath,'--apple-id',appleId,'--password',password,'--team-id',teamId,'--wait'],{
    encoding:'utf8',
    windowsHide:true
  });
  if(notary.status===0){
    return {notarized:true,status:'NOTARIZED'};
  }
  return {notarized:false,status:'NOTARIZATION_FAILED',error:notary.stderr||notary.stdout};
}
