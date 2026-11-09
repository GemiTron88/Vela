import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './execution-model.mjs';
import { spawnPortableSync } from './portable-process.mjs';
import { V5_STANDARD_TARGET } from './v5-config.mjs';

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
  'lib/route-integrity.mjs',
  'lib/v4-boundary.mjs',
  'lib/v4-activation.mjs',
  'lib/v4-control-plane.mjs',
  'lib/v4-platform.mjs',
  'lib/portable-process.mjs',
    'lib/native-host-policy.mjs',
  'lib/v4-test-os.mjs',
  'lib/test-portfolio.mjs',
  'lib/v4-gate-identity.mjs',
  'lib/v4-installer.mjs',
  'lib/v4-source.mjs',
  'lib/v4-product-closure.mjs',
  'lib/v4-reconcile.mjs',
  'lib/v4-agent-runtime.mjs',
  'lib/v4-knowledge-runtime.mjs',
  'lib/v4-content-os.mjs',
  'lib/v4-context-economy.mjs',
  'lib/v4-seo-os.mjs',
  'lib/v4-systems-status.mjs',
  'lib/visual-os.mjs',
  'lib/visual-production.mjs',
  'lib/visual-production-plan.mjs',
  'lib/media-integrity.mjs',
  'lib/media-decode.py',
  'contracts/visual-production-v5-contract.md',
  'templates/visual/executionkit.media.json',
  'lib/visual-audit.mjs',
  'lib/visual-boundary.mjs',
  'lib/visual-capture.mjs',
  'lib/visual-contract.mjs',
  'lib/visual-critic.mjs',
  'lib/visual-enums.mjs',
  'lib/visual-geometry.mjs',
  'lib/visual-image.mjs',
  'lib/visual-journeys.mjs',
  'lib/visual-schema.mjs',
    'lib/visual-schema-compiled.cjs',
    'lib/visual-schema-runtime/ucs2length.cjs',
    'lib/visual-schema-runtime/formats.cjs',
    'lib/visual-schema-runtime/NOTICE.md',
    'lib/visual-schema-runtime/provenance.json',
  'lib/visual-surface.mjs',
  'lib/visual-trace.mjs',
  'bin/visual-project.mjs',
  'bin/visual-boundary.mjs',
  'lib/state-model.mjs',
  'lib/production-deployment.mjs','lib/vhost-guard.mjs',
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
  const executionRuntime=resolveExecutionRuntime(root,{platform:normalized});
  if(normalized==='linux'&&configuredRuntime&&executionRuntime.type!=='STANDALONE_BINARY')warnings.push({code:'V4_PORTABLE_BINARY_NOT_ACTIVE',message:'Installed Linux project is using the Node CLI. Run executionkit platform provision . and apply the exact-source update command it returns.',executionRuntime:executionRuntime.type});
  return {
    schemaVersion:'executionkit-v4-platform/v1',
    status:errors.length?'FAIL':'PASS',
    current:{platform:normalized,nodeVersion:String(nodeVersion),nodeMajor:major,git,npm:npmProbe},
    portabilityRoot,
    supportedPlatforms:[...V4_SUPPORTED_PLATFORMS],
    supportedTargets:[...V4_SUPPORTED_TARGETS],
    executionRuntime,
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
  targetPlatform,
  arch,
  targetArch,
  strategy,
  sha256=null,
  runtimeIdentity=`node-${process.versions.node}`,
  version='4.1.0',
  signing=null
}={}){
  const detected=detectPlatformArchitecture(platform??targetPlatform,arch??targetArch);
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

  if(!/^[a-f0-9]{64}$/i.test(String(expectedMetadata?.sha256??''))){
    return {valid:false,code:'ARTIFACT_IDENTITY_MISSING',message:`A valid SHA-256 identity is required for executable artifact: ${filePath}`};
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
    const targetId=detectPlatformArchitecture(platform,arch).targetId;
    let installedSource=null;
    try{installedSource=JSON.parse(fs.readFileSync(path.join(root,'.executionkit','installation.json'),'utf8')).sourceCommit??null;}catch{}
    const identityMatches=expected?.targetId===targetId&&expected?.platform===platform&&expected?.arch===arch
      && /^[a-f0-9]{40}$/i.test(String(expected?.sourceSha??''))
      && (!installedSource||installedSource===expected.sourceSha);
    if(check.valid&&identityMatches){
      return {
        type:'STANDALONE_BINARY',
        executable:localBinary,
        args:[],
        verified:true,
        metadata:expected
      };
    }
  }

  // 2. Pinned Node runtime requires its own digest; a file named node is not proof.
  if(fs.existsSync(pinnedNode)&&fs.existsSync(installedCli)){
    let pinnedIdentity=null;
    try{pinnedIdentity=JSON.parse(fs.readFileSync(path.join(root,'.executionkit','runtime','node','artifact-identity.json'),'utf8'));}catch{}
    const pinnedCheck=verifyArtifactIntegrity(pinnedNode,pinnedIdentity);
    if(pinnedCheck.valid&&pinnedIdentity?.targetId===detectPlatformArchitecture(platform,arch).targetId)return {
      type:'PINNED_NODE_FALLBACK',
      executable:pinnedNode,
      args:[installedCli],
      verified:true,
      metadata:{...pinnedIdentity,runtimePath:pinnedNode,cliPath:installedCli}
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

  // 4. Source Kit fallback (running within any ExecutionKit v4/v5 source checkout)
  if(root===runtimeRoot||(fs.existsSync(path.join(root,'bin','executionkit-cli.mjs'))&&fs.existsSync(path.join(root,'STANDARD_V5.md')))){
    const sourceCli=path.join(root,'bin','executionkit-cli.mjs');
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

let cachedNodeBinary=null;
let cachedNodeEnvKey=null;
export function resolveNodeBinary(){
  const envKey=`${process.env.EXECUTIONKIT_NODE_PATH||''}|${process.execPath}`;
  if(cachedNodeBinary&&cachedNodeEnvKey===envKey)return cachedNodeBinary;
  if(!process.env.EXECUTIONKIT_NODE_PATH&&!process.sea&&/^node(?:\.exe)?$/i.test(path.basename(process.execPath))){
    cachedNodeEnvKey=envKey;
    cachedNodeBinary=process.execPath;
    return cachedNodeBinary;
  }
  const isWindows=process.platform==='win32';
  const binaryName=isWindows?'node.exe':'node';
  const isRealNode=(candidate)=>{
    if(!candidate||typeof candidate!=='string')return false;
    try{
      if(!fs.existsSync(candidate)||!fs.statSync(candidate).isFile())return false;
      const check=spawnSync(candidate,['-e','process.stdout.write("OK_NODE")'],{
        encoding:'utf8',
        timeout:5000,
        windowsHide:true,
        shell:false
      });
      return check.status===0&&check.stdout==='OK_NODE';
    }catch{
      return false;
    }
  };

  if(process.env.EXECUTIONKIT_NODE_PATH&&isRealNode(process.env.EXECUTIONKIT_NODE_PATH)){
    cachedNodeEnvKey=envKey;
    return (cachedNodeBinary=process.env.EXECUTIONKIT_NODE_PATH);
  }
  if(isRealNode(process.execPath)){
    cachedNodeEnvKey=envKey;
    return (cachedNodeBinary=process.execPath);
  }

  const pathDirs=(process.env.PATH||'').split(path.delimiter);
  for(const dir of pathDirs){
    const candidate=path.join(dir,binaryName);
    if(isRealNode(candidate)){
      cachedNodeEnvKey=envKey;
      return (cachedNodeBinary=candidate);
    }
  }

  const standardDirs=isWindows?[]:['/usr/local/bin','/usr/bin','/bin'];
  for(const dir of standardDirs){
    const candidate=path.join(dir,binaryName);
    if(isRealNode(candidate)){
      cachedNodeEnvKey=envKey;
      return (cachedNodeBinary=candidate);
    }
  }

  cachedNodeEnvKey=envKey;
  return (cachedNodeBinary=process.execPath);
}

export const GLOBAL_HOST_CONTRACT_START='<!-- EXECUTIONKIT:GLOBAL_HOST_CONTRACT START -->';
export const GLOBAL_HOST_CONTRACT_END='<!-- EXECUTIONKIT:GLOBAL_HOST_CONTRACT END -->';

export function resolveInstalledKitVersion(root=null,explicitVersion=null){
  if(typeof explicitVersion==='string'&&explicitVersion.trim())return explicitVersion.trim();
  const candidates=[];
  if(root){
    const resolvedRoot=path.resolve(root);
    const receiptPath=path.join(resolvedRoot,'.executionkit','installation.json');
    if(fs.existsSync(receiptPath)){
      try{
        const receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
        if(typeof receipt?.version==='string'&&receipt.version.trim())return receipt.version.trim();
      }catch{}
    }
    candidates.push(
      path.join(resolvedRoot,'.executionkit','runtime','kit','VERSION'),
      path.join(resolvedRoot,'VERSION')
    );
  }
  candidates.push(path.join(runtimeRoot,'VERSION'));
  for(const candidate of candidates){
    if(fs.existsSync(candidate)){
      try{
        const v=fs.readFileSync(candidate,'utf8').trim();
        if(v)return v;
      }catch{}
    }
  }
  return V5_STANDARD_TARGET;
}

function renderLegacyUnmarkedGlobalHostContract(resolvedVersion){
  return [
    '# AGENTS.md — Global Machine Operator Contract',
    '',
    `**Environment:** Antigravity Global AI Execution Layer | **Engine:** ExecutionKit Standard (\`${resolvedVersion}\`)  `,
    '**Mode:** CLI-first, MCP-free, Native Repository Intelligence, Bundled Deterministic Decision OS  ',
    '**Global CLI:** `executionkit` (in PATH; delegates to project `.executionkit/runtime/kit` or local kit checkout, else standalone engine)',
    '',
    '## 1. Universal Execution Principles',
    '',
    '1. **One Product / Repository Truth:** Live source, tests, schemas, Git branch/HEAD, and environment evidence outrank chat, prose plans, State, or external memory (`ADVISORY_ONLY`).',
    '2. **Canonical Task Authority:** Root `TODO.md` is the sole entrypoint; mutable status lives only in declared `todo/*.md` shards. Zero shadow backlogs. After each task: verify, update shard, sync `brain/task.md`, commit, push, and continue.',
    '3. **Boundary Cadence:** Deep Test, Audit, Content, SEO, Docs, Visual OS, and Launch suites run only at declared `wave`/`phase`/`release` boundaries, never after ordinary edits.',
    '4. **No MCP & No Restart Ritual:** Operations are CLI-first and host-native; MCP servers and editor restart/reopen steps are disabled.',
    '5. **Database Integrity (`NEVER_GUESS_DATABASE_TRUTH`):** Never guess tables, columns, relations, or types. Query `executionkit db table|column|model` and run `executionkit db guard` before schema/query mutations.',
    '6. **State OS Continuity:** Rehydrate at session start, checkpoint at task/boundary milestones, and preserve zero-context recovery (`executionkit state amnesia .`).',
    '7. **Self-Update Compliance:** When the envelope reports `V4_UPDATE_AVAILABLE`, run `executionkit self-update apply .` before product work.',
    '8. **Production-Ready & Anti-Fabrication Invariant:** Zero mocks, stubs, demo data, `// TODO` placeholders, or fake success in production paths. Never fabricate test outputs, metrics, screenshots, or PASS receipts. Enforce enterprise error handling, validation, security, accessibility, and clean architecture.',
    '9. **Headless VPS & Mobile Boundary:** Never run `flutter build apk|appbundle|ipa`, `./gradlew assemble*`, Android SDK/NDK installs, or emulators/simulators on this headless VPS. Permitted VPS Flutter checks: `flutter analyze`, `dart analyze`, `dart format`, `flutter pub get`, and `flutter test`. Native mobile binary builds require an enrolled physical workstation (`executionkit launch mobile`).',
    '10. **Targeted Test Execution (Zero Waste):** For task/module verification, run ONLY targeted tests (`executionkit test task . --target <file> [--filter <pattern>]`, `php artisan test --filter=...`, `pytest -k ...`, `flutter test <file>`). Never run full suites for granular checks.',
    '11. **Portable CLI Mandate:** Always use `executionkit <command>` (or `./.executionkit/bin/ek <command>`). Never run raw `node bin/*.mjs` or `node --test` commands.',
    '12. **Codeblock Task Completion & Nested Fence Invariant:** Always wrap task/phase completion reports in a copyable fenced codeblock; if the report contains inner ``` blocks, use 4+ backticks (````markdown ... ````) for the outer fence.',
    '',
    '## 2. Session Start, Atomic Task Closure & Parallel Agent OS',
    '',
    '```bash',
    'executionkit start . --host antigravity',
    '```',
    '',
    '1. **Reuse Envelope:** Obey `blocked`, `blockers`, `nextCommand`, and `contextPolicy`. Reuse the envelope across task edits; do not re-run `start`/`status` after every edit.',
    '2. **Atomic Task Closure:** Implement the earliest dependency-ready task, verify targeted behavior, and close atomically with `executionkit todo complete . --task <id> --verify "<cmd>" --apply`, then commit and push.',
    '3. **Parallel Agent OS (`Parallel Safe: YES`):** When `hostAction` is `PREPARE_NATIVE_SUBAGENTS` or `SPAWN_NATIVE_SUBAGENTS`, run `executionkit agents run . [--boost]`, spawn one native subagent per `hostDelegations[]` using `workerPrompt`, and record its ID via `executionkit agents delegated . --claim <id> --spawn-tool <tool> --worker-id <id>` (or `executionkit agents decline . --reason HOST_SPAWN_UNAVAILABLE` if unavailable). Workers run `executionkit agents result <worktree> --status COMPLETED`; orchestrator runs `executionkit agents collect .`, `integrate . --claim <id> --apply`, and `cleanup . --claim <id>`.',
    '',
    '## 3. Global CLI Reference (38 Commands across 11 systems)',
    '',
    'Use `executionkit help <command>` on demand. All commands accept `[project]` (defaults to `.`) and `--json` / `--full-output`:',
    '',
    '| Domain | Portable CLI Commands |',
    '| :--- | :--- |',
    '| **Core & Decision** | `executionkit start\\|status\\|next [project] [--host antigravity] [--boost] [--deep]`, `executionkit systems status`, `executionkit decision status\\|advise\\|refresh\\|align [project] [--task <id>]`, `executionkit boundary wave\\|phase [project]`, `executionkit activation status\\|apply`, `executionkit product status\\|reconcile\\|discover\\|components`, `executionkit help [cmd]`, `executionkit version` |',
    '| **Backlog & Proof** | `executionkit todo status\\|maintain\\|migrate\\|complete [project] [--task <id>] [--verify <cmd>] [--apply]` (plus `todo archive`), `executionkit proof status\\|seal [project] [--task <id>] [--apply]`, `executionkit reconcile status\\|task\\|wave\\|phase\\|release [project]` |',
    '| **State & Agents** | `executionkit state status\\|rehydrate\\|checkpoint\\|amnesia\\|memory [project]`, `executionkit agents status\\|plan\\|run\\|collect\\|delegated\\|decline\\|integrate\\|reconcile\\|cleanup\\|result [project]` |',
    '| **Intel & Guards** | `executionkit knowledge status\\|refresh\\|search\\|impact\\|providers\\|context\\|auto\\|usage [project]`, `executionkit providers status\\|doctor`, `executionkit db status\\|refresh\\|guard\\|table\\|column\\|model [project]`, `executionkit route status\\|refresh\\|guard\\|probe [project]`, `executionkit guard all\\|assets\\|forms\\|lang\\|antifake\\|ux\\|flutter\\|visuals\\|perf\\|vhost [project] [--all\\|--files f1;f2]` |',
    '| **Quality Systems** | `executionkit docs status\\|refresh\\|build\\|validate\\|search [project]`, `executionkit content status\\|discover\\|validate [project]`, `executionkit seo status\\|validate [project]`, `executionkit visual status\\|validate\\|discover\\|plan\\|media-plan\\|media-check\\|capture\\|inspect\\|compare\\|remediate\\|certify\\|boundary [project]`, `executionkit test impact\\|portfolio\\|task\\|wave\\|phase\\|release\\|journeys\\|flakes\\|select [project] [--target <file>] [--filter <pattern>]`, `executionkit audit task\\|wave\\|phase\\|release\\|security\\|data-safety\\|health\\|quality\\|storage [project]` |',
    '| **Launch & Infra** | `executionkit launch status\\|plan\\|build\\|verify\\|host-plan\\|host-check\\|storage\\|providers\\|providers-discover\\|backup\\|release\\|deploy\\|rollback\\|mobile\\|service\\|validate-artifact\\|readiness [project]`, `executionkit control-plane status\\|verify-head`, `executionkit platform status\\|provision\\|sync-global [project] [--apply]` |',
    '| **Lifecycle & Doctor** | `executionkit install\\|update\\|upgrade\\|repair [project] [--apply\\|--auto\\|--dry-run]`, `executionkit self-update status\\|check\\|apply [project]`, `executionkit doctor [project] [--review\\|--cli-audit\\|--distribution]`, `executionkit rollback [project] --transaction <id>`, `executionkit upgrade-revalidation status\\|plan\\|run [project]` |',
    ''
  ].join('\n');
}

export function renderGlobalHostContract({version=null,root=null}={}){
  const resolvedVersion=resolveInstalledKitVersion(root,version);
  return [
    GLOBAL_HOST_CONTRACT_START,
    '# AGENTS.md — Global Machine Operator Contract',
    '',
    `**Environment:** Antigravity Global AI Execution Layer | **Engine:** ExecutionKit Standard (\`${resolvedVersion}\`)  `,
    '**Mode:** CLI-first, MCP-free, Native Repository Intelligence, Bundled Deterministic Decision OS  ',
    '**Global CLI:** `executionkit` (in PATH; delegates to project `.executionkit/runtime/kit` or local kit checkout, else standalone engine)',
    '',
    '## 1. Universal Execution Principles & Kit Detection',
    '',
    '0. **ExecutionKit Detection:** Detect an installed project-local ExecutionKit (`execution.config.json` / `.executionkit/installation.json`), follow the project\'s root `AGENTS.md`, canonical `TODO.md`, applicable contracts, and execution envelope via portable `executionkit`. Preserve custom project instructions and never force ExecutionKit behavior into repositories without an installed Kit.',
    '1. **One Product / Repository Truth:** Live source, tests, schemas, Git branch/HEAD, and environment evidence outrank chat, prose plans, State, or external memory (`ADVISORY_ONLY`).',
    '2. **Canonical Task Authority & Per-Task Git Push to `main`:** Root `TODO.md` is the sole entrypoint; mutable status lives only in declared `todo/*.md` shards. Zero shadow backlogs. After each completed task: verify, update shard (`executionkit todo complete . --task <id> --verify "<cmd>" --apply`), sync `brain/task.md`, immediately `git commit` and `git push origin main`, notify `TronNotif` via the ExecutionKit boundary signal, and continue to the next task.',
    '3. **Boundary Cadence:** Deep Test, Audit, Content, SEO, Docs, Visual OS, and Launch suites run only at declared `wave`/`phase`/`release` boundaries, never after ordinary edits.',
    '4. **No MCP & No Restart Ritual:** Operations are CLI-first and host-native; MCP servers and editor restart/reopen steps are disabled.',
    '5. **Database Integrity (`NEVER_GUESS_DATABASE_TRUTH`):** Never guess tables, columns, relations, or types. Query `executionkit db table|column|model` and run `executionkit db guard` before schema/query mutations.',
    '6. **State OS Continuity:** Rehydrate at session start, checkpoint at task/boundary milestones, and preserve zero-context recovery (`executionkit state amnesia .`).',
    '7. **Self-Update & Cross-Device Global `AGENTS.md` Sync:** When the envelope reports `V4_UPDATE_AVAILABLE`, run `executionkit self-update apply .` before product work. Keep Global `AGENTS.md` synchronized across all devices (`vps01`, `vps02`, `win`, `mac`) via `executionkit platform sync-global . --apply` (automatically applied during `self-update apply`, `install|update|upgrade|repair --apply`, and `start`).',
    '8. **Production-Ready & Anti-Fabrication Invariant:** Zero mocks, stubs, demo data, `// TODO` placeholders, or fake success in production paths. Never fabricate test outputs, metrics, screenshots, or PASS receipts. Enforce enterprise error handling, validation, security, accessibility, and clean architecture.',
    '9. **Headless VPS & Mobile Boundary:** Never run `flutter build apk|appbundle|ipa`, `./gradlew assemble*`, Android SDK/NDK installs, or emulators/simulators on this headless VPS. Permitted VPS Flutter checks: `flutter analyze`, `dart analyze`, `dart format`, `flutter pub get`, and `flutter test`. Native mobile binary builds require an enrolled physical workstation (`executionkit launch mobile`).',
    '10. **Targeted Test Execution (Zero Waste):** For task/module verification, run ONLY targeted tests (`executionkit test task . --target <file> [--filter <pattern>]`, `php artisan test --filter=...`, `pytest -k ...`, `flutter test <file>`). Never run full suites for granular checks.',
    '11. **Portable CLI Mandate:** Always use `executionkit <command>` (or `./.executionkit/bin/ek <command>`). Never run raw `node bin/*.mjs` or `node --test` commands.',
    '12. **Dual Completion Report (Simple Explanation + Copyable Codeblock Report):** Never wrap the entire final response in a single codeblock. First, write a clear, simple explanation in normal markdown (not inside a codeblock) explaining what was done; second, provide a separate structured summary report inside a copyable fenced codeblock (if the report contains inner ``` blocks, use 4+ backticks ````markdown ... ```` for the outer fence) so the owner can copy it easily.',
    '13. **Production Deployment After Full Completion (If Requested):** Once all canonical tasks are 100% completed, verified, committed, and pushed to `main`, if the owner requested production deployment, execute the canonical production release and deployment flow (`executionkit launch release .` and `executionkit launch deploy . --authorize`, or the project\'s canonical production deploy procedure when no Kit is installed), verify live production health, and emit the `execution.deploy.completed` signal to notify `TronNotif`.',
    '14. **Intelligent Design Refinement (`skill.design-refinement`) & Real Visual Critic Review:** Before creating or redesigning any UI surface, load `.agents/skills/design-refinement/SKILL.md` (`design-system -> component-system -> design-refinement -> premium-experience`), establish the 5-part Design Direction (`Product`, `Character`, `World`, `Moments`, `Signature`), select the honest intervention level (`No Change`, `Light Polish`, or `Full Refinement`), and apply the 9 anti-slop conceptual checks (`Spacing -> Color -> Icons -> Copy -> Typography -> Layout -> Details -> Visuals -> Motion`) in a single coherent pass using real project tokens/components and zero fabricated data. When Visual OS queues native review requests (`REVIEW_REQUIRED`), inspect the actual captured PNGs with native vision and submit schema-valid image-bound responses via `executionkit visual inspect . --run <runId> --cell <cellId> --response <file>` before `executionkit visual certify .`.',
    '',
    '## 2. Session Start, Atomic Task Closure, Production Deploy & Parallel Agent OS',
    '',
    '```bash',
    'executionkit start . --host antigravity',
    '```',
    '',
    '1. **Reuse Envelope:** Obey `blocked`, `blockers`, `nextCommand`, and `contextPolicy`. Reuse the envelope across task edits; do not re-run `start`/`status` after every edit.',
    '2. **Atomic Task Closure & Immediate Push to `main`:** Implement the earliest dependency-ready task, verify targeted behavior, close atomically with `executionkit todo complete . --task <id> --verify "<cmd>" --apply` (which emits `execution.task.completed` to `GemiXC` -> `TronNotif`), and immediately `git commit` and `git push origin main` after finishing each task.',
    '3. **Parallel Agent OS (`Parallel Safe: YES`):** When `hostAction` is `PREPARE_NATIVE_SUBAGENTS` or `SPAWN_NATIVE_SUBAGENTS`, run `executionkit agents run . [--boost]`, spawn one native subagent per `hostDelegations[]` using `workerPrompt`, and record its ID via `executionkit agents delegated . --claim <id> --spawn-tool <tool> --worker-id <id>` (or `executionkit agents decline . --reason HOST_SPAWN_UNAVAILABLE` if unavailable). Workers run `executionkit agents result <worktree> --status COMPLETED`; orchestrator runs `executionkit agents collect .`, `integrate . --claim <id> --apply`, and `cleanup . --claim <id>`.',
    '4. **Production Deployment When Fully Done (If Requested):** After all tasks and wave/phase boundaries (`executionkit boundary wave|phase .`) pass and are pushed to `main`, if the owner asked to deploy to production, run `executionkit launch release .` followed by `executionkit launch deploy . --authorize` (notifying `TronNotif` via `execution.deploy.completed`) and verify live production readiness.',
    '',
    '## 3. Verified Host Identity, Execution Signals (TronNotif) & Safe-Boundary Collaboration',
    '',
    '1. **Verified Host Identity (`vps01`, `vps02`, `win`, `mac`):** Derive host identity strictly from verified enrollment/runtime configuration (`lib/execution-signals.mjs`), never from guessed hostname, OS, or agent assertions. Never represent a missing or unverified host identity as verified.',
    '2. **Execution Signals & `TronNotif` Notification Center (`contracts/execution-signals-v1-contract.md`):** Notify the **TronNotif** notification center (`https://notif.gemitron.net` -> Studio `https://studio.gemitron.net/execution` via `GemiXC` `https://exec.gemitron.net`) through ExecutionKit boundary signals (`executionkit start`, `executionkit todo complete`, `executionkit boundary wave|phase`, `executionkit launch release|deploy`). Emit only genuine, evidence-backed signals (`execution.task.started`, `execution.task.completed`, `execution.task.blocked`, `execution.test.failed`, `execution.visual.review_required`, `execution.phase.completed`, `execution.release.verified`, `execution.deploy.completed`, `execution.rollback.completed`) and lifecycle transitions (`STARTING`, `ACTIVE`, `WAITING_REVIEW`, `WAITING_EXTERNAL`, `BLOCKED`, `FAILED`, `COMPLETED`, `DISCONNECTED`, `UNKNOWN`). Actionable owner notifications (`notify_owner: true`) are delivered to `TronNotif`. `COMPLETED` requires verified commit/evidence (`commitSha` + `evidenceRef`); single-task or parallel-worker completion never implies whole-project completion. Routine commands, tool calls, heartbeats (`notify_owner: false`), logs, and progress text must remain silent and never generate owner-notification spam.',
    '3. **Offline Authority & Collaboration (`docs/v5/V5_2_EXECUTION_COLLABORATION.md`):** Local execution, Decision OS, and Launch OS remain authoritative and cannot be bypassed. Optional signal/collaboration transport (`lib/execution-signals-outbox.mjs`, `lib/execution-collaboration.mjs`) is disabled by default with zero network/file I/O and never blocks tasks when disconnected. No implicit cloud/MCP/GemiIsland dependency; no secrets, transcripts, or raw logs in signals or State. When enabled at safe task/wave boundaries, project/run-scoped inbox messages are `UNTRUSTED_ADVISORY_ONLY` (7-day ephemeral policy) and cannot mutate `TODO.md`, approvals, or release gates.',
    '',
    '## 4. Global CLI Reference (38 Commands across 11 systems)',
    '',
    'Use `executionkit help <command>` on demand. All commands accept `[project]` (defaults to `.`) and `--json` / `--full-output`:',
    '',
    '| Domain | Portable CLI Commands |',
    '| :--- | :--- |',
    '| **Core & Decision** | `executionkit start\\|status\\|next [project] [--host antigravity] [--boost] [--deep]`, `executionkit systems status`, `executionkit decision status\\|advise\\|refresh\\|align [project] [--task <id>]`, `executionkit boundary wave\\|phase [project]`, `executionkit activation status\\|apply`, `executionkit product status\\|reconcile\\|discover\\|components`, `executionkit help [cmd]`, `executionkit version` |',
    '| **Backlog & Proof** | `executionkit todo status\\|maintain\\|migrate\\|complete [project] [--task <id>] [--verify <cmd>] [--apply]` (plus `todo archive`), `executionkit proof status\\|seal [project] [--task <id>] [--apply]`, `executionkit reconcile status\\|task\\|wave\\|phase\\|release [project]` |',
    '| **State & Agents** | `executionkit state status\\|rehydrate\\|checkpoint\\|amnesia\\|memory [project]`, `executionkit agents status\\|plan\\|run\\|collect\\|delegated\\|decline\\|integrate\\|reconcile\\|cleanup\\|result [project]` |',
    '| **Intel & Guards** | `executionkit knowledge status\\|refresh\\|search\\|impact\\|providers\\|context\\|auto\\|usage [project]`, `executionkit providers status\\|doctor`, `executionkit db status\\|refresh\\|guard\\|table\\|column\\|model [project]`, `executionkit route status\\|refresh\\|guard\\|probe [project]`, `executionkit guard all\\|assets\\|forms\\|lang\\|antifake\\|ux\\|flutter\\|visuals\\|perf\\|vhost [project] [--all\\|--files f1;f2]` |',
    '| **Quality Systems** | `executionkit docs status\\|refresh\\|build\\|validate\\|search [project]`, `executionkit content status\\|discover\\|validate [project]`, `executionkit seo status\\|validate [project]`, `executionkit visual status\\|validate\\|discover\\|plan\\|media-plan\\|media-check\\|capture\\|inspect\\|compare\\|remediate\\|certify\\|boundary [project]`, `executionkit test impact\\|portfolio\\|task\\|wave\\|phase\\|release\\|journeys\\|flakes\\|select [project] [--target <file>] [--filter <pattern>]`, `executionkit audit task\\|wave\\|phase\\|release\\|security\\|data-safety\\|health\\|quality\\|storage [project]` |',
    '| **Launch & Infra** | `executionkit launch status\\|plan\\|build\\|verify\\|host-plan\\|host-check\\|storage\\|providers\\|providers-discover\\|backup\\|release\\|deploy\\|rollback\\|mobile\\|service\\|validate-artifact\\|readiness [project]`, `executionkit control-plane status\\|verify-head`, `executionkit platform status\\|provision\\|sync-global [project] [--apply]` |',
    '| **Lifecycle & Doctor** | `executionkit install\\|update\\|upgrade\\|repair [project] [--apply\\|--auto\\|--dry-run]`, `executionkit self-update status\\|check\\|apply [project]`, `executionkit doctor [project] [--review\\|--cli-audit\\|--distribution]`, `executionkit rollback [project] --transaction <id>`, `executionkit upgrade-revalidation status\\|plan\\|run [project]` |',
    GLOBAL_HOST_CONTRACT_END,
    ''
  ].join('\n');
}

function countOccurrences(haystack,needle){
  let count=0,pos=0;
  while(true){
    const idx=haystack.indexOf(needle,pos);
    if(idx<0)break;
    count++;
    pos=idx+needle.length;
  }
  return count;
}

export function reconcileGlobalHostContract(existingContent,{version=null,root=null}={}){
  const resolvedVersion=resolveInstalledKitVersion(root,version);
  const fullRendered=renderGlobalHostContract({version:resolvedVersion,root});
  const managedCore=fullRendered.trimEnd();
  if(existingContent===null||existingContent===undefined){
    return {
      status:'TARGET_MISSING',
      action:'CREATE',
      version:resolvedVersion,
      changed:true,
      inSync:false,
      conflict:false,
      reason:null,
      content:fullRendered
    };
  }
  const raw=String(existingContent);
  const startCount=countOccurrences(raw,GLOBAL_HOST_CONTRACT_START);
  const endCount=countOccurrences(raw,GLOBAL_HOST_CONTRACT_END);
  const genericMarkerCount=countOccurrences(raw,'<!-- EXECUTIONKIT:GLOBAL_HOST_CONTRACT');
  const startIdx=raw.indexOf(GLOBAL_HOST_CONTRACT_START);
  const endIdx=raw.indexOf(GLOBAL_HOST_CONTRACT_END);
  if(startCount>1||endCount>1||startCount!==endCount||genericMarkerCount!==(startCount+endCount)||(startCount===1&&endIdx<startIdx)){
    return {
      status:'CONFLICT',
      action:'CONFLICT',
      version:resolvedVersion,
      changed:false,
      inSync:false,
      conflict:true,
      reason:'MALFORMED_OR_DUPLICATE_MARKERS',
      content:raw
    };
  }
  if(startCount===1&&endCount===1){
    const prefix=raw.slice(0,startIdx);
    const suffix=raw.slice(endIdx+GLOBAL_HOST_CONTRACT_END.length);
    const nextContent=prefix+managedCore+suffix;
    const inSync=raw.replaceAll('\r\n','\n')===nextContent.replaceAll('\r\n','\n');
    return {
      status:inSync?'IN_SYNC':'DRIFT_DETECTED',
      action:inSync?'UNCHANGED':'REPLACE_MANAGED_BLOCK',
      version:resolvedVersion,
      changed:!inSync,
      inSync,
      conflict:false,
      reason:null,
      content:inSync?raw:nextContent
    };
  }

  // No markers present: check for known legacy generated whole-file Global AGENTS formats.
  const normalized=raw.replaceAll('\r\n','\n');
  if(/^#\s*Old Global Contract\n\*\*Engine:\*\*\s*ExecutionKit[^\n]*\n?$/.test(normalized)){
    return {
      status:'DRIFT_DETECTED',
      action:'MIGRATED_LEGACY',
      version:resolvedVersion,
      changed:true,
      inSync:false,
      conflict:false,
      reason:null,
      content:fullRendered
    };
  }
  const versionMatch=normalized.match(/\*\*Environment:\*\* Antigravity Global AI Execution Layer \| \*\*Engine:\*\* ExecutionKit Standard \(`([^`]+)`\)/);
  if(versionMatch){
    const legacyBlock=renderLegacyUnmarkedGlobalHostContract(versionMatch[1]).trimEnd();
    const legacyIdx=normalized.indexOf(legacyBlock);
    if(legacyIdx>=0){
      const prefix=normalized.slice(0,legacyIdx);
      const suffix=normalized.slice(legacyIdx+legacyBlock.length);
      const nextContent=prefix+managedCore+suffix;
      return {
        status:'DRIFT_DETECTED',
        action:'MIGRATED_LEGACY',
        version:resolvedVersion,
        changed:true,
        inSync:false,
        conflict:false,
        reason:null,
        content:nextContent
      };
    }
  }
  if(normalized.includes('# AGENTS.md — Global Machine Operator Contract')){
    return {
      status:'CONFLICT',
      action:'CONFLICT',
      version:resolvedVersion,
      changed:false,
      inSync:false,
      conflict:true,
      reason:'AMBIGUOUS_UNMARKED_LEGACY_CONTRACT',
      content:raw
    };
  }

  // Pure owner/user instructions file without ExecutionKit markers: preserve owner content byte-for-byte.
  if(!raw.trim()){
    return {
      status:'DRIFT_DETECTED',
      action:'INSERT_MANAGED_BLOCK',
      version:resolvedVersion,
      changed:true,
      inSync:false,
      conflict:false,
      reason:null,
      content:fullRendered
    };
  }
  const sep=raw.endsWith('\n\n')||raw.endsWith('\r\n\r\n')?'':(raw.endsWith('\n')?'\n':'\n\n');
  return {
    status:'DRIFT_DETECTED',
    action:'INSERT_MANAGED_BLOCK',
    version:resolvedVersion,
    changed:true,
    inSync:false,
    conflict:false,
    reason:null,
    content:raw+sep+managedCore+'\n'
  };
}

function writeAtomicText(filePath,content){
  if(fs.existsSync(filePath)&&fs.lstatSync(filePath).isSymbolicLink()){
    throw new Error('Refusing to read or overwrite symbolic link global host contract: '+filePath);
  }
  fs.mkdirSync(path.dirname(filePath),{recursive:true});
  const tmp=filePath+'.executionkit-'+process.pid+'.tmp';
  fs.writeFileSync(tmp,content);
  fs.renameSync(tmp,filePath);
}

function provisionGlobalCliShims(){
  const launcherSource=path.join(runtimeRoot,'bin','executionkit.mjs');
  if(!fs.existsSync(launcherSource))return [];
  const home=os.homedir();
  const shimPaths=[
    path.join(home,'.gemini','antigravity-cli','bin','executionkit'),
    path.join(home,'.local','bin','executionkit'),
    path.join(home,'bin','executionkit')
  ];
  const provisioned=[];
  for(const shimPath of shimPaths){
    try{
      fs.mkdirSync(path.dirname(shimPath),{recursive:true});
      try{if(fs.existsSync(shimPath)||fs.lstatSync(shimPath))fs.rmSync(shimPath,{force:true});}catch{}
      fs.symlinkSync(launcherSource,shimPath);
      fs.chmodSync(launcherSource,0o755);
      provisioned.push(shimPath);
    }catch{}
  }
  return provisioned;
}

function isSymlinkPath(filePath){
  try{
    return fs.lstatSync(filePath).isSymbolicLink();
  }catch{
    return false;
  }
}

function syncSingleGlobalAgentsTarget(filePath,{role='primary',resolvedVersion,root,apply=false,throwOnSymlink=false}={}){
  if(isSymlinkPath(filePath)){
    const msg='Refusing to read or overwrite symbolic link global host contract: '+filePath;
    if(throwOnSymlink)throw new Error(msg);
    return {
      role,
      targetPath:filePath,
      status:'FAILED',
      action:'REFUSED_SYMLINK',
      reason:'SYMLINK_TARGET_REFUSED',
      error:msg,
      applied:false,
      changed:false,
      conflict:false,
      inSync:false,
      currentSha256:null,
      expectedSha256:null
    };
  }
  const exists=fs.existsSync(filePath);
  let currentRaw=null;
  try{
    currentRaw=exists?fs.readFileSync(filePath,'utf8'):null;
  }catch(error){
    if(throwOnSymlink)throw error;
    return {
      role,
      targetPath:filePath,
      status:'FAILED',
      action:'READ_FAILED',
      reason:'READ_FAILED',
      error:error.message,
      applied:false,
      changed:false,
      conflict:false,
      inSync:false,
      currentSha256:null,
      expectedSha256:null
    };
  }
  const currentSha256=currentRaw!==null?crypto.createHash('sha256').update(currentRaw.replaceAll('\r\n','\n')).digest('hex'):null;
  const reconciled=reconcileGlobalHostContract(currentRaw,{version:resolvedVersion,root});
  if(reconciled.conflict){
    return {
      role,
      targetPath:filePath,
      status:'CONFLICT',
      action:reconciled.action,
      reason:reconciled.reason,
      error:null,
      applied:false,
      changed:false,
      conflict:true,
      inSync:false,
      currentSha256,
      expectedSha256:null
    };
  }
  const expectedSha256=crypto.createHash('sha256').update(reconciled.content.replaceAll('\r\n','\n')).digest('hex');
  if(!apply){
    return {
      role,
      targetPath:filePath,
      status:reconciled.inSync?'IN_SYNC':reconciled.status,
      plannedOutcome:reconciled.inSync?'IN_SYNC':(!exists?'CREATED':'UPDATED'),
      action:reconciled.action,
      reason:null,
      error:null,
      applied:false,
      changed:reconciled.changed,
      conflict:false,
      inSync:reconciled.inSync,
      currentSha256,
      expectedSha256
    };
  }
  if(reconciled.changed||!exists){
    try{
      writeAtomicText(filePath,reconciled.content);
    }catch(error){
      return {
        role,
        targetPath:filePath,
        status:'FAILED',
        action:reconciled.action,
        reason:'WRITE_FAILED',
        error:error.message,
        applied:false,
        changed:false,
        conflict:false,
        inSync:false,
        currentSha256,
        expectedSha256
      };
    }
  }
  const perTargetStatus=!exists?'CREATED':(reconciled.changed?'UPDATED':'IN_SYNC');
  return {
    role,
    targetPath:filePath,
    status:perTargetStatus,
    action:reconciled.action,
    reason:null,
    error:null,
    applied:true,
    changed:reconciled.changed||!exists,
    conflict:false,
    inSync:true,
    previousSha256:currentSha256,
    expectedSha256
  };
}

export function syncGlobalHostContract(root,{targetPath=null,secondaryTargetPath=null,includeSecondary=null,apply=false,version=null}={}){
  const explicitPrimary=Boolean(targetPath||process.env.EXECUTIONKIT_GLOBAL_AGENTS_PATH);
  const explicitSecondary=Boolean(secondaryTargetPath||process.env.EXECUTIONKIT_GLOBAL_SECONDARY_AGENTS_PATH);
  const resolvedTarget=path.resolve(targetPath||process.env.EXECUTIONKIT_GLOBAL_AGENTS_PATH||path.join(os.homedir(),'.gemini','config','AGENTS.md'));
  const shouldUseSecondary=includeSecondary===true||explicitSecondary||(includeSecondary!==false&&!explicitPrimary);
  const resolvedSecondary=shouldUseSecondary
    ? path.resolve(secondaryTargetPath||process.env.EXECUTIONKIT_GLOBAL_SECONDARY_AGENTS_PATH||path.join(os.homedir(),'.gemini','antigravity-cli','AGENTS.md'))
    : null;
  const resolvedVersion=resolveInstalledKitVersion(root,version);

  const primaryResult=syncSingleGlobalAgentsTarget(resolvedTarget,{
    role:'primary',
    resolvedVersion,
    root,
    apply,
    throwOnSymlink:true
  });

  const secondaryResult=resolvedSecondary
    ? (resolvedSecondary===resolvedTarget
        ? {role:'secondary',targetPath:resolvedSecondary,status:'SKIPPED',action:'DUPLICATE_TARGET_SKIPPED',reason:'SAME_AS_PRIMARY',error:null,applied:false,changed:false,conflict:false,inSync:primaryResult.inSync,currentSha256:primaryResult.currentSha256??primaryResult.previousSha256??null,expectedSha256:primaryResult.expectedSha256}
        : syncSingleGlobalAgentsTarget(resolvedSecondary,{
            role:'secondary',
            resolvedVersion,
            root,
            apply,
            throwOnSymlink:false
          }))
    : null;

  const targets=secondaryResult?[primaryResult,secondaryResult]:[primaryResult];
  const activeTargets=targets.filter((t)=>t.status!=='SKIPPED');
  const failedTargets=activeTargets.filter((t)=>t.status==='CONFLICT'||t.status==='FAILED');
  const succeededTargets=activeTargets.filter((t)=>!failedTargets.includes(t));

  if(!apply){
    const anyConflict=failedTargets.some((t)=>t.conflict);
    const anyFailed=failedTargets.some((t)=>t.status==='FAILED');
    const allInSync=failedTargets.length===0&&activeTargets.every((t)=>t.inSync);
    const overallStatus=failedTargets.length>0&&succeededTargets.length>0
      ? (anyConflict&&activeTargets.length===1?'CONFLICT':'PARTIAL')
      : anyConflict
        ? 'CONFLICT'
        : anyFailed
          ? 'FAILED'
          : allInSync
            ? 'IN_SYNC'
            : (primaryResult.inSync?'DRIFT_DETECTED':primaryResult.status);
    return {
      schemaVersion:'executionkit-v4-platform-global-sync/v1',
      status:overallStatus,
      action:primaryResult.action,
      ...(failedTargets[0]?.reason?{reason:failedTargets[0].reason}:{}),
      ...(failedTargets[0]?.error?{error:failedTargets[0].error}:{}),
      version:resolvedVersion,
      systemCount:11,
      applied:false,
      changed:activeTargets.some((t)=>t.changed),
      conflict:anyConflict,
      inSync:allInSync,
      targetPath:resolvedTarget,
      ...(resolvedSecondary?{secondaryTargetPath:resolvedSecondary}:{}),
      targets,
      failedTargets,
      currentSha256:primaryResult.currentSha256,
      expectedSha256:primaryResult.expectedSha256,
      nextCommand:allInSync||anyConflict?null:'executionkit platform sync-global . --apply'
    };
  }

  let shims=[];
  if(!explicitPrimary&&!explicitSecondary){
    shims=provisionGlobalCliShims();
  }

  const anyConflict=failedTargets.some((t)=>t.conflict);
  const allInSync=failedTargets.length===0&&activeTargets.every((t)=>t.inSync);
  const overallStatus=failedTargets.length===0
    ? 'SYNCHRONIZED'
    : succeededTargets.length>0
      ? 'PARTIAL'
      : (anyConflict?'CONFLICT':'FAILED');

  return {
    schemaVersion:'executionkit-v4-platform-global-sync/v1',
    status:overallStatus,
    action:primaryResult.action,
    ...(failedTargets[0]?.reason?{reason:failedTargets[0].reason}:{}),
    ...(failedTargets[0]?.error?{error:failedTargets[0].error}:{}),
    version:resolvedVersion,
    systemCount:11,
    applied:succeededTargets.some((t)=>t.applied),
    changed:activeTargets.some((t)=>t.changed),
    conflict:anyConflict,
    inSync:allInSync,
    targetPath:resolvedTarget,
    ...(resolvedSecondary?{secondaryTargetPath:resolvedSecondary}:{}),
    targets,
    failedTargets,
    ...(shims.length?{shims}:{}),
    previousSha256:primaryResult.previousSha256??primaryResult.currentSha256??null,
    expectedSha256:primaryResult.expectedSha256,
    synchronizedAt:new Date().toISOString()
  };
}
