import fs from 'node:fs';
import path from 'node:path';
import { normalizePath, DEFAULT_CAPABILITIES } from './execution-model.mjs';

export const AGENT_RESOURCE_KINDS = ['roles','skills','rules','workflows','contracts','templates'];
export const RETIRED_SKILL_REDIRECTS = Object.freeze({
  'skill.runtime-orchestration': 'skill.parallel-orchestration',
  'skill.repository-inspection': 'skill.repository-knowledge',
  'skill.evidence-integrity': 'skill.quality-evidence',
  'skill.surface-assets': 'skill.premium-experience',
  'skill.surface-forms': 'skill.livewire-tailwind-alpine',
  'skill.surface-language': 'skill.content-depth',
  'skill.surface-antifake': 'skill.quality-evidence',
  'skill.surface-ux': 'skill.premium-experience',
  'skill.surface-flutter': 'skill.flutter',
  'skill.surface-visuals': 'skill.premium-experience',
  'skill.surface-perf': 'skill.seo-gate',
  'skill.accessibility': 'skill.premium-experience',
  'skill.responsive-layout': 'skill.premium-experience',
  'skill.visual-regression': 'skill.premium-experience',
  'skill.browser-testing': 'skill.test-adequacy',
  'skill.performance-audit': 'skill.seo-gate',
  'skill.error-observability': 'skill.release-health',
  'skill.localization-rtl': 'skill.content-depth',
  'skill.seo-discovery': 'skill.seo-audit',
  'skill.seo-planning': 'skill.seo-audit',
  'skill.seo-architecture': 'skill.seo-gate',
  'skill.seo-technical': 'skill.seo-gate',
  'skill.seo-structured-data': 'skill.seo-gate',
  'skill.seo-international': 'skill.seo-gate',
  'skill.seo-commerce': 'skill.seo-gate',
  'skill.seo-local': 'skill.seo-gate',
  'skill.seo-programmatic': 'skill.seo-gate',
});
export const RETIRED_MANAGED_WORKFLOW_IDS = new Set([
  'workflow.audit-boundary',
  'workflow.execute-parallel-batch',
  'workflow.execute-task',
  'workflow.rehydrate-state',
  'workflow.release-readiness',
  'workflow.resolve-blocker',
  'workflow.review-candidate',
  'workflow.seo-audit',
]);
const KIND_DIR = { roles:'agents', skills:'skills', rules:'rules', workflows:'workflows', contracts:'contracts', templates:'templates' };
const ALLOWED_CAPABILITIES = new Set(Object.keys(DEFAULT_CAPABILITIES));
const SUPPORTED_ADAPTER_HOSTS = new Set(['antigravity']);
const issue = (bucket, code, message) => bucket.push({ code, message });
const inside = (root, full) => { const rel = path.relative(root, full); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };

function symlinkInPath(projectRoot, full) {
  const root = path.resolve(projectRoot), target = path.resolve(full), rel = path.relative(root, target);
  if (!inside(root, target)) return null;
  let cursor = root;
  for (const part of rel.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) return cursor;
  }
  return null;
}
function realInsideProject(projectRoot, full) {
  try { return inside(fs.realpathSync(projectRoot), fs.realpathSync(full)); }
  catch { return false; }
}
function walkAgentFiles(dir, predicate = () => true, files = [], symlinks = []) {
  if (!fs.existsSync(dir)) return { files, symlinks };
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) { symlinks.push(full); continue; }
    if (entry.isDirectory()) walkAgentFiles(full, predicate, files, symlinks);
    else if (entry.isFile() && predicate(full)) files.push(full);
  }
  return { files, symlinks };
}

