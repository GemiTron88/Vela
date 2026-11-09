import {legacyDistributionVersion} from './legacy-distribution-version.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseTaskBlocks, stateIsTerminal } from './execution-model.mjs';
import { validateAgentLayer } from './agent-model.mjs';
import { migrateConfiguredAgentManifest, synthesizeNativeAgentManifest } from './native-agent-adoption.mjs';
import { inferNativeMarkdownContract } from './native-markdown-projector.mjs';
import { DERIVED_IGNORE_CONTENT, INSTALLED_IGNORE_CONTENT } from './derived-state.mjs';
import { applyRepositoryIntelligenceManagedBlock } from './agent-contract-compiler.mjs';

export const RUNTIME = '.executionkit/runtime/kit';
export const PINNED_RUNTIME = '.executionkit/runtime/AI-ExecutionKit';
export const PROJECT_SOURCE_ROOT = '.executionkit/source/AI-ExecutionKit';
export const SUPPORTED_RUNTIMES = [RUNTIME,PINNED_RUNTIME];
const CANONICAL_REPOSITORY = 'https://github.com/Elwazeery/AI-ExcutionKit.git';
const RECEIPT = '.executionkit/installation.json';
const JOURNALS = '.executionkit/installer';
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const exists = file => fs.existsSync(file);
const read = file => fs.readFileSync(file, 'utf8');
const hash = file => exists(file) ? digest(fs.readFileSync(file)) : null;
const ignored = new Set(['.git', 'node_modules', 'vendor', '.dart_tool', 'build', 'dist', '.next', '.executionkit']);

