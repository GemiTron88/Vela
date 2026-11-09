import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const KIND_DIR = { roles:'agents', skills:'skills', rules:'rules', workflows:'workflows', contracts:'contracts', templates:'templates' };
export const REQUIRED_NATIVE_KINDS = ['roles','skills','rules','contracts'];
const normalize = value => value.split(path.sep).join('/');
const digest = value => crypto.createHash('sha256').update(value).digest('hex').slice(0,8);
const slug = value => value.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'') || 'resource';

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
    const full = path.join(dir,entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Native Agent adoption refuses symbolic links: ${full}`);
    if (entry.isDirectory()) walk(full,out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function eligible(kind, full, kindRoot) {
  if (!/\.(?:md|json)$/i.test(full)) return false;
  if (kind !== 'skills') return true;
  const rel = normalize(path.relative(kindRoot,full));
  return !rel.includes('/') || path.basename(full) === 'SKILL.md';
}

function tagsFor(rel) {
  const tokens = rel.toLowerCase().replace(/\.(?:md|json)$/,'').split(/[^a-z0-9]+/).filter(token=>token.length >= 2 && token !== 'skill');
  return [...new Set(tokens)].slice(0,12);
}

function registryState(manifest) {
  const ids=new Set(), paths=new Set();
  for (const kind of Object.keys(KIND_DIR)) for (const resource of manifest.resources?.[kind] ?? []) {
    if (resource?.id) ids.add(resource.id);
    if (resource?.path) paths.add(normalize(resource.path).replace(/^\.\//,''));
  }
  return {ids,paths};
}

function ensureFallbackArrays(manifest) {
  manifest.routing ??= {strategy:'priority-first-match',routes:[],fallback:{}};
  manifest.routing.fallback ??= {};
  for (const kind of Object.keys(KIND_DIR)) if (!Array.isArray(manifest.routing.fallback[kind])) manifest.routing.fallback[kind]=[];
}

function registerUnlistedNativeFiles(root, manifest) {
  const {ids,paths}=registryState(manifest), adopted=[];
  for (const [kind,dirName] of Object.entries(KIND_DIR)) {
    const kindRoot=path.join(root,'.agents',dirName);
    for (const full of walk(kindRoot)) {
      if (!eligible(kind,full,kindRoot)) continue;
      const rel=normalize(path.relative(root,full));
      if (paths.has(rel)) continue;
      const local=normalize(path.relative(kindRoot,full));
      let id=`native.${kind}.${slug(local.replace(/\.(?:md|json)$/i,''))}`;
      if (ids.has(id)) id=`${id}-${digest(rel)}`;
      ids.add(id); paths.add(rel);
      manifest.resources[kind].push({id,path:rel,native:true,tags:tagsFor(local)});
      manifest.routing.fallback[kind].push(id);
      adopted.push({kind,id,path:rel});
    }
  }
  return adopted;
}

function reconcileDelegation(manifest, scaffoldManifest, runtimeMode) {
  const mode = runtimeMode === 'SEQUENTIAL' ? 'SEQUENTIAL' : 'DEPENDENCY_SAFE_PARALLEL';
  manifest.delegation = {
    ...(scaffoldManifest.delegation ?? {}),
    ...(manifest.delegation ?? {}),
    mode,
    oneLifecycleActionAtATime: mode === 'SEQUENTIAL',
  };
  if (mode === 'DEPENDENCY_SAFE_PARALLEL') {
    for (const key of ['requireExplicitParallelSafe','requireOwnership','isolatedWorktrees','sequentialFallback','qualityGatesPreserved']) {
      manifest.delegation[key] = scaffoldManifest.delegation?.[key] === true;
    }
    manifest.delegation.integrationOwner = scaffoldManifest.delegation?.integrationOwner ?? 'role.orchestrator';
    manifest.delegation.boostCommand = scaffoldManifest.delegation?.boostCommand ?? '/boost';
    manifest.delegation.maxConcurrentTasks = scaffoldManifest.delegation?.maxConcurrentTasks ?? 3;
    manifest.delegation.maxAgentsPerTask = scaffoldManifest.delegation?.maxAgentsPerTask ?? 4;
    manifest.delegation.boostMaxConcurrentTasks = scaffoldManifest.delegation?.boostMaxConcurrentTasks ?? 6;
    manifest.delegation.boostMaxAgentsPerTask = scaffoldManifest.delegation?.boostMaxAgentsPerTask ?? 6;
  }
  return manifest;
}

function makeAllResourcesReachableFromFallback(manifest) {
  ensureFallbackArrays(manifest);
  for (const supplement of manifest.routing.supplements ?? []) {
    for (const role of supplement.use?.roles ?? []) manifest.routing.fallback.roles.push(role);
    if (supplement.use && Object.hasOwn(supplement.use,'roles')) delete supplement.use.roles;
  }
  for (const kind of Object.keys(KIND_DIR)) {
    for (const resource of manifest.resources[kind] ?? []) manifest.routing.fallback[kind].push(resource.id);
    manifest.routing.fallback[kind]=[...new Set(manifest.routing.fallback[kind])];
  }
}

/**
 * Build a temporary-but-valid Agent OS manifest for projects that already own a
 * semantic `.agents` layer but predate the ExecutionKit manifest contract. Existing
 * files are never rewritten. Core project-owned roles/skills/rules/workflows/contracts
 * must all exist; optional presentation/helper categories such as templates may be
 * absent and are then supplied by the canonical scaffold. This prevents a stray or
 * half-created `.agents` directory from being mistaken for a complete native Agent OS.
 */
export function synthesizeNativeAgentManifest(projectRoot, scaffoldManifest, { todoPath = 'TODO.md', standardVersion, runtimeMode = 'DEPENDENCY_SAFE_PARALLEL' } = {}) {
  const root = path.resolve(projectRoot), manifest = structuredClone(scaffoldManifest);
  if (!manifest?.resources || !manifest?.routing?.fallback) throw new Error('Scaffold Agent manifest is incomplete');
  manifest.standardVersion = standardVersion ?? manifest.standardVersion;
  reconcileDelegation(manifest, scaffoldManifest, runtimeMode);
  manifest.taskAuthority = { path:todoPath, mutableStateOwner:todoPath, shadowBacklogsForbidden:true };
  manifest.compatibility = { ...(manifest.compatibility ?? {}), nativeBootstrapAdoption:true, nativeBootstrapRouting:'fallback-until-EK00-004' };

  const nativeCounts = Object.fromEntries(Object.keys(KIND_DIR).map(kind=>[kind,0]));
  for (const [kind,dirName] of Object.entries(KIND_DIR)) {
    const kindRoot=path.join(root,'.agents',dirName);
    for (const full of walk(kindRoot)) if (eligible(kind,full,kindRoot)) nativeCounts[kind]++;
  }
  const missingCore=REQUIRED_NATIVE_KINDS.filter(kind=>nativeCounts[kind]===0);
  if (missingCore.length) throw new Error(`Native Agent resources need a configured manifest with real routes before auto adoption; incomplete semantic layer is missing ${missingCore.join(', ')}`);

  ensureFallbackArrays(manifest);
  const adopted=registerUnlistedNativeFiles(root,manifest);
  makeAllResourcesReachableFromFallback(manifest);
  return { manifest, adopted, nativeCounts };
}

/**
 * Upgrade a configured v2.2-era project manifest to current v3 invariants without
 * replacing project-owned specialists. Canonical scaffold resources are added only
 * when their id/path is absent. Legacy supplement roles are demoted to fallback until
 * EK00-004 can review specialist role semantics under the current no-role-override rule.
 */
export function migrateConfiguredAgentManifest(projectRoot, nativeManifest, scaffoldManifest, { todoPath='TODO.md', standardVersion, runtimeMode = 'DEPENDENCY_SAFE_PARALLEL' } = {}) {
  const root=path.resolve(projectRoot), manifest=structuredClone(nativeManifest);
  if (manifest.schemaVersion !== '2.2.0') throw new Error(`Configured Agent manifest schema ${manifest.schemaVersion ?? 'MISSING'} cannot be auto-migrated`);
  manifest.standardVersion=standardVersion ?? manifest.standardVersion;
  manifest.taskAuthority={path:todoPath,mutableStateOwner:todoPath,shadowBacklogsForbidden:true};
  manifest.resources ??= {};
  ensureFallbackArrays(manifest);

  const {ids,paths}=registryState(manifest), scaffoldAdded=[];
  for (const kind of Object.keys(KIND_DIR)) {
    if (!Array.isArray(manifest.resources[kind])) manifest.resources[kind]=[];
    for (const resource of scaffoldManifest.resources?.[kind] ?? []) {
      const rel=normalize(resource.path).replace(/^\.\//,'');
      if (ids.has(resource.id) || paths.has(rel)) continue;
      manifest.resources[kind].push(structuredClone(resource));
      ids.add(resource.id); paths.add(rel); scaffoldAdded.push({kind,id:resource.id,path:rel});
    }
  }
  const adopted=registerUnlistedNativeFiles(root,manifest);
  manifest.routing.routes ??= [];
  manifest.routing.supplements ??= [];
  const routeIds=new Set(manifest.routing.routes.map((item)=>item.id));
  const supplementIds=new Set(manifest.routing.supplements.map((item)=>item.id));
  const scaffoldRoutesAdded=[],scaffoldSupplementsAdded=[];
  for(const route of scaffoldManifest.routing?.routes??[]){
    if(routeIds.has(route.id))continue;
    manifest.routing.routes.push(structuredClone(route));routeIds.add(route.id);scaffoldRoutesAdded.push(route.id);
  }
  for(const supplement of scaffoldManifest.routing?.supplements??[]){
    if(supplementIds.has(supplement.id))continue;
    manifest.routing.supplements.push(structuredClone(supplement));supplementIds.add(supplement.id);scaffoldSupplementsAdded.push(supplement.id);
  }
  makeAllResourcesReachableFromFallback(manifest);
  manifest.resolution={...scaffoldManifest.resolution,...(manifest.resolution ?? {}),expandSkillDependencies:true};
  reconcileDelegation(manifest, scaffoldManifest, runtimeMode);
  manifest.compatibility={...(manifest.compatibility ?? {}),v3BootstrapMigration:true,preserveNativeResources:true,nativeResourcesRequireRegistration:true,nativeBootstrapRouting:'fallback-until-EK00-004'};
  return {manifest,adopted,scaffoldAdded,scaffoldRoutesAdded,scaffoldSupplementsAdded};
}