export function configuredManifestPath(config) { return config?.agent?.manifestPath || '.agents/manifest.json'; }
export function loadAgentManifest(projectRoot, config = {}) {
  const manifestPath = configuredManifestPath(config), full = path.resolve(projectRoot, manifestPath);
  if (!inside(projectRoot, full)) throw new Error(`Agent manifest points outside project: ${manifestPath}`);
  if (!fs.existsSync(full)) throw new Error(`Agent manifest not found: ${manifestPath}`);
  const symlink = symlinkInPath(projectRoot, full);
  if (symlink) throw new Error(`Agent manifest path traverses a symbolic link: ${normalizePath(path.relative(projectRoot, symlink))}`);
  if (!realInsideProject(projectRoot, full)) throw new Error(`Agent manifest realpath escapes project: ${manifestPath}`);
  if (!fs.statSync(full).isFile()) throw new Error(`Agent manifest is not a file: ${manifestPath}`);
  return { manifest: JSON.parse(fs.readFileSync(full, 'utf8')), manifestPath, full };
}

function mapsFor(manifest, errors) {
  const maps = Object.fromEntries(AGENT_RESOURCE_KINDS.map((k) => [k, new Map()])), global = new Map();
  for (const kind of AGENT_RESOURCE_KINDS) {
    const items = manifest.resources?.[kind];
    if (kind === 'workflows') {
      if (items !== undefined && !Array.isArray(items)) { issue(errors,'AGENT_RESOURCE_REGISTRY_MISSING','manifest resources.workflows must be an array when provided'); continue; }
      if (!items?.length) continue;
    } else if (!Array.isArray(items) || !items.length) {
      issue(errors,'AGENT_RESOURCE_REGISTRY_MISSING',`manifest resources.${kind} must be a non-empty array`);
      continue;
    }
    for (const r of items) {
      if (!r || typeof r !== 'object') { issue(errors,'AGENT_RESOURCE_INVALID',`resources.${kind} contains a non-object entry`); continue; }
      if (!/^[a-z0-9][a-z0-9._-]*$/.test(r.id ?? '')) issue(errors,'AGENT_RESOURCE_ID_INVALID',`${kind} resource has invalid id: ${r.id ?? 'MISSING'}`);
      if (!r.path || typeof r.path !== 'string') issue(errors,'AGENT_RESOURCE_PATH_MISSING',`${r.id ?? kind} has no path`);
      if (maps[kind].has(r.id) || global.has(r.id)) issue(errors,'DUPLICATE_AGENT_RESOURCE_ID',`${r.id} is duplicated/reused`);
      maps[kind].set(r.id, r); global.set(r.id, kind);
      for (const c of r.capabilities ?? []) if (!ALLOWED_CAPABILITIES.has(c)) issue(errors,'AGENT_RESOURCE_CAPABILITY_INVALID',`${r.id} declares unknown capability ${c}`);
    }
  }
  return maps;
}
function validateRefs(refs, maps, errors, location) {
  if (!refs || typeof refs !== 'object') return;
  for (const key of Object.keys(refs)) if (!AGENT_RESOURCE_KINDS.includes(key)) issue(errors,'AGENT_REFERENCE_KIND_INVALID',`${location}: unknown resource kind ${key}`);
  for (const kind of AGENT_RESOURCE_KINDS) {
    if (refs[kind] !== undefined && !Array.isArray(refs[kind])) { issue(errors,'AGENT_REFERENCE_TYPE_INVALID',`${location}.${kind} must be an array`); continue; }
    for (const id of refs[kind] ?? []) if (!maps[kind].has(id)) issue(errors,'BROKEN_AGENT_REFERENCE',`${location} references unknown ${kind} id ${id}`);
  }
}
function skillCycles(map) {
  const visiting = new Set(), visited = new Set(), cycles = [];
  function dfs(id, stack) {
    if (visiting.has(id)) { cycles.push([...stack.slice(stack.indexOf(id)), id]); return; }
    if (visited.has(id)) return;
    visiting.add(id); stack.push(id);
    for (const dep of map.get(id)?.requires ?? []) if (map.has(dep)) dfs(dep, stack);
    stack.pop(); visiting.delete(id); visited.add(id);
  }
  for (const id of map.keys()) dfs(id, []);
  return cycles;
}
function reachableResources(manifest, maps, config = {}) {
  const reachable = Object.fromEntries(AGENT_RESOURCE_KINDS.map((kind) => [kind, new Set()]));
  const addRefs = (refs) => {
    if (!refs || typeof refs !== 'object') return;
    for (const kind of AGENT_RESOURCE_KINDS) for (const id of refs[kind] ?? []) if (maps[kind].has(id)) reachable[kind].add(id);
  };
  for (const route of manifest.routing?.routes ?? []) addRefs(route.use);
  for (const supplement of manifest.routing?.supplements ?? []) addRefs(supplement.use);
  addRefs(manifest.routing?.fallback);
  if (manifest.resolution?.expandSkillDependencies !== false) {
    const visit = (id) => {
      const skill = maps.skills.get(id);
      if (!skill) return;
      for (const dep of skill.requires ?? []) {
        if (reachable.skills.has(dep)) continue;
        reachable.skills.add(dep);
        visit(dep);
      }
    };
    for (const id of [...reachable.skills]) visit(id);
  }
  for (const kind of AGENT_RESOURCE_KINDS) {
    for (const resource of maps[kind].values()) {
      if (!resource.adapterFor || !SUPPORTED_ADAPTER_HOSTS.has(resource.adapterHost)) continue;
      if (config.editors?.[resource.adapterHost] !== true) continue;
      if (reachable[kind].has(resource.adapterFor)) reachable[kind].add(resource.id);
    }
  }
  return reachable;
}

