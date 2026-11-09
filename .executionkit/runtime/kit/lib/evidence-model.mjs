import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadAdapterConfig } from './adapter-registry.mjs';
import { meaningfulGitStatus, resolveDerivedPath, resolveProjectPathSafe } from './derived-state.mjs';
import { loadConfig } from './execution-model.mjs';
import { todoShardSources } from './todo-shards.mjs';

export const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function git(root, args, required = true) { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 15000 }); if (r.status !== 0) { if (required) throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || r.stdout || r.error?.message || '').trim()}`); return null; } return r.stdout.trim(); }
function lockFiles(root) { return ['composer.lock','package-lock.json','pnpm-lock.yaml','yarn.lock','bun.lock','bun.lockb','pubspec.lock'].filter((rel) => fs.existsSync(path.join(root, rel))); }
function safeRelativeFile(root, rel, { mustExist = false } = {}) { return resolveProjectPathSafe(root, rel, 'Evidence path', { mustExist, file:true }); }
function controlFiles(root) {
  const { config } = loadConfig(root);
  const todo=todoShardSources(root,config);
  if(todo.errors.length)throw new Error(todo.errors.map((e)=>'['+e.code+'] '+e.message).join('; '));
  const taskAuthority=todo.mode==='sharded'
    ? [todo.manifestPath,...todo.active.map((x)=>x.path),...todo.archives]
    : [config.todoPath,...(config.taskArchivePaths??[]).filter((rel)=>fs.existsSync(safeRelativeFile(root,rel)))];
  const mandatory = ['execution.config.json', ...taskAuthority, config.agent?.manifestPath].filter(Boolean);
  const optional = [config.evidence?.adapterConfigPath ?? 'executionkit.adapters.json', config.discovery?.scopePath ?? 'executionkit.scope.json', config.integration?.journeyContractPath ?? 'executionkit.integration.json', config.seo?.contractPath, 'executionkit.components.json','executionkit.design.json', config.quality?.contractPath, ...lockFiles(root)].filter(Boolean);
  const out = [];
  for (const rel of [...new Set(mandatory)]) { safeRelativeFile(root, rel, { mustExist:true }); out.push(rel); }
  for (const rel of [...new Set(optional)]) { const full = safeRelativeFile(root, rel); if (fs.existsSync(full)) out.push(rel); }
  return [...new Set(out)];
}

export function buildCandidate(root, { allowDirty = false } = {}) {
  const rawStatus = git(root, ['status','--porcelain']), status = meaningfulGitStatus(rawStatus);
  if (status && !allowDirty) throw new Error(`Candidate requires a clean working tree; meaningful changes remain:\n${status}`);
  const commit = git(root, ['rev-parse','HEAD']), tree = git(root, ['rev-parse','HEAD^{tree}']);
  const hashes = {}; for (const rel of controlFiles(root)) hashes[rel] = sha256(safeRelativeFile(root, rel, { mustExist:true }));
  const platform = process.platform, arch = process.arch, node = process.version;
  const environment = process.env.EXECUTIONKIT_ENVIRONMENT ?? 'local', buildId = process.env.EXECUTIONKIT_BUILD_ID ?? null;
  const material = JSON.stringify({ commit, tree, hashes, platform, arch, node, environment, buildId });
  const candidateId = crypto.createHash('sha256').update(material).digest('hex').slice(0, 20);
  return { schemaVersion:'1.0.0', candidateId, commit, tree, dirty:Boolean(status), generatedAt:new Date().toISOString(), hashes, platform, arch, node, environment, buildId };
}
export function candidateFile(root) { return resolveDerivedPath(root, '.executionkit/candidate.json', 'candidate envelope'); }
export function writeCandidate(root, candidate) {
  const file = resolveDerivedPath(root, '.executionkit/candidate.json', 'candidate envelope', { createParents:true });
  if (!candidate.previousCandidate && fs.existsSync(file)) {
    try {
      const previous = JSON.parse(fs.readFileSync(file,'utf8'));
      if (previous?.candidateId && previous.candidateId !== candidate.candidateId && previous.commit) {
        candidate.previousCandidate = {
          candidateId: previous.candidateId,
          commit: previous.commit,
          tree: previous.tree ?? null,
          generatedAt: previous.generatedAt ?? null,
        };
      }
    } catch {}
  }
  fs.writeFileSync(file, `${JSON.stringify(candidate,null,2)}\n`);
  return file;
}
export function loadCandidate(root) { const file = resolveDerivedPath(root, '.executionkit/candidate.json', 'candidate envelope', { mustExist:true, file:true }); return JSON.parse(fs.readFileSync(file,'utf8')); }
export function validateCandidate(root, candidate = loadCandidate(root)) {
  const errors = []; let current;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return { errors:[{ code:'CANDIDATE_SCHEMA', message:'Candidate must be an object' }], candidate };
  try { current = buildCandidate(root); } catch (error) { errors.push({ code:'CANDIDATE_WORKTREE_INVALID', message:error.message }); return { errors, candidate }; }
  if (candidate.schemaVersion !== '1.0.0') errors.push({ code:'CANDIDATE_SCHEMA', message:`Unsupported schema ${candidate.schemaVersion ?? 'MISSING'}` });
  for (const key of ['candidateId','commit','tree','platform','arch','node','environment','buildId']) if ((candidate[key] ?? null) !== (current[key] ?? null)) errors.push({ code:'CANDIDATE_STALE', message:`${key} differs: candidate=${candidate[key] ?? 'null'} current=${current[key] ?? 'null'}` });
  const currentKeys = Object.keys(current.hashes).sort(), candidateKeys = Object.keys(candidate.hashes ?? {}).sort();
  if (JSON.stringify(currentKeys) !== JSON.stringify(candidateKeys)) errors.push({ code:'CANDIDATE_CONTROL_SET_CHANGED', message:'Candidate control-file set changed' });
  for (const [rel, hash] of Object.entries(candidate.hashes ?? {})) { try { const full = safeRelativeFile(root, rel, { mustExist:true }); if (sha256(full) !== hash) errors.push({ code:'CANDIDATE_SOURCE_CHANGED', message:rel }); } catch (error) { errors.push({ code:'CANDIDATE_SOURCE_CHANGED', message:`${rel}: ${error.message}` }); } }
  return { errors, candidate, current };
}

export function evidenceDirectory(root, candidateId, { create = false } = {}) {
  if (typeof candidateId !== 'string' || !/^[a-f0-9]{20}$/.test(candidateId)) throw new Error(`Invalid candidateId for evidence storage: ${candidateId ?? 'MISSING'}`);
  return resolveDerivedPath(root, `.executionkit/evidence/${candidateId}`, 'candidate evidence directory', { createParents:create });
}
function validateScenarioManifest(root, cfg, producer, candidate, rel = cfg?.scenarioReportPath) {
  const errors = [];
  if (!rel) return { errors, manifest:null, full:null, hash:null };
  let full, manifest;
  try {
    full = safeRelativeFile(root, rel, { mustExist:true });
    manifest = JSON.parse(fs.readFileSync(full,'utf8'));
  } catch (error) {
    return { errors:[`Scenario report is unavailable or invalid JSON: ${error.message}`], manifest:null, full:null, hash:null };
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) errors.push('Scenario report must be an object');
  if (manifest?.schemaVersion !== '1.0.0') errors.push(`Scenario report schemaVersion must be 1.0.0, got ${manifest?.schemaVersion ?? 'MISSING'}`);
  if (manifest?.producer !== producer) errors.push(`Scenario report producer differs: expected ${producer}, got ${manifest?.producer ?? 'MISSING'}`);
  if (manifest?.candidateId !== candidate?.candidateId) errors.push(`Scenario report candidateId differs from current candidate`);
  const journeys = manifest?.journeys;
  if (!journeys || typeof journeys !== 'object' || Array.isArray(journeys)) errors.push('Scenario report journeys must be an object');
  for (const [journeyId, required] of Object.entries(cfg?.journeyCoverage ?? {})) {
    const statuses = journeys?.[journeyId];
    if (!statuses || typeof statuses !== 'object' || Array.isArray(statuses)) {
      errors.push(`Scenario report is missing journey ${journeyId}`);
      continue;
    }
    for (const scenario of required ?? []) if (statuses?.[scenario] !== 'PASS') {
      errors.push(`Scenario ${journeyId}/${scenario} is not PASS in the current scenario report`);
    }
  }
  return { errors, manifest, full, hash:full ? sha256(full) : null };
}

function producerConfigs(root) {
  const { config } = loadConfig(root), cfg = loadAdapterConfig(root, config.evidence?.adapterConfigPath ?? 'executionkit.adapters.json').adapters;
  const entries = Object.entries(cfg).filter(([,value]) => value && typeof value === 'object' && value.kind === 'evidence');
  for (const [id] of entries) if (!/^[a-z0-9][a-z0-9._-]*$/.test(id)) throw new Error(`Invalid evidence producer id: ${id}`);
  return entries;
}
export function collectEvidence(root, { selected = null } = {}) {
  const candidate = loadCandidate(root), checked = validateCandidate(root,candidate); if (checked.errors.length) throw new Error(checked.errors.map((e)=>`[${e.code}] ${e.message}`).join('; '));
  const dir = evidenceDirectory(root,candidate.candidateId,{create:true}); fs.mkdirSync(dir,{recursive:true}); const reports=[];
  const producers = producerConfigs(root), availableIds = new Set(producers.map(([id]) => id));
  for (const requested of selected ?? []) if (!availableIds.has(requested)) throw new Error(`Requested evidence producer is not configured: ${requested}`);
  for (const [id,cfg] of producers) {
    if (selected?.length && !selected.includes(id)) continue;
    if (!cfg.command) { reports.push({ producer:id,status:'NOT_CONFIGURED' }); continue; }
    let artifactFull = null, artifactBefore = null;
    if (cfg.reportPath) {
      artifactFull = safeRelativeFile(root, cfg.reportPath);
      if (fs.existsSync(artifactFull)) artifactBefore = { mtimeMs:fs.statSync(artifactFull).mtimeMs, sha256:sha256(artifactFull) };
    }
    let scenarioFull = null, scenarioBefore = null;
    if (cfg.scenarioReportPath) {
      scenarioFull = safeRelativeFile(root, cfg.scenarioReportPath);
      if (fs.existsSync(scenarioFull)) scenarioBefore = { mtimeMs:fs.statSync(scenarioFull).mtimeMs, sha256:sha256(scenarioFull) };
    }
    const startedAtMs = Date.now(), startedAt = new Date(startedAtMs).toISOString();
    const r = spawnSync(cfg.command,{cwd:root,shell:true,encoding:'utf8',timeout:Number(cfg.timeoutMs??900000),maxBuffer:32*1024*1024,env:{...process.env,EXECUTIONKIT_CANDIDATE_ID:candidate.candidateId,EXECUTIONKIT_CANDIDATE_COMMIT:candidate.commit,EXECUTIONKIT_ENVIRONMENT:candidate.environment,EXECUTIONKIT_BUILD_ID:candidate.buildId??''}});
    const report={schemaVersion:'1.0.0',kind:cfg.evidenceType??'command',producer:id,trustedProducer:'executionkit.collect-evidence',candidateId:candidate.candidateId,commit:candidate.commit,tree:candidate.tree,environment:candidate.environment,buildId:candidate.buildId??null,platform:candidate.platform,arch:candidate.arch,node:candidate.node,command:cfg.command,startedAt,completedAt:new Date().toISOString(),exitCode:r.status,signal:r.signal,result:!r.error&&r.status===0?'PASS':'FAIL',stdout:r.stdout??'',stderr:r.stderr??'',error:r.error?.message??null,reportPath:cfg.reportPath??null,scenarioReportPath:cfg.scenarioReportPath??null};
    if (cfg.reportPath) {
      if (!fs.existsSync(artifactFull)) { report.result='FAIL'; report.error = report.error ?? `Configured reportPath was not produced by the current run: ${cfg.reportPath}`; }
      else {
        safeRelativeFile(root, cfg.reportPath, { mustExist:true });
        const stat=fs.statSync(artifactFull), hash=sha256(artifactFull), changed=!artifactBefore || stat.mtimeMs!==artifactBefore.mtimeMs || hash!==artifactBefore.sha256;
        if (!changed || stat.mtimeMs < startedAtMs - 2000) { report.result='FAIL'; report.error = report.error ?? `Configured reportPath was not refreshed by the current run: ${cfg.reportPath}`; }
        else report.artifact={path:cfg.reportPath,sha256:hash};
      }
    }
    if (cfg.scenarioReportPath) {
      if (!fs.existsSync(scenarioFull)) {
        report.result='FAIL';
        report.error = report.error ?? `Configured scenarioReportPath was not produced by the current run: ${cfg.scenarioReportPath}`;
      } else {
        safeRelativeFile(root, cfg.scenarioReportPath, { mustExist:true });
        const stat=fs.statSync(scenarioFull), hash=sha256(scenarioFull), changed=!scenarioBefore || stat.mtimeMs!==scenarioBefore.mtimeMs || hash!==scenarioBefore.sha256;
        if (!changed || stat.mtimeMs < startedAtMs - 2000) {
          report.result='FAIL';
          report.error = report.error ?? `Configured scenarioReportPath was not refreshed by the current run: ${cfg.scenarioReportPath}`;
        } else {
          const scenario=validateScenarioManifest(root,cfg,id,candidate,cfg.scenarioReportPath);
          if (scenario.errors.length) {
            report.result='FAIL';
            report.error = report.error ?? scenario.errors.join('; ');
          } else report.scenarioArtifact={path:cfg.scenarioReportPath,sha256:hash};
        }
      }
    }
    const reportFile=resolveDerivedPath(root,`.executionkit/evidence/${candidate.candidateId}/${id}.json`,'evidence report',{createParents:true});
    const after = validateCandidate(root, candidate);
    if (after.errors.length) { report.result='FAIL'; report.error=`Candidate changed during collection: ${after.errors.map((e)=>e.message).join('; ')}`; }
    fs.writeFileSync(reportFile,`${JSON.stringify(report,null,2)}\n`); reports.push(report);
  }
  return {candidate,reports};
}
export function loadEvidence(root, candidateId = loadCandidate(root).candidateId) {
  const dir = evidenceDirectory(root,candidateId); if (!fs.existsSync(dir)) return [];
  const out = [], ids = new Set();
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if (entry.isSymbolicLink()) throw new Error(`Evidence report may not be a symbolic link: ${entry.name}`);
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const report = JSON.parse(fs.readFileSync(path.join(dir,entry.name),'utf8'));
    if (!report || typeof report !== 'object' || Array.isArray(report) || typeof report.producer !== 'string' || ids.has(report.producer) || entry.name !== `${report.producer}.json`) throw new Error(`Invalid, duplicate or misnamed evidence report: ${entry.name}`);
    ids.add(report.producer); out.push(report);
  }
  return out.sort((a,b)=>a.producer.localeCompare(b.producer));
}

export function validateCollectedEvidence(root, candidate, report, { maxAgeMinutes = 1440, now = Date.now() } = {}) {
  const errors = [], cfg = new Map(producerConfigs(root)).get(report?.producer);
  if (!cfg?.command || report?.command !== cfg.command) errors.push('Producer command is missing or differs from the configured command');
  if (!report || report.schemaVersion !== '1.0.0' || report.result !== 'PASS' || report.trustedProducer !== 'executionkit.collect-evidence' || report.exitCode !== 0 || report.signal != null || report.error != null) errors.push('Evidence is not a successful collector result');
  for (const key of ['candidateId','commit','tree','environment','buildId','platform','arch','node']) if ((report?.[key] ?? null) !== (candidate?.[key] ?? null)) errors.push(`Evidence ${key} differs from current candidate/environment`);
  const start = Date.parse(report?.startedAt ?? ''), end = Date.parse(report?.completedAt ?? '');
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end > now + 60_000) errors.push('Evidence timestamps are invalid or in the future');
  if (!Number.isFinite(maxAgeMinutes) || maxAgeMinutes <= 0) errors.push('Evidence maxAgeMinutes must be a positive finite number');
  else if (now - end > maxAgeMinutes * 60_000) errors.push(`Evidence is stale (> ${maxAgeMinutes} min)`);
  const rel = cfg?.reportPath ?? null;
  if ((report?.reportPath ?? null) !== rel || (rel && report?.artifact?.path !== rel) || (!rel && report?.artifact)) errors.push('Evidence artifact is not bound to configured reportPath');
  if (rel) try {
    const full = safeRelativeFile(root, rel, { mustExist:true });
    if (!/^[a-f0-9]{64}$/.test(report?.artifact?.sha256 ?? '') || sha256(full) !== report.artifact.sha256) errors.push('Evidence artifact hash differs from the collected report');
  } catch (error) { errors.push(error.message); }
  const scenarioRel = cfg?.scenarioReportPath ?? null;
  if ((report?.scenarioReportPath ?? null) !== scenarioRel || (scenarioRel && report?.scenarioArtifact?.path !== scenarioRel) || (!scenarioRel && report?.scenarioArtifact)) errors.push('Scenario evidence artifact is not bound to configured scenarioReportPath');
  if (scenarioRel) try {
    const scenario=validateScenarioManifest(root,cfg,report?.producer,candidate,scenarioRel);
    if (!/^[a-f0-9]{64}$/.test(report?.scenarioArtifact?.sha256 ?? '') || !scenario.full || sha256(scenario.full) !== report.scenarioArtifact.sha256) errors.push('Scenario evidence artifact hash differs from the collected report');
    errors.push(...scenario.errors);
  } catch (error) { errors.push(error.message); }
  return errors;
}
export function buildEvidenceGraph(root){const candidate=loadCandidate(root),reports=loadEvidence(root,candidate.candidateId),nodes=[{id:`candidate:${candidate.candidateId}`,type:'candidate',data:candidate}],edges=[];for(const report of reports){const id=`evidence:${report.producer}`;nodes.push({id,type:'evidence',data:{producer:report.producer,result:report.result,kind:report.kind,completedAt:report.completedAt,trustedProducer:report.trustedProducer??null,candidateId:report.candidateId??null}});edges.push({from:id,to:`candidate:${candidate.candidateId}`,relation:'validates'});}return{schemaVersion:'1.0.0',generatedAt:new Date().toISOString(),nodes,edges};}