function safe(root, rel) {
  if (!rel || path.isAbsolute(rel) || rel.includes('\\') || rel.split('/').some(p => !p || p === '..' || p === '.')) throw new Error(`Unsafe installation path: ${rel}`);
  let cursor = root;
  for (const part of rel.split('/')) {
    cursor = path.join(cursor, part);
    try { if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error(`Installation path traverses a symlink: ${rel}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return cursor;
}
function files(root, { skip = new Set(), rejectLinks = false, excludePythonCache = false } = {}) {
  const result = [];
  function walk(dir, prefix = '') {
    if (!exists(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes:true }).sort((a,b) => a.name.localeCompare(b.name))) {
      if (skip.has(entry.name)) continue;
      if (excludePythonCache && (entry.name === '__pycache__' || /\.(?:pyc|pyo)$/.test(entry.name))) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) { if (rejectLinks) throw new Error(`Distribution symlink: ${rel}`); result.push({ path:rel, symlink:fs.readlinkSync(path.join(root, rel)) }); }
      else if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
      else if (entry.isFile()) result.push({ path:rel, sha256:hash(path.join(root, rel)), mode:fs.statSync(path.join(root, rel)).mode & 0o777 });
      if (result.length > 50000) throw new Error('Inventory exceeds 50,000 files; declare generated/dependency exclusions first');
    }
  }
  walk(root); return result;
}
function git(root, args) {
  const result = spawnSync('git', ['-c','core.longpaths=true','-C',root,...args], { encoding:'utf8', timeout:10000, windowsHide:true });
  return result.status === 0 ? result.stdout.trim() : null;
}
function normRepo(url){return String(url??'').trim().replace(/^git@github\.com:/,'https://github.com/').replace(/\.git$/,'');}
function approvedProjectLocalSource(root, source) {
  const base = path.resolve(root, PROJECT_SOURCE_ROOT);
  const commit = path.basename(source);
  if (!/^[a-f0-9]{40}$/.test(commit) || path.resolve(source) !== path.join(base, commit)) return null;
  if (git(source,['rev-parse','HEAD']) !== commit) return null;
  const originUrl = git(source,['config','--get','remote.origin.url']) || git(source,['remote','get-url','origin']);
  if (normRepo(originUrl) !== normRepo(CANONICAL_REPOSITORY)) return null;
  if (git(source,['status','--porcelain=v1','--untracked-files=all']) !== '') return null;
  return { commit, path: path.relative(root, source).split(path.sep).join('/') };
}
function command(source, name, target, args = []) {
  const result = spawnSync(process.execPath, [path.join(source,'bin',name),target,...args], { encoding:'utf8', timeout:120000, maxBuffer:8*1024*1024, windowsHide:true });
  if (result.status !== 0) throw new Error(`${name}: ${(result.stderr || result.stdout || result.error?.message || 'failed').trim()}`);
  return result.stdout;
}
function merge(base, native) {
  if (!base || typeof base !== 'object' || Array.isArray(base) || !native || typeof native !== 'object' || Array.isArray(native)) return structuredClone(native ?? base);
  const out = structuredClone(base);
  for (const [key,value] of Object.entries(native)) out[key] = Object.hasOwn(base,key) ? merge(base[key],value) : structuredClone(value);
  return out;
}
function renderRuntime(text, runtimePath = RUNTIME) { return text.replace(/\bnode bin\//g, `node ${runtimePath}/bin/`); }
function atomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  const fd = fs.openSync(temporary,'wx',0o600);
  try { fs.writeFileSync(fd,content); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temporary,file);
}
function inferredRuntime(root,nativeConfig,previous) {
  if (previous?.runtime) return previous.runtime;
  const declared=nativeConfig?.installation?.runtimePath;
  if (declared) {
    if (!SUPPORTED_RUNTIMES.includes(declared)) throw new Error(`Unsupported installed runtime path: ${declared}`);
    return declared;
  }
  const modules=exists(safe(root,'.gitmodules')) ? read(safe(root,'.gitmodules')) : '';
  if (new RegExp(`^\\s*path\\s*=\\s*${PINNED_RUNTIME.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*$`,'m').test(modules)) return PINNED_RUNTIME;
  return RUNTIME;
}
function runtimeMatchesDistribution(root,runtimePath,distribution) {
  if (!exists(safe(root,runtimePath))) return false;
  return distribution.every(entry=>hash(safe(root,`${runtimePath}/${entry.path}`))===entry.sha256);
}
function runtimeManifestFor(distribution) {
  return distribution.map(({path:entryPath,sha256})=>({path:entryPath,sha256}));
}
export function verifyInstalledRuntime(root,runtimePath,runtimeManifest,sourceHash) {
  const drift=[];
  if (!SUPPORTED_RUNTIMES.includes(runtimePath)) return {ok:false,drift:[runtimePath ?? 'MISSING'],reason:'Unsupported runtime topology in installation receipt'};
  if (!Array.isArray(runtimeManifest) || runtimeManifest.length===0) return {ok:false,drift:[runtimePath],reason:'Installation receipt has no runtime manifest; reinstall/upgrade before execution'};
  if (!/^[a-f0-9]{64}$/.test(sourceHash ?? '') || digest(json(runtimeManifest))!==sourceHash) return {ok:false,drift:[runtimePath],reason:'Installation receipt runtime manifest does not match its source fingerprint'};
  const seen=new Set();
  for (const entry of runtimeManifest) {
    if (!entry || typeof entry.path!=='string' || !/^[a-f0-9]{64}$/.test(entry.sha256 ?? '') || seen.has(entry.path)) {
      return {ok:false,drift:[runtimePath],reason:'Installation receipt runtime manifest is invalid or ambiguous'};
    }
    seen.add(entry.path);
    let full;
    try { full=safe(root,`${runtimePath}/${entry.path}`); }
    catch { return {ok:false,drift:[`${runtimePath}/${entry.path}`],reason:'Installation receipt runtime manifest contains an unsafe path'}; }
    if (!exists(full)) { drift.push(`${runtimePath}/${entry.path}`); continue; }
    const stat=fs.lstatSync(full);
    if (!stat.isFile() || stat.isSymbolicLink() || hash(full)!==entry.sha256) drift.push(`${runtimePath}/${entry.path}`);
  }
  return {ok:drift.length===0,drift,reason:drift.length?'Installed ExecutionKit runtime bytes no longer match the verified source manifest':null};
}

/**
 * Gate non-terminal canonical tasks behind the current integration activation in one
 * pass over TODO. This matters for multi-megabyte project authorities where replacing
 * the entire string once per task becomes O(tasks × file-size).
 */
export function gateTodoForActivation(todo, tasks, config, activationId) {
  const byId = new Map(tasks.map(task => [task.id,task]));
  return todo.replace(/<!-- TASK:([^\s>]+) -->([\s\S]*?)<!-- \/TASK -->/g,(whole,id,body) => {
    const task = byId.get(id);
    if (!task || stateIsTerminal(task,config)) return whole;
    const match = body.match(/^- Depends: (.*)$/m);
    if (!match) throw new Error(`Native canonical task ${id} has no Depends metadata`);
    const raw = match[1].trim();
    const deps = !raw || raw === 'NONE' ? [] : raw.split(',').map(value=>value.trim()).filter(Boolean);
    const gated = deps.includes(activationId) ? whole : whole.replace(/^- Depends: .*$/m,`- Depends: ${[...deps,activationId].join(', ')}`);
    return gated.replace(/^- Status: READY$/m, '- Status: PLANNED');
  });
}

export function inspectInstallation(target) {
  const root = path.resolve(target);
  if (exists(root) && (!fs.lstatSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink())) throw new Error('Target must be a real directory');
  const inventory = files(root,{skip:ignored});
  const paths = inventory.map(f => f.path);
  const stacks = [];
  for (const file of inventory) {
    if (file.symlink) continue;
    if (file.path.endsWith('composer.json') && /laravel\/framework/.test(read(path.join(root,file.path)))) stacks.push({ stack:'laravel', path:file.path });
    if (file.path.endsWith('pubspec.yaml') && /flutter\s*:/.test(read(path.join(root,file.path)))) stacks.push({ stack:'flutter', path:file.path });
  }
  const hasCode = paths.some(p => /\.(php|dart|js|mjs|ts|tsx|jsx|vue|svelte|html|css)$/.test(p));
  return { root, git:{head:exists(root)?git(root,['rev-parse','HEAD']):null,branch:exists(root)?git(root,['branch','--show-current']):null,dirty:exists(root)?git(root,['status','--porcelain=v1','--untracked-files=all']):null},
    inventoryHash:digest(json(inventory)), stacks, codeDetected:hasCode || stacks.length > 0,
    maturity: hasCode || stacks.length ? 'REQUIRES_PROJECT_STUDY_M1_M4' : 'M0_PLANNING_ONLY',
    plans:paths.filter(p => /\.md$/i.test(p) && !/^\.(agents|github)\//.test(p)),
    nativeAgents:paths.filter(p => /^\.agents\//.test(p)),
    installed:exists(safe(root,RECEIPT)) };
}

/** Deterministic first adoption and managed upgrade. A plan is data, never an execution backlog. */
export function planInstallation(target, options = {}) {
  const source = path.resolve(options.source ?? sourceRoot), inspection = inspectInstallation(target), root = inspection.root;
  if (root === source) throw new Error('ExecutionKit source cannot be the project root');
  const nestedSource = source.startsWith(`${root}${path.sep}`);
  const projectLocalSource = nestedSource ? approvedProjectLocalSource(root, source) : null;
  if (nestedSource && !projectLocalSource) {
    throw new Error(`Nested ExecutionKit source is allowed only as an immutable official GitHub snapshot at ${PROJECT_SOURCE_ROOT}/<sha>`);
  }
  const sourceVersion = read(safe(source,'VERSION')).trim();
  const version = legacyDistributionVersion(sourceVersion);
  if (!/^(?:3|4)\.\d+\.\d+(?:-[\w.-]+)?$/.test(version) || JSON.parse(read(safe(source,'package.json'))).version !== sourceVersion) throw new Error('Source VERSION/package mismatch or unsupported major');
  const distribution = [];
  for (const folder of ['bin','lib','schemas','templates','plugins','docs','contracts']) {
    for (const entry of files(safe(source,folder),{rejectLinks:true,excludePythonCache:true})) distribution.push({...entry,path:`${folder}/${entry.path}`});
  }
  for (const rel of ['VERSION','package.json','README.md','STANDARD.md','STANDARD_V3.md','PLAYBOOK.md']) distribution.push({path:rel,sha256:hash(safe(source,rel)),mode:0o644});
  const runtimeManifest = runtimeManifestFor(distribution);
  const sourceHash = digest(json(runtimeManifest));
  if (options.expectedSource && options.expectedSource !== sourceHash) throw new Error('Source fingerprint changed');
  const previous = inspection.installed ? JSON.parse(read(safe(root,RECEIPT))) : null;
  if (previous && (previous.schemaVersion !== 'executionkit-install/v1' || !SUPPORTED_RUNTIMES.includes(previous.runtime))) throw new Error('Unsupported installation receipt');
  const initialConfigPath=safe(root,'execution.config.json');
  const initialNativeConfig=exists(initialConfigPath)?JSON.parse(read(initialConfigPath)):null;
  const runtimePath=inferredRuntime(root,initialNativeConfig,previous);
  if (previous && previous.runtime !== runtimePath) throw new Error(`Installed runtime topology changed from ${previous.runtime} to ${runtimePath}; reconcile explicitly`);

  const conflicts = [], writes = [], preserved = [];
  const put = (rel, content, { managed = false, mode = 0o644 } = {}) => {
    const file = safe(root,rel), before = hash(file), bytes = Buffer.isBuffer(content)?content:Buffer.from(content), after = digest(bytes);
    if (before === after) return;
    if (before && managed && before !== previous?.managed?.[rel]) { conflicts.push({path:rel,reason:'Managed file differs from its recorded installation; reconcile the edit'}); return; }
    writes.push({path:rel,before,after,content:bytes.toString('base64'),mode:before && !managed ? fs.statSync(file).mode & 0o777 : mode});
  };
  if (runtimePath === RUNTIME) {
    for (const entry of distribution) put(`${runtimePath}/${entry.path}`, fs.readFileSync(safe(source,entry.path)),{managed:true,mode:entry.mode});
  } else if (!runtimeMatchesDistribution(root,runtimePath,distribution)) {
    conflicts.push({path:runtimePath,reason:'Pinned ExecutionKit submodule does not match the trusted bootstrap source; reconcile the submodule to the pinned commit before installation'});
  } else preserved.push(runtimePath);

  const currentRuntimePaths = new Set(runtimePath===RUNTIME ? distribution.map(e=>`${runtimePath}/${e.path}`) : []);
  for (const [rel,before] of Object.entries(previous?.managed ?? {})) {
    if (currentRuntimePaths.has(rel)) continue;
    if (!rel.startsWith(`${previous.runtime}/`)) throw new Error('Receipt attempts to own a native project file');
    if (hash(safe(root,rel)) !== before) conflicts.push({path:rel,reason:'Removed upstream file has local edits'});
    else writes.push({path:rel,before,after:null,content:null,mode:0o644});
  }

  let nativeOwnerStrategy = false;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'ek-install-plan-'));
  try {
    const scaffold = path.join(temp,'project');
    command(source,'init-project.mjs','--target',[scaffold,'--runner-label',`project-${path.basename(root).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'project'}`]);
    let config = JSON.parse(read(path.join(scaffold,'execution.config.json')));
    const nativeConfigPath = safe(root,'execution.config.json');
    const nativeConfig = exists(nativeConfigPath) ? JSON.parse(read(nativeConfigPath)) : null;
    if (nativeConfig && !/^[234]\./.test(nativeConfig.standardVersion ?? '')) throw new Error('Run the explicit major migration before installing over a pre-v2 configuration');
    config = merge(config,nativeConfig ?? {});
    config.standardVersion = version;
    config.installation = {runtimePath};
    const reconcile = !previous || previous.sourceHash !== sourceHash;
    const nativeTodo = exists(safe(root,config.todoPath ?? 'TODO.md')) ? read(safe(root,config.todoPath ?? 'TODO.md')) : '';
    nativeOwnerStrategy = config.adoption?.integrationStrategy === 'EXISTING_CANONICAL_OWNER';
    const generatedPhase = previous || /<!-- TASK:EK00-/.test(nativeTodo) ? `EKI-${sourceHash.slice(0,8).toUpperCase()}` : 'EK00';
    const phase = nativeOwnerStrategy ? String(config.adoption?.integrationPhase ?? '').trim() : generatedPhase;
    const nativeOwnerGate = nativeOwnerStrategy ? String(config.adoption?.integrationGateTaskId ?? config.adoption?.nativeIntegrationOwnerTaskId ?? '').trim() : '';
    const activationId = nativeOwnerStrategy
      ? String(config.adoption?.integrationActivationTaskId ?? nativeOwnerGate).trim()
      : `${phase}-ACTIVATE`;
    if (nativeOwnerStrategy) {
      if (!phase) throw new Error('EXISTING_CANONICAL_OWNER requires adoption.integrationPhase before installation');
      if (!nativeOwnerGate) throw new Error('EXISTING_CANONICAL_OWNER requires adoption.integrationGateTaskId or nativeIntegrationOwnerTaskId before installation');
      if (!activationId) throw new Error('EXISTING_CANONICAL_OWNER requires a canonical activation owner');
    }
    const intakePath = `docs/executionkit/intake-${sourceHash.slice(0,8)}.md`;

    const scaffoldManifest=JSON.parse(read(path.join(scaffold,'.agents/manifest.json')));
    const configuredManifestRel=nativeConfig?.agent?.manifestPath ?? (!previous && exists(safe(root,'.agents/manifest.json')) ? '.agents/manifest.json' : null);
    let reconciledAgent=null, preserveWholeNativeAgentTree=false;
    if (configuredManifestRel) {
      config.agent={...config.agent,manifestPath:configuredManifestRel};
      const manifestFile=safe(root,configuredManifestRel), nativeManifest=JSON.parse(read(manifestFile));
      if (nativeManifest.standardVersion === version) {
        const nativeAgent=validateAgentLayer(root,config);
        if (nativeAgent.errors.length) throw new Error(`Native Agent reconciliation required: ${json(nativeAgent.errors)}`);
        preserveWholeNativeAgentTree=true;
      } else if (nativeManifest.schemaVersion === '2.2.0' && /^2\./.test(String(nativeManifest.standardVersion ?? nativeConfig?.standardVersion ?? ''))) {
        reconciledAgent=migrateConfiguredAgentManifest(root,nativeManifest,scaffoldManifest,{todoPath:config.todoPath ?? 'TODO.md',standardVersion:version,runtimeMode:config.runtime?.mode});
      } else throw new Error(`Configured Agent manifest ${configuredManifestRel} requires explicit migration before v${version}`);
    } else if (!previous && inspection.nativeAgents.length) {
      reconciledAgent=synthesizeNativeAgentManifest(root,scaffoldManifest,{todoPath:config.todoPath ?? 'TODO.md',standardVersion:version,runtimeMode:config.runtime?.mode});
      config.agent={...config.agent,manifestPath:'.agents/manifest.json'};
    }

    if (exists(safe(root,'AGENTS.md'))) {
      const currentAgents = read(safe(root,'AGENTS.md'));
      try {
        applyRepositoryIntelligenceManagedBlock(currentAgents);
      } catch (error) {
        throw new Error(`Repository Intelligence AGENTS reconciliation required: ${error.message}`);
      }
    }

    if (reconcile) {
      config.projectState = 'BOOTSTRAP';
      config.adoption = nativeOwnerStrategy
        ? {
            ...config.adoption,
            deepIntegrationRequired:true,
            productExecutionBlockedUntilGateAccepted:true,
            integrationPhase:phase,
            integrationGateTaskId:nativeOwnerGate,
            integrationActivationTaskId:activationId,
          }
        : {...config.adoption,deepIntegrationRequired:true,productExecutionBlockedUntilGateAccepted:true,integrationPhase:phase,integrationGateTaskId:`${phase}-AUDIT`,integrationActivationTaskId:activationId};
    }
    const todoRel = config.todoPath ?? 'TODO.md', todoFile = safe(root,todoRel);
    let todo = exists(todoFile) ? read(todoFile) : '# Project TODO\n\n';
    if (reconcile) {
      const parsed = parseTaskBlocks(todo,todoRel);
      if (!nativeOwnerStrategy && parsed.errors.length) throw new Error(`Native TODO parse failed: ${json(parsed.errors)}`);
      let projectionAdapter = config.taskModel?.adapter === 'projection-json';
      if (!nativeOwnerStrategy && !projectionAdapter) {
        const outside = todo.replace(/<!-- TASK:[\s\S]*?<!-- \/TASK -->/g,'');
        const markers=[...outside.matchAll(/^\s*[-*+]\s+\[([^\]])\]\s+/gm)].map(match=>match[1]);
        if (markers.length) {
          const customMarkers=markers.some(marker=>marker!==' ');
          const contract=customMarkers
            ? inferNativeMarkdownContract(outside)
            : {ok:true,markerStates:{space:'PLANNED'},usedMarkers:['space'],errors:[]};
          if (!contract.ok) throw new Error(`Native completion markers require an explicit compatible status contract: ${contract.errors.join('; ')}`);
          const nativeCommand=`node ${runtimePath}/bin/project-native-markdown.mjs . --write`;
          config.taskModel={
            adapter:'projection-json',
            projectionPath:'.executionkit/task-projection.json',
            projectionCommand:nativeCommand,
            nativeProjectionCommand:nativeCommand,
            nativeMarkdown:{contractVersion:'1',markerStates:contract.markerStates,usedMarkers:contract.usedMarkers},
          };
          projectionAdapter=true;
        }
      }
      if (projectionAdapter) {
        if (!String(config.taskModel?.projectionPath ?? '').trim()) throw new Error('projection-json adoption requires taskModel.projectionPath');
        const current = String(config.taskModel?.projectionCommand ?? '').trim();
        if (nativeOwnerStrategy) {
          if (!current) throw new Error('EXISTING_CANONICAL_OWNER projection-json adoption requires the native projectionCommand');
          if (current.includes('refresh-projection-with-integration.mjs')) {
            const native = String(config.taskModel?.nativeProjectionCommand ?? '').trim();
            if (!native) throw new Error('EXISTING_CANONICAL_OWNER cannot preserve a wrapped projection without taskModel.nativeProjectionCommand');
            config.taskModel.projectionCommand = native;
          }
          delete config.taskModel.nativeProjectionCommand;
        } else {
          if (!config.taskModel.nativeProjectionCommand && !current.includes('refresh-projection-with-integration.mjs')) config.taskModel.nativeProjectionCommand = current;
          config.taskModel.projectionCommand = `node ${runtimePath}/bin/refresh-projection-with-integration.mjs .`;
        }
      }
      if (!nativeOwnerStrategy) {
        const templateTodo = read(path.join(scaffold,'TODO.md'));
        const integration = [...templateTodo.matchAll(/<!-- TASK:EK00-[\s\S]*?<!-- \/TASK -->/g)].map(m => m[0]).join('\n\n').replaceAll('EK00',phase);
        if (!integration.includes(`TASK:${activationId}`)) throw new Error('Distribution integration chain is incomplete');
        if (!projectionAdapter) todo = gateTodoForActivation(todo,parsed.tasks,config,activationId);
        todo += `\n\n<!-- EXECUTIONKIT_INTEGRATION:START -->\n${renderRuntime(integration,runtimePath)}\n<!-- EXECUTIONKIT_INTEGRATION:END -->\n`;
        put(todoRel,todo);
      }
      const adoptionNote = reconciledAgent
        ? `\n\nNative Agent layer: ${reconciledAgent.adopted?.length ?? 0} previously unregistered resources were preservation-registered and ${reconciledAgent.scaffoldAdded?.length ?? 0} missing current scaffold resources were added. Fallback reachability is bootstrap-only; ${phase}-004 must reconcile project-semantic routing before activation.`
        : '';
      const projectionNote = projectionAdapter
        ? nativeOwnerStrategy
          ? `\n\nNative task projection: preserved verbatim. EXISTING_CANONICAL_OWNER forbids an ExecutionKit EKI wrapper or shadow backlog; ${nativeOwnerGate} remains the canonical integration gate.`
          : `\n\nNative task projection: preserved. The original projection command is retained as taskModel.nativeProjectionCommand and wrapped by the installed ExecutionKit integration gate; projected nonterminal product work receives the current ${activationId} dependency without creating a shadow backlog.`
        : '';
      const integrationGuidance = nativeOwnerStrategy
        ? `Revalidate the existing canonical integration owner ${nativeOwnerGate} in phase ${phase}; do not create EK00/EKI tasks. File installation never accepts the native gate.`
        : `Resolve SEO applicability, Premium design/component contracts, framework adapters and MCP/tool smoke evidence before independent ${phase}-AUDIT and ${activationId} acceptance. File installation never accepts these tasks.`;
      const study = `# Project intake\n\nDerived installation observations; task states remain exclusively in ${todoRel}.\n\nMaturity: ${inspection.maturity}. This is a provisional detection, not project acceptance.\n\nRuntime topology: ${runtimePath}${runtimePath===PINNED_RUNTIME ? ' (preserved pinned project submodule)' : ' (managed isolated runtime)'}.\n\nDetected runtimes:\n${inspection.stacks.map(s=>`- ${s.stack}: ${s.path}`).join('\n') || '- No Laravel/Flutter runtime detected'}\n\nRead these native plans during ${nativeOwnerStrategy ? phase + ' revalidation' : phase + ' project study'}:\n${inspection.plans.map(p=>`- ${p}`).join('\n') || '- No Markdown plans found; establish scope in the canonical study task.'}\n\nNative Agent resources requiring registration AND real route reconciliation:\n${inspection.nativeAgents.map(p=>`- ${p}`).join('\n') || '- None detected'}${adoptionNote}${projectionNote}\n\nStudy actual actors, surfaces, workflows, stack, constraints, data, current completion/evidence and deployment maturity. Reconcile Execution, Agent, Content, SEO, Audit, Test, Launch and State OS. ${integrationGuidance}\n`;
      if (exists(safe(root,intakePath))) throw new Error(`Intake path already exists: ${intakePath}`);
      put(intakePath,study.replaceAll('EK00',phase));
      const ownerInstruction = nativeOwnerStrategy
        ? `Latest Kit source changes reopen/revalidate existing canonical gate ${nativeOwnerGate}; no EK00/EKI shadow tasks are permitted. Product work remains blocked until that native gate and host acceptance are current.`
        : `Product review, correction, resume and implementation wait for accepted ${phase}-AUDIT and ${activationId}.`;
      const binding = `\n\n<!-- EXECUTIONKIT_INSTALL:START -->\n## ExecutionKit project entry\n\nStart from ${todoRel}. Read ${intakePath} and the native plans after tooling setup. Use the eight systems together; reconcile native specialists/contracts with actual routes through .agents/manifest.json and the configured Agent OS. Execute only dependency-ready work; dependency-safe parallel batches require explicit ownership/isolation and orchestrator-controlled integration, with sequential fallback on uncertainty. IMPLEMENTED is nonterminal and requires independent acceptance. ${ownerInstruction}\n\nRun: node ${runtimePath}/bin/next-execution.mjs . --json\nReadiness: node ${runtimePath}/bin/next-readiness.mjs . --json\nContext: node ${runtimePath}/bin/resolve-task-context.mjs . --next --json\nMCP: node ${runtimePath}/bin/mcp-server.mjs .\nInstaller doctor: node ${runtimePath}/bin/executionkit.mjs doctor .\nAfter each task update ${todoRel} and any host checklist as a derived mirror. Run complete CI at phase boundaries.\n<!-- EXECUTIONKIT_INSTALL:END -->\n`;
      const oldAgents = exists(safe(root,'AGENTS.md'))?read(safe(root,'AGENTS.md')):renderRuntime(read(path.join(scaffold,'AGENTS.md')),runtimePath);
      const currentBinding = binding;
      const withInstallBinding = /<!-- EXECUTIONKIT_INSTALL:START -->/.test(oldAgents)
        ? oldAgents.replace(/<!-- EXECUTIONKIT_INSTALL:START -->[\s\S]*?<!-- EXECUTIONKIT_INSTALL:END -->/,currentBinding.trim())
        : oldAgents+currentBinding;
      let withRepositoryKnowledge;
      try {
        withRepositoryKnowledge = applyRepositoryIntelligenceManagedBlock(withInstallBinding).content;
      } catch (error) {
        throw new Error(`Repository Intelligence AGENTS reconciliation required: ${error.message}`);
      }
      put('AGENTS.md', withRepositoryKnowledge);
    }
    for (const entry of files(scaffold)) {
      const rel = entry.path;
      if (preserveWholeNativeAgentTree && rel.startsWith('.agents/')) { preserved.push(rel); continue; }
      if (reconciledAgent && rel === '.agents/manifest.json') continue;
      if (rel.startsWith('bin/') || rel.startsWith('lib/') || rel.startsWith('plugins/') || rel.startsWith('.executionkit/') || ['TODO.md','AGENTS.md','execution.config.json'].includes(rel)) continue;
      if (exists(safe(root,rel))) { preserved.push(rel); continue; }
      put(rel,renderRuntime(read(path.join(scaffold,rel)),runtimePath));
    }
    if (reconciledAgent) put(config.agent?.manifestPath ?? '.agents/manifest.json',json(reconciledAgent.manifest));
    if (nativeConfig?.agent?.manifestPath) config.agent={...config.agent,manifestPath:nativeConfig.agent.manifestPath};
    put('execution.config.json',json(config));
    const ignorePath = '.executionkit/.gitignore';
    const oldIgnore = exists(safe(root,ignorePath)) ? read(safe(root,ignorePath)) : DERIVED_IGNORE_CONTENT;
    if (![DERIVED_IGNORE_CONTENT,INSTALLED_IGNORE_CONTENT].includes(oldIgnore)) throw new Error('Custom derived-state ignore policy requires reconciliation');
    put(ignorePath,INSTALLED_IGNORE_CONTENT);
  } finally { fs.rmSync(temp,{recursive:true,force:true}); }
  const managed = {};
  if (runtimePath===RUNTIME) for (const entry of distribution) managed[`${runtimePath}/${entry.path}`] = entry.sha256;
  const receipt = {schemaVersion:'executionkit-install/v1',version,runtime:runtimePath,sourceHash,runtimeManifest,managed};
  put(RECEIPT,json(receipt));
  writes.sort((a,b)=>(a.path==='execution.config.json'?-1:0)-(b.path==='execution.config.json'?-1:0));
  const plan = {schemaVersion:'executionkit-install-plan/v1',target:root,source,sourceAuthority:projectLocalSource?{type:'PROJECT_LOCAL_IMMUTABLE_UPSTREAM',...projectLocalSource}:{type:'EXPLICIT_TRUSTED_SOURCE'},version,sourceHash,runtimePath,inspection,conflicts,preserved,writes,integrationStrategy:nativeOwnerStrategy?'EXISTING_CANONICAL_OWNER':'KIT_INTEGRATION_CHAIN'};
  plan.id = digest(json(plan));
  return plan;
}

export function installationSummary(plan) {
  return {schemaVersion:plan.schemaVersion,planId:plan.id,status:plan.conflicts.length?'CONFLICT':plan.writes.length?'PLANNED':'UP_TO_DATE',target:plan.target,version:plan.version,sourceHash:plan.sourceHash,runtimePath:plan.runtimePath,inspection:plan.inspection,changes:plan.writes.map(({path,before,after})=>({path,operation:before?'update':'create',before,after})),conflicts:plan.conflicts,preserved:plan.preserved,integrationAcceptance:'NOT_CLAIMED'};
}

export function applyInstallation(plan, {expectedPlanId,allowDirty = false} = {}) {
  if (expectedPlanId && expectedPlanId !== plan.id) throw new Error('Plan changed; inspect the fresh plan before applying');
  const check = {...plan}; delete check.id;
  if (digest(json(check)) !== plan.id) throw new Error('Plan content was changed');
  if (plan.conflicts.length) throw new Error(`Installation conflicts: ${json(plan.conflicts)}`);
  if (!plan.writes.length) return {status:'UP_TO_DATE',planId:plan.id,runtimePath:plan.runtimePath};
  if (!allowDirty && plan.inspection.git.dirty) throw new Error('Dirty worktree: commit/stash your work or use --allow-dirty after reviewing the plan');
  const current = inspectInstallation(plan.target);
  if (current.inventoryHash !== plan.inspection.inventoryHash || json(current.git) !== json(plan.inspection.git)) throw new Error('Project changed since inspection');
  for (const write of plan.writes) if (hash(safe(plan.target,write.path)) !== write.before || (write.content === null ? null : digest(Buffer.from(write.content,'base64'))) !== write.after) throw new Error(`Stale planned file: ${write.path}`);
  const lock = safe(plan.target,`${JOURNALS}/lock.json`);
  fs.mkdirSync(path.dirname(lock),{recursive:true});
  const fd = fs.openSync(lock,'wx',0o600); fs.writeFileSync(fd,json({planId:plan.id,pid:process.pid})); fs.closeSync(fd);
  const journalPath = safe(plan.target,`${JOURNALS}/${plan.id}.json`);
  const journal = {schemaVersion:'executionkit-install-transaction/v1',id:plan.id,status:'APPLYING',writes:plan.writes.map(w => ({...w,content:undefined,previous:w.before?fs.readFileSync(safe(plan.target,w.path)).toString('base64'):null,previousMode:w.before?fs.statSync(safe(plan.target,w.path)).mode & 0o777:null}))};
  try {
    atomic(journalPath,json(journal));
    for (const write of plan.writes) {
      if (hash(safe(plan.target,write.path)) !== write.before) throw new Error(`Concurrent edit: ${write.path}`);
      if (write.content === null) fs.rmSync(safe(plan.target,write.path));
      else { atomic(safe(plan.target,write.path),Buffer.from(write.content,'base64')); fs.chmodSync(safe(plan.target,write.path),write.mode); }
    }
    journal.status = 'APPLIED'; atomic(journalPath,json(journal));
    fs.rmSync(lock);
    return {
      status:'INSTALLED',planId:plan.id,transaction:plan.id,changedFiles:plan.writes.length,runtimePath:plan.runtimePath,integration:'PENDING',
      next:plan.integrationStrategy==='EXISTING_CANONICAL_OWNER'
        ? 'Revalidate the configured existing canonical integration owner and host acceptance; no EK00/EKI shadow tasks were created'
        : 'EK00 project tooling and study; independent audit and activation remain required'
    };
  } catch (error) {
    try { rollbackInstallation(plan.target,plan.id); } catch (rollbackError) { throw new Error(`${error.message}; recovery required: ${rollbackError.message}`); }
    throw error;
  }
}

export function rollbackInstallation(target,id) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid transaction ID');
  const root = path.resolve(target), file = safe(root,`${JOURNALS}/${id}.json`), journal = JSON.parse(read(file));
  const lock = safe(root,`${JOURNALS}/lock.json`);
  if (exists(lock) && JSON.parse(read(lock)).planId !== id) throw new Error('Another installation owns the project lock');
  if (journal.schemaVersion !== 'executionkit-install-transaction/v1' || journal.id !== id) throw new Error('Invalid transaction journal');
  if (journal.status === 'ROLLED_BACK') return {status:'ROLLED_BACK',transaction:id};
  for (const write of journal.writes) {
    const actual = hash(safe(root,write.path));
    if (actual !== write.before && actual !== write.after) throw new Error(`Rollback would overwrite later work: ${write.path}`);
    if (write.previous !== null && digest(Buffer.from(write.previous,'base64')) !== write.before) throw new Error('Corrupt rollback backup');
  }
  for (const write of [...journal.writes].reverse()) {
    const dest = safe(root,write.path);
    if (hash(dest) === write.before) continue;
    if (write.previous === null) fs.rmSync(dest,{force:true});
    else { atomic(dest,Buffer.from(write.previous,'base64')); fs.chmodSync(dest,write.previousMode); }
  }
  journal.status = 'ROLLED_BACK'; atomic(file,json(journal));
  if (exists(lock) && JSON.parse(read(lock)).planId === id) fs.rmSync(lock);
  return {status:'ROLLED_BACK',transaction:id};
}

export function doctorInstallation(target) {
  const inspection = inspectInstallation(target), root = inspection.root;
  if (!inspection.installed) return {status:'NOT_INSTALLED',inspection};
  const receipt = JSON.parse(read(safe(root,RECEIPT))), drift = [];
  const runtimeVerification=verifyInstalledRuntime(root,receipt.runtime,receipt.runtimeManifest,receipt.sourceHash);
  if (!runtimeVerification.ok) return {status:'BLOCKED',inspection,drift:runtimeVerification.drift,checks:[],reason:runtimeVerification.reason};
  for (const [rel,expected] of Object.entries(receipt.managed ?? {})) if (hash(safe(root,rel)) !== expected) drift.push(rel);
  if (drift.length) return {status:'BLOCKED',inspection,drift,checks:[],reason:'Do not execute modified/missing installed runtime during read-only inspection'};
  const checks = [];
  for (const name of ['validate-execution.mjs','validate-agents.mjs','validate-deep-integration.mjs','validate-state.mjs','validate-seo.mjs','validate-ci-policy.mjs','validate-v22-policy.mjs','validate-v30-project.mjs']) {
    try { command(path.join(root,receipt.runtime),name,root,name === 'validate-seo.mjs' ? ['--no-write'] : []); checks.push({name,status:'PASS'}); }
    catch (error) { checks.push({name,status:'FAIL',detail:error.message}); }
  }
  return {status:drift.length || checks.some(c=>c.status==='FAIL')?'BLOCKED':'INSTALLED',inspection,version:receipt.version,runtimePath:receipt.runtime,sourceHash:receipt.sourceHash,runtimeManifestEntries:receipt.runtimeManifest.length,drift,checks,integrationAcceptance:'NOT_CLAIMED',hostMcpSmoke:'NOT_RUN',physicalDeviceEvidence:'NOT_RUN'};
}