function validateDelegation(delegation, errors) {
  if (!delegation || typeof delegation !== 'object') { issue(errors,'AGENT_DELEGATION_INVALID','delegation contract is required'); return; }
  const mode = delegation.mode;
  if (!['SEQUENTIAL','DEPENDENCY_SAFE_PARALLEL'].includes(mode)) issue(errors,'AGENT_DELEGATION_INVALID',`unsupported delegation mode ${mode ?? 'MISSING'}`);
  if (mode === 'SEQUENTIAL' && delegation.oneLifecycleActionAtATime !== true) issue(errors,'AGENT_DELEGATION_INVALID','SEQUENTIAL delegation requires oneLifecycleActionAtATime=true');
  if (mode === 'DEPENDENCY_SAFE_PARALLEL') {
    if (delegation.oneLifecycleActionAtATime !== false) issue(errors,'AGENT_PARALLEL_POLICY_INVALID','DEPENDENCY_SAFE_PARALLEL requires oneLifecycleActionAtATime=false');
    if (delegation.sequentialFallback !== true) issue(errors,'AGENT_PARALLEL_POLICY_INVALID','parallel Agent OS must preserve deterministic sequential fallback');
    if (delegation.qualityGatesPreserved !== true) issue(errors,'AGENT_PARALLEL_POLICY_INVALID','parallel Agent OS must preserve quality gates');
    if (!Number.isInteger(delegation.maxConcurrentTasks) || delegation.maxConcurrentTasks < 1) issue(errors,'AGENT_PARALLEL_POLICY_INVALID','maxConcurrentTasks must be a positive integer');
    if (!Number.isInteger(delegation.maxAgentsPerTask) || delegation.maxAgentsPerTask < 1) issue(errors,'AGENT_PARALLEL_POLICY_INVALID','maxAgentsPerTask must be a positive integer');
    if (delegation.requireExplicitParallelSafe !== true) issue(errors,'AGENT_PARALLEL_POLICY_INVALID','canonical fan-out must require explicit parallel-safety proof');
    if (delegation.requireOwnership !== true) issue(errors,'AGENT_PARALLEL_POLICY_INVALID','canonical fan-out must require explicit ownership');
    if (delegation.isolatedWorktrees !== true) issue(errors,'AGENT_PARALLEL_POLICY_INVALID','parallel canonical work requires isolated worktrees or equivalent bounded isolation');
    if (delegation.integrationOwner !== 'role.orchestrator') issue(errors,'AGENT_PARALLEL_POLICY_INVALID','role.orchestrator must own final integration');
    if (delegation.boostCommand !== '/boost') issue(errors,'AGENT_PARALLEL_POLICY_INVALID','parallel Agent OS must expose /boost as the maximum-safe-concurrency host command');
    if (delegation.boostMaxConcurrentTasks !== undefined && delegation.boostMaxConcurrentTasks < delegation.maxConcurrentTasks) issue(errors,'AGENT_PARALLEL_POLICY_INVALID','boostMaxConcurrentTasks cannot be lower than normal concurrency');
    if (delegation.boostMaxAgentsPerTask !== undefined && delegation.boostMaxAgentsPerTask < delegation.maxAgentsPerTask) issue(errors,'AGENT_PARALLEL_POLICY_INVALID','boostMaxAgentsPerTask cannot be lower than normal specialist concurrency');
  }
}

export function validateAgentLayer(projectRoot, config = {}) {
  const errors = [], warnings = [];
  let loaded;
  try { loaded = loadAgentManifest(projectRoot, config); }
  catch (error) { issue(errors,'AGENT_MANIFEST_MISSING_OR_INVALID',error.message); return { errors, warnings, manifest:null, manifestPath:configuredManifestPath(config) }; }
  const { manifest, manifestPath } = loaded;
  const wants22 = /^(?:2\.(?:[2-9]|\d{2,})|[345]\.\d+)\./.test(String(config.standardVersion ?? ''));
  if (wants22 && manifest.schemaVersion !== '2.2.0') issue(errors,'AGENT_SCHEMA_VERSION',`${manifestPath} schemaVersion must be 2.2.0 for ExecutionKit 2.2+ / 3.x / 4.x / 5.x`);
  else if (!wants22 && !['2.0.0','2.2.0'].includes(manifest.schemaVersion)) issue(errors,'AGENT_SCHEMA_VERSION',`${manifestPath} schemaVersion is unsupported`);
  if (config.standardVersion && manifest.standardVersion !== config.standardVersion) issue(errors,'AGENT_STANDARD_VERSION_MISMATCH',`${manifestPath} standardVersion ${manifest.standardVersion ?? 'MISSING'} != execution config ${config.standardVersion}`);
  if (Object.hasOwn(manifest,'parallelism')) issue(errors,'LEGACY_PARALLELISM_KEY_FORBIDDEN','legacy top-level parallelism is forbidden; use the delegation contract so TODO authority and integration ownership remain explicit');
  const d = manifest.delegation;
  validateDelegation(d, errors);
  if (config.runtime?.mode === 'DEPENDENCY_SAFE_PARALLEL' && d?.mode !== 'DEPENDENCY_SAFE_PARALLEL') issue(errors,'AGENT_RUNTIME_DELEGATION_MISMATCH','execution runtime is parallel but Agent OS delegation is not DEPENDENCY_SAFE_PARALLEL');
  if (config.runtime?.mode === 'SEQUENTIAL' && d?.mode === 'DEPENDENCY_SAFE_PARALLEL') issue(warnings,'AGENT_RUNTIME_SEQUENTIAL_FALLBACK','Agent OS supports parallelism but current execution runtime explicitly selects sequential fallback');

  const authority = manifest.taskAuthority;
  const sharded=config.todoAuthority?.mode==='sharded';
  if(sharded){
    if(!authority||authority.path!==config.todoPath||authority.mutableStateOwner!=='declared-shards'||authority.shadowBacklogsForbidden!==true||authority.mode!=='sharded'||authority.shardRoot!==config.todoAuthority?.shardRoot||authority.archiveRoot!==config.todoAuthority?.archiveRoot){
      issue(errors,'AGENT_TASK_AUTHORITY_MISMATCH',`${manifestPath} must bind ${config.todoPath} as sharded entry authority with declared-shards mutable ownership and matching shard/archive roots`);
    }
  }else if (!authority || authority.path !== config.todoPath || authority.mutableStateOwner !== config.todoPath || authority.shadowBacklogsForbidden !== true) issue(errors,'AGENT_TASK_AUTHORITY_MISMATCH',`${manifestPath} must bind canonical ${config.todoPath} with shadowBacklogsForbidden=true`);
  for (const forbidden of ['tasks','backlog','queue','taskStatuses','progressLedger']) if (Object.hasOwn(manifest,forbidden)) issue(errors,'AGENT_SHADOW_STATE',`${manifestPath} contains forbidden mutable task-state key: ${forbidden}`);

  const agentsRoot = path.join(projectRoot, '.agents');
  const safeScan = walkAgentFiles(agentsRoot, () => true);
  for (const full of safeScan.symlinks) issue(errors,'AGENT_SYMLINK_FORBIDDEN',`${normalizePath(path.relative(projectRoot, full))} is a symbolic link; managed Agent resources must be real project-local files/directories`);

  const maps = mapsFor(manifest, errors), referencedPaths = new Set();
  for (const kind of AGENT_RESOURCE_KINDS) for (const r of maps[kind].values()) {
    if (r.adapterFor && (!maps[kind].has(r.adapterFor) || maps[kind].get(r.adapterFor).adapterFor)) issue(errors,'AGENT_ADAPTER_SOURCE_INVALID',`${r.id} must reference a canonical ${kind} resource`);
    if (r.adapterHost !== undefined) {
      if (typeof r.adapterHost !== 'string' || !SUPPORTED_ADAPTER_HOSTS.has(r.adapterHost)) issue(errors,'AGENT_ADAPTER_HOST_INVALID',`${r.id} declares unsupported adapterHost ${r.adapterHost ?? 'MISSING'}`);
      if (!r.adapterFor) issue(errors,'AGENT_ADAPTER_HOST_SOURCE_MISSING',`${r.id} declares adapterHost without adapterFor`);
    }
    if (!r.path) continue;
    const full = path.resolve(projectRoot, r.path);
    if (!inside(projectRoot, full)) issue(errors,'AGENT_RESOURCE_OUTSIDE_PROJECT',`${r.id} points outside project: ${r.path}`);
    else if (!fs.existsSync(full)) issue(errors,'AGENT_RESOURCE_MISSING',`${r.id} file does not exist: ${r.path}`);
    else {
      const symlink = symlinkInPath(projectRoot, full);
      if (symlink) issue(errors,'AGENT_RESOURCE_SYMLINK_FORBIDDEN',`${r.id} traverses symbolic link ${normalizePath(path.relative(projectRoot, symlink))}: ${r.path}`);
      else if (!realInsideProject(projectRoot, full)) issue(errors,'AGENT_RESOURCE_REALPATH_ESCAPE',`${r.id} realpath escapes project: ${r.path}`);
      else if (!fs.statSync(full).isFile()) issue(errors,'AGENT_RESOURCE_MISSING',`${r.id} is not a file: ${r.path}`);
    }
    referencedPaths.add(normalizePath(r.path).replace(/^\.\//,''));
  }

  for (const skill of maps.skills.values()) {
    for (const dep of skill.requires ?? []) if (!maps.skills.has(dep)) issue(errors,'BROKEN_SKILL_DEPENDENCY',`${skill.id} requires unknown skill ${dep}`);
    for (const conflict of skill.conflictsWith ?? []) if (!maps.skills.has(conflict)) issue(errors,'BROKEN_SKILL_CONFLICT',`${skill.id} conflicts with unknown skill ${conflict}`);
    for (const role of skill.allowedRoles ?? []) if (!maps.roles.has(role)) issue(errors,'BROKEN_SKILL_ROLE',`${skill.id} allows unknown role ${role}`);
  }
  for (const cycle of skillCycles(maps.skills)) issue(errors,'SKILL_DEPENDENCY_CYCLE',`Skill dependency cycle: ${cycle.join(' -> ')}`);

  const routeIds = new Set(), routes = manifest.routing?.routes, supplements = manifest.routing?.supplements ?? [];
  if (!['first-match','priority-first-match'].includes(manifest.routing?.strategy)) issue(errors,'AGENT_ROUTING_STRATEGY_INVALID','Unsupported routing strategy');
  if (!Array.isArray(routes) || !routes.length) issue(errors,'AGENT_ROUTES_MISSING',`${manifestPath} routing.routes must be non-empty`);
  if (!Array.isArray(supplements)) issue(errors,'AGENT_SUPPLEMENTS_INVALID','routing.supplements must be an array');
  for (const route of [...(Array.isArray(routes) ? routes : []), ...(Array.isArray(supplements) ? supplements : [])]) {
    if (!route.id || routeIds.has(route.id)) issue(errors,'DUPLICATE_AGENT_ROUTE_ID',`Duplicate/missing route id: ${route.id ?? 'MISSING'}`);
    routeIds.add(route.id);
    if (!Number.isInteger(route.priority)) issue(errors,'AGENT_ROUTE_PRIORITY_INVALID',`${route.id} priority must be an integer`);
    if (!route.when || typeof route.when !== 'object') issue(errors,'AGENT_ROUTE_PREDICATE_MISSING',`${route.id} has no when predicate`);
    for (const [key, values] of Object.entries(route.when ?? {})) {
      if (!['actions','states','phases','tagsAny','risks'].includes(key)) issue(errors,'AGENT_ROUTE_PREDICATE_UNKNOWN',`${route.id} has unsupported predicate ${key}`);
      if (!Array.isArray(values) || values.some((v) => typeof v !== 'string')) issue(errors,'AGENT_ROUTE_PREDICATE_INVALID',`${route.id}.${key} must be an array of strings`);
    }
    if (Array.isArray(supplements) && supplements.includes(route) && route.use?.roles?.length) issue(errors,'AGENT_SUPPLEMENT_ROLE_OVERRIDE',`${route.id} may add context, not lifecycle roles`);
    validateRefs(route.use, maps, errors, `route ${route.id}`);
  }
  validateRefs(manifest.routing?.fallback, maps, errors, 'routing fallback');
  if (!manifest.routing?.fallback) issue(errors,'AGENT_FALLBACK_MISSING',`${manifestPath} has no routing fallback`);

  const reachable = reachableResources(manifest, maps, config);
  if (d?.mode === 'DEPENDENCY_SAFE_PARALLEL') {
    if (!maps.skills.has('skill.parallel-orchestration')) issue(errors,'AGENT_PARALLEL_SKILL_MISSING','DEPENDENCY_SAFE_PARALLEL requires skill.parallel-orchestration');
    else if (!reachable.skills.has('skill.parallel-orchestration')) issue(errors,'AGENT_PARALLEL_SKILL_UNROUTABLE','skill.parallel-orchestration must be reachable from Agent routing/fallback/supplements');
  }
  for (const kind of AGENT_RESOURCE_KINDS) {
    for (const resource of maps[kind].values()) {
      if (!reachable[kind].has(resource.id)) issue(errors,'AGENT_RESOURCE_UNROUTABLE',`${kind} resource ${resource.id} is registered but unreachable from routing.routes, routing.fallback, routing.supplements${kind === 'skills' ? ' or routed skill dependencies' : ''}${resource.adapterHost ? ' or its enabled adapterHost source route' : ''}`);
    }
  }

  const coordinator = d?.coordinatorRole;
  if (coordinator && !maps.roles.has(coordinator)) issue(errors,'AGENT_COORDINATOR_UNKNOWN',`delegation.coordinatorRole references unknown role ${coordinator}`);

  for (const kind of AGENT_RESOURCE_KINDS) {
    const dir = path.join(agentsRoot, KIND_DIR[kind]);
    const { files } = walkAgentFiles(dir, (p) => /\.(md|json)$/i.test(p));
    for (const full of files) {
      const rel = normalizePath(path.relative(projectRoot, full));
      if (kind === 'skills' && path.dirname(full) !== dir && path.basename(full) !== 'SKILL.md') continue;
      if (!referencedPaths.has(rel)) issue(errors,'UNREGISTERED_AGENT_RESOURCE',`${rel} exists under managed ${kind} but is not registered in ${manifestPath}`);
    }
  }

  const taskLike = /^\s*[-*+]\s+\[[ xX~Rr!Bb]\]\s+(?:[A-Z][A-Z0-9._]*-[A-Z0-9._-]+\b|TASK\b|Task\b)/;
  const { files: markdownFiles } = walkAgentFiles(agentsRoot, (p) => /\.md$/i.test(p));
  for (const full of markdownFiles) {
    const rel = normalizePath(path.relative(projectRoot, full)), text = fs.readFileSync(full, 'utf8');
    if (/<!--\s*TASK:/i.test(text)) issue(errors,'TASK_STATE_INSIDE_AGENTS',`${rel} contains canonical task markers`);
    text.split('\n').forEach((line, i) => { if (taskLike.test(line)) issue(errors,'TASK_STATE_INSIDE_AGENTS',`${rel}:${i+1} contains executable task-style state`); });
  }
  return { errors, warnings, manifest, manifestPath, maps };
}

function routeMatches(route, context) {
  const when = route.when ?? {}, tags = new Set(context.tags ?? []);
  if (when.actions?.length && !when.actions.includes(context.action)) return false;
  if (when.states?.length && !when.states.includes(context.state)) return false;
  if (when.phases?.length && !when.phases.includes(context.phase)) return false;
  if (when.tagsAny?.length && !when.tagsAny.some((t) => tags.has(t))) return false;
  if (when.risks?.length && !when.risks.includes(context.risk)) return false;
  return true;
}
function expandSkills(ids, map) {
  const out = [], seen = new Set();
  function visit(id) { if (seen.has(id)) return; const skill = map.get(id); if (!skill) throw new Error(`Unknown skill ${id}`); for (const dep of skill.requires ?? []) visit(dep); seen.add(id); out.push(id); }
  for (const id of ids ?? []) visit(id);
  return out;
}
export function resolveAgentContextFast(projectRoot, config, context) {
  const {manifest}=loadAgentManifest(projectRoot,config);
  const errors=[];
  const maps=mapsFor(manifest,errors);
  if(errors.length)throw new Error('Agent manifest invalid: '+errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
  const routes=Array.isArray(manifest.routing?.routes)?[...manifest.routing.routes]:[];
  const supplements=Array.isArray(manifest.routing?.supplements)?[...manifest.routing.supplements]:[];
  const compare=(a,b)=>(a.priority??0)-(b.priority??0)||String(a.id??'').localeCompare(String(b.id??''));
  if(manifest.routing?.strategy==='priority-first-match')routes.sort(compare);
  supplements.sort(compare);
  const route=routes.find((candidate)=>routeMatches(candidate,context));
  const matches=supplements.filter((candidate)=>routeMatches(candidate,context));
  const base=route?.use??manifest.routing?.fallback??{};
  const refs=Object.fromEntries(AGENT_RESOURCE_KINDS.map((kind)=>[
    kind,
    [...new Set([...(base[kind]??[]),...matches.flatMap((entry)=>entry.use?.[kind]??[])])]
  ]));
  for(const kind of AGENT_RESOURCE_KINDS){
    for(const id of refs[kind]??[])if(!maps[kind].has(id))throw new Error('BROKEN_AGENT_REFERENCE: '+kind+' '+id);
  }
  const skillIds=manifest.resolution?.expandSkillDependencies===false?(refs.skills??[]):expandSkills(refs.skills??[],maps.skills);
  for(const id of skillIds){
    const skill=maps.skills.get(id);
    if(!skill)throw new Error('Unknown skill '+id);
    for(const dep of skill.requires??[])if(!skillIds.includes(dep))throw new Error('SKILL_DEPENDENCY_NOT_SELECTED: '+id+' requires '+dep);
    for(const conflict of skill.conflictsWith??[])if(skillIds.includes(conflict))throw new Error('SKILL_CONFLICT: '+id+' conflicts with '+conflict);
    if(skill.allowedRoles?.length&&(!refs.roles?.length||refs.roles.some((role)=>!skill.allowedRoles.includes(role))))throw new Error('SKILL_ROLE_FORBIDDEN: '+id);
  }
  const selected={...refs,skills:skillIds},resources={};
  for(const kind of AGENT_RESOURCE_KINDS){
    resources[kind]=(selected[kind]??[]).map((id)=>{
      const resource=maps[kind].get(id);
      if(!resource)throw new Error('Unknown '+kind+' resource '+id);
      return resource;
    });
  }
  return {
    routeId:route?.id??null,
    supplementIds:matches.map((entry)=>entry.id),
    usedFallback:!route,
    context,
    resources,
    minimalContext:manifest.resolution?.minimalContext!==false,
    delegation:manifest.delegation??{mode:'SEQUENTIAL',oneLifecycleActionAtATime:true,sequentialFallback:true},
    validationMode:'FAST_MANIFEST_ONLY'
  };
}

export function resolveAgentContext(projectRoot, config, context) {
  const validation = validateAgentLayer(projectRoot, config);
  if (validation.errors.length) throw new Error(`Agent layer invalid: ${validation.errors.map((e) => `[${e.code}] ${e.message}`).join('; ')}`);
  const { manifest, maps } = validation, compare = (a,b) => a.priority - b.priority || a.id.localeCompare(b.id), routes = [...manifest.routing.routes];
  if (manifest.routing.strategy === 'priority-first-match') routes.sort(compare);
  const route = routes.find((c) => routeMatches(c, context)), matches = [...(manifest.routing.supplements ?? [])].sort(compare).filter((c) => routeMatches(c, context));
  const base = route?.use ?? manifest.routing.fallback ?? {};
  const refs = Object.fromEntries(AGENT_RESOURCE_KINDS.map((kind) => [kind, [...new Set([...(base[kind] ?? []), ...matches.flatMap((e) => e.use?.[kind] ?? [])])]]));
  const skillIds = manifest.resolution?.expandSkillDependencies === false ? (refs.skills ?? []) : expandSkills(refs.skills ?? [], maps.skills);
  for (const id of skillIds) {
    const skill = maps.skills.get(id);
    for (const dep of skill.requires ?? []) if (!skillIds.includes(dep)) throw new Error(`SKILL_DEPENDENCY_NOT_SELECTED: ${id} requires ${dep}`);
    for (const conflict of skill.conflictsWith ?? []) if (skillIds.includes(conflict)) throw new Error(`SKILL_CONFLICT: ${id} conflicts with ${conflict}`);
    if (skill.allowedRoles?.length && (!refs.roles?.length || refs.roles.some((role) => !skill.allowedRoles.includes(role)))) throw new Error(`SKILL_ROLE_FORBIDDEN: ${id} is not allowed for selected roles ${refs.roles?.join(', ')}`);
  }
  const selected = { ...refs, skills: skillIds }, resources = {};
  for (const kind of AGENT_RESOURCE_KINDS) resources[kind] = (selected[kind] ?? []).map((id) => maps[kind].get(id));
  return { routeId:route?.id ?? null, supplementIds:matches.map((e) => e.id), usedFallback:!route, context, resources, minimalContext:manifest.resolution?.minimalContext !== false, delegation:manifest.delegation ?? { mode:'SEQUENTIAL', oneLifecycleActionAtATime:true, sequentialFallback:true } };
}
export function classifyAgentLayer(projectRoot) {
  const root = path.join(projectRoot, '.agents');
  if (!fs.existsSync(root)) return { status:'missing', fileCount:0, hasManifest:false };
  const scan = walkAgentFiles(root, () => true);
  const hasManifest = fs.existsSync(path.join(root,'manifest.json')) || fs.existsSync(path.join(root,'executionkit.manifest.json'));
  if (scan.symlinks.length) return { status:'unsafe', fileCount:scan.files.length, symlinkCount:scan.symlinks.length, hasManifest };
  if (hasManifest && scan.files.length >= 8) return { status:'mature', fileCount:scan.files.length, hasManifest:true };
  return { status:'partial', fileCount:scan.files.length, hasManifest };
}
