#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assembleCanonicalTodoMarkdown, closureSummary, declaredAuditBoundary, declaredExecutionAction, extractTags, loadConfig, loadTasks } from '../lib/execution-model.mjs';
import { loadAgentManifest } from '../lib/agent-model.mjs';
import { validateQuality } from '../lib/quality-model.mjs';
import { evaluateSeoApplicability, loadSeoContract } from '../lib/seo-model.mjs';
import { validateCandidate, loadCandidate, loadEvidence, validateCollectedEvidence } from '../lib/evidence-model.mjs';
import { meaningfulGitStatus, resolveDerivedPath, resolveProjectPathSafe } from '../lib/derived-state.mjs';
import { discoverProduct, reconcileCoverage } from '../lib/discovery-model.mjs';
import { analyzeRevalidation } from '../lib/revalidation-model.mjs';
import { validateDocumentationFabric } from '../lib/documentation-fabric.mjs';
import { validateProductionDeploymentReadiness } from '../lib/production-deployment.mjs';
import { validateV4ReleaseGates } from '../lib/v4-release-gates.mjs';

const args = process.argv.slice(2);
const projectRoot = path.resolve(args.find((arg) => !arg.startsWith('--')) ?? '.');
const kitRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const errors = [], notes = [];

function run(command, commandArgs) { return spawnSync(command, commandArgs, { cwd: projectRoot, encoding: 'utf8', timeout: 900000, maxBuffer: 32 * 1024 * 1024 }); }
function output(result) { return (result.stderr || result.stdout || result.error?.message || '').trim(); }
function inside(rel, label, options = {}) { return resolveProjectPathSafe(projectRoot, rel, label, options); }
function readJson(rel) { return JSON.parse(fs.readFileSync(inside(rel, rel, { mustExist:true, file:true }), 'utf8')); }
function runKitScript(rel, extra = []) {
  const full=path.resolve(kitRoot,rel),delta=path.relative(kitRoot,full);
  if(delta.startsWith('..')||path.isAbsolute(delta))return {missing:false,status:1,stdout:'',stderr:'release tool escapes trusted Kit runtime: '+rel};
  if(!fs.existsSync(full)||!fs.statSync(full).isFile())return {missing:true,status:null,stdout:'',stderr:''};
  return run(process.execPath,[full,projectRoot,...extra]);
}
function discoveryInventoryComparable(value) { return JSON.stringify({ schemaVersion:value?.schemaVersion ?? null, root:value?.root ?? null, stacks:value?.stacks ?? [], fileCount:value?.fileCount ?? null, items:value?.items ?? [], counts:value?.counts ?? {} }); }
function reconciliationComparable(value) { return JSON.stringify({ schemaVersion:value?.schemaVersion ?? null, inventoryCounts:value?.inventoryCounts ?? {}, declaredRequired:value?.declaredRequired ?? null, declaredExcluded:value?.declaredExcluded ?? null, findings:value?.findings ?? [], blockingFindings:value?.blockingFindings ?? [], releaseReady:value?.releaseReady ?? null, counts:value?.counts ?? {} }); }

const requiredProjectAuthorities=['AGENTS.md','execution.config.json'];
for(const rel of requiredProjectAuthorities)try{inside(rel,`required project release authority ${rel}`,{mustExist:true,file:true});}catch(error){errors.push(error.message);}
let config;
try { ({ config } = loadConfig(projectRoot)); } catch (error) { errors.push(`config parse failed: ${error.message}`); }
if (config?.projectState !== 'ACTIVE') errors.push(`projectState must be ACTIVE for release, got ${config?.projectState ?? 'UNKNOWN'}`);

const isV4 = /^[45]\./.test(String(config?.standardVersion ?? '')) || fs.existsSync(path.resolve(kitRoot, 'bin/executionkit-cli.mjs'));
const requiredRuntimeTools = isV4
  ? ['bin/validate-execution.mjs','bin/validate-integration.mjs','bin/validate-deep-integration.mjs','bin/validate-agents.mjs','bin/validate-ci-policy.mjs','bin/validate-candidate.mjs','bin/discover-product.mjs','bin/executionkit-cli.mjs']
  : ['bin/validate-execution.mjs','bin/validate-integration.mjs','bin/validate-deep-integration.mjs','bin/validate-agents.mjs','bin/validate-ci-policy.mjs','bin/validate-v22-policy.mjs','bin/next-execution.mjs','bin/resolve-task-context.mjs','bin/validate-candidate.mjs','bin/discover-product.mjs','bin/reconcile-product.mjs'];
for(const rel of requiredRuntimeTools){const full=path.resolve(kitRoot,rel),delta=path.relative(kitRoot,full);if(delta.startsWith('..')||path.isAbsolute(delta)||!fs.existsSync(full)||!fs.statSync(full).isFile())errors.push('required trusted Kit runtime component missing: '+rel);}

if (config) try {
  const { manifest, manifestPath } = loadAgentManifest(projectRoot, config);
  if (manifest.standardVersion !== config.standardVersion) errors.push(`version mismatch: ${manifestPath} ${manifest.standardVersion} vs execution config ${config.standardVersion}`);
  if (String(config.standardVersion).startsWith('2.2') && (manifest.schemaVersion !== '2.2.0' || manifest.delegation?.mode !== 'SEQUENTIAL' || manifest.delegation?.oneLifecycleActionAtATime !== true)) errors.push('v2.2 Agent manifest must use schema 2.2.0 and sequential one-action delegation');
  if (Object.hasOwn(manifest, 'parallelism')) errors.push('parallelism/parallel-session policy is forbidden in v2.2 Agent manifests');
} catch (error) { errors.push(`agent manifest load failed: ${error.message}`); }

const gitStatus = run('git', ['status', '--porcelain']);
if (gitStatus.status !== 0) errors.push(`git status failed: ${output(gitStatus)}`);
else { const meaningful = meaningfulGitStatus(gitStatus.stdout); if (meaningful) errors.push(`local working tree is not clean:\n${meaningful}`); }
const branch = run('git', ['symbolic-ref', '--quiet', '--short', 'HEAD']);
if (branch.status !== 0) errors.push('release readiness requires a named local branch; detached HEAD is not accepted');
const allowUnpushed = args.includes('--allow-unpushed') || process.env.EXECUTIONKIT_ALLOW_UNPUSHED === '1' || config?.controlPlane?.requiredForLocalExecution === false;
const upstream = run('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
if (upstream.status !== 0) {
  if (allowUnpushed) notes.push('current branch has no configured upstream; local release permitted (controlPlane.requiredForLocalExecution=false)');
  else errors.push('current branch has no configured upstream; synchronized pushed-state cannot be proven');
} else {
  const ahead = run('git', ['rev-list', '--count', '@{upstream}..HEAD']), behind = run('git', ['rev-list', '--count', 'HEAD..@{upstream}']);
  if (ahead.status !== 0) {
    if (allowUnpushed) notes.push(`could not determine unpushed commits: ${output(ahead)}`);
    else errors.push(`could not determine unpushed commits: ${output(ahead)}`);
  } else if (Number(ahead.stdout.trim()) > 0) {
    if (allowUnpushed) notes.push(`current branch has ${ahead.stdout.trim()} unpushed commit(s) (permitted: controlPlane.requiredForLocalExecution=false)`);
    else errors.push(`current branch has ${ahead.stdout.trim()} unpushed commit(s)`);
  }
  if (behind.status !== 0) errors.push(`could not determine commits missing from local branch: ${output(behind)}`); else if (Number(behind.stdout.trim()) > 0) errors.push(`current branch is ${behind.stdout.trim()} commit(s) behind its upstream`);
}
try {
  const versionFile=inside('VERSION','VERSION',{file:true}), packageFile=inside('package.json','package.json',{file:true});
  if (fs.existsSync(versionFile) && fs.existsSync(packageFile)) { const version=fs.readFileSync(versionFile,'utf8').trim(),pkg=readJson('package.json'); if(pkg.version&&pkg.version!==version)errors.push(`VERSION ${version} != package.json ${pkg.version}`); }
} catch (error) { errors.push(`version/package path validation failed: ${error.message}`); }

let executionIntegrityPassed = false;
for (const script of ['bin/validate-agents.mjs','bin/validate-v22-policy.mjs','bin/validate-execution.mjs','bin/validate-integration.mjs','bin/validate-ci-policy.mjs','bin/validate-deep-integration.mjs']) {
  const extra = script === 'bin/validate-deep-integration.mjs' ? ['--require-gate-accepted'] : script === 'bin/validate-integration.mjs' ? ['--release'] : [];
  const result = runKitScript(script, extra);
  if (result.missing) continue;
  if (result.status !== 0) errors.push(`${script} failed:\n${output(result)}`);
  if (script === 'bin/validate-execution.mjs' && result.status === 0) executionIntegrityPassed = true;
}
if (config && executionIntegrityPassed) {
  const { tasks, errors: loadErrors } = loadTasks(projectRoot, config);
  if (loadErrors.length) errors.push(`task closure load failed: ${loadErrors.map((error) => `[${error.code}] ${error.message}`).join('; ')}`);
  else {
    const implementationTasks = tasks.filter((t) => !(declaredExecutionAction(t) === 'audit' && declaredAuditBoundary(t) === 'release') && !extractTags(t).includes('launch') && !extractTags(t).includes('release'));
    const closure = closureSummary(implementationTasks, config);
    if (!closure.closed) errors.push(`canonical execution is not closed: ${closure.nonTerminal} non-terminal task(s) remain (${closure.nonTerminalTaskIds.join(', ')})`);
  }
}

if (config && Object.hasOwn(config, 'quality')) {
  try { errors.push(...validateQuality(projectRoot, config, { release: true }).errors.map((e) => `[${e.code}] ${e.message}`)); } catch (error) { errors.push(`Product quality evidence failed: ${error.message}`); }
} else notes.push('Product quality contract: NOT_CONFIGURED');

if (config?.discovery?.requiredForRelease === true) {
  const scopeRel = config.discovery.scopePath ?? 'executionkit.scope.json', inventoryRel = config.discovery.inventoryPath ?? '.executionkit/discovery/product-inventory.json', reconciliationRel = config.discovery.reconciliationPath ?? '.executionkit/discovery/reconciliation.json';
  let scopeFull = null, inventoryFull = null, reconciliationFull = null;
  try { scopeFull = inside(scopeRel, 'discovery.scopePath', { file:true }); inventoryFull = resolveDerivedPath(projectRoot, inventoryRel, 'discovery.inventoryPath', { file:true }); reconciliationFull = resolveDerivedPath(projectRoot, reconciliationRel, 'discovery.reconciliationPath', { file:true }); } catch (error) { errors.push(error.message); }
  let scope = null;
  if (scopeFull && !fs.existsSync(scopeFull)) errors.push(`required discovery scope missing: ${scopeRel}`);
  else if (scopeFull) try {
    scope = JSON.parse(fs.readFileSync(scopeFull, 'utf8'));
    if (scope.schemaVersion !== '1.0.0' || !Array.isArray(scope.required) || !Array.isArray(scope.excluded)) errors.push(`discovery scope is invalid: ${scopeRel}`);
    else if (scope.required.length === 0 && config.discovery.allowEmptyScopeForRelease !== true) errors.push('discovery.requiredForRelease=true requires a non-empty approved scope.required[]; set allowEmptyScopeForRelease=true only for a deliberately empty product denominator');
  } catch (error) { errors.push(`discovery scope invalid: ${error.message}`); }
  let persistedInventory = null, persistedReconciliation = null;
  if (inventoryFull && !fs.existsSync(inventoryFull)) errors.push(`required discovery inventory missing: ${inventoryRel}`); else if (inventoryFull) try { persistedInventory = JSON.parse(fs.readFileSync(inventoryFull, 'utf8')); } catch (error) { errors.push(`discovery inventory invalid: ${error.message}`); }
  if (reconciliationFull && !fs.existsSync(reconciliationFull)) errors.push(`required discovery reconciliation missing: ${reconciliationRel}`); else if (reconciliationFull) try { persistedReconciliation = JSON.parse(fs.readFileSync(reconciliationFull, 'utf8')); } catch (error) { errors.push(`discovery reconciliation invalid: ${error.message}`); }
  if (inventoryFull && (!persistedInventory || typeof persistedInventory !== 'object' || Array.isArray(persistedInventory))) errors.push('discovery inventory must be an object');
  if (reconciliationFull && (!persistedReconciliation || typeof persistedReconciliation !== 'object' || Array.isArray(persistedReconciliation))) errors.push('discovery reconciliation must be an object');
  if (scope && persistedInventory && persistedReconciliation) try {
    const assembledTodo=assembleCanonicalTodoMarkdown(projectRoot,config,{includeArchives:true}); if(assembledTodo.errors.length)throw new Error(assembledTodo.errors.map((e)=>'['+e.code+'] '+e.message).join('; ')); const todoText=assembledTodo.markdown, liveInventory = discoverProduct(projectRoot);
    const liveReconciliation = reconcileCoverage(projectRoot, liveInventory, { todoText, scopePath: scopeRel });
    if (discoveryInventoryComparable(persistedInventory) !== discoveryInventoryComparable(liveInventory)) errors.push('persisted discovery inventory is stale relative to the current working tree; run discover-product again');
    if (reconciliationComparable(persistedReconciliation) !== reconciliationComparable(liveReconciliation)) errors.push('persisted discovery reconciliation is stale relative to the current scope/TODO/inventory; run reconcile-product again');
    const blocking = liveReconciliation.blockingFindings ?? [];
    if (liveReconciliation.releaseReady !== true || blocking.length) errors.push(`live product reconciliation has ${blocking.length || 'one or more'} unresolved blocking gap(s)`);
  } catch (error) { errors.push(`live discovery/reconciliation verification failed: ${error.message}`); }
} else notes.push('Discovery release denominator: NOT_REQUIRED');

if(config?.documentation?.requiredForRelease===true){
  try{
    const docs=validateDocumentationFabric(projectRoot);
    if(!docs.ok) errors.push(`Documentation Fabric release gate failed: ${docs.errors.map((e)=>e.code+':'+(e.documentId??e.path??'unknown')).join(', ')}`);
    else notes.push(`Documentation Fabric release gate: PASS (${docs.registry.coverage.percent}% required coverage)`);
  }catch(error){errors.push(`Documentation Fabric release gate failed: ${error.message}`);}
}else notes.push('Documentation Fabric release gate: NOT_REQUIRED');

if(config?.deployment?.requiredForRelease===true){
  try{
    const deployment=validateProductionDeploymentReadiness(projectRoot);
    if(!deployment.ok) errors.push(`Production Deployment Fabric release gate failed: ${deployment.errors.map((e)=>e.code+(e.message?':'+e.message:'')).join(', ')}`);
    else notes.push(`Production Deployment Fabric release gate: PASS (artifact ${deployment.artifact?.releaseId??'UNKNOWN'}, target ${deployment.target?.type??'UNKNOWN'})`);
  }catch(error){errors.push(`Production Deployment Fabric release gate failed: ${error.message}`);}
}else notes.push('Production Deployment Fabric release gate: NOT_REQUIRED');

let seoReleaseApplicable = false;
if (config?.seo?.requiredForRelease === true) {
  try {
    const loadedSeo = loadSeoContract(projectRoot, config, { required: (config.capabilities?.seo ?? 'NONE') !== 'NONE' });
    if (loadedSeo.status === 'FAIL') errors.push(`SEO contract invalid: ${loadedSeo.errors.map((e) => `[${e.code}] ${e.message}`).join('; ')}`);
    else {
      const seoApplicability = evaluateSeoApplicability(loadedSeo.contract);
      seoReleaseApplicable = seoApplicability.applicable;
      if (!seoReleaseApplicable) notes.push(`SEO release gate: NOT_APPLICABLE (${seoApplicability.rationale})`);
    }
  } catch (error) { errors.push(`SEO applicability failed: ${error.message}`); }
} else notes.push('SEO release gate: NOT_REQUIRED');

const requiredProducers = config?.evidence?.requiredProducers ?? [];
const strictReleaseTruth = config?.capabilities?.launch !== 'NONE' && config?.evidence?.releaseTruthMode === 'STRICT';
if (strictReleaseTruth) {
  if (config.evidence?.candidateRequiredForRelease !== true) errors.push('strict release truth requires evidence.candidateRequiredForRelease=true');
  if (requiredProducers.length === 0) errors.push('strict release truth requires at least one configured evidence.requiredProducers entry collected by ExecutionKit');
  if (config.evidence?.requireTestAdequacy !== true) errors.push('strict release truth requires evidence.requireTestAdequacy=true');
  if (!config.evidence?.testReportPath) errors.push('strict release truth requires a concrete evidence.testReportPath bound to a trusted producer');
}
const candidateRequired = /^[45]\./.test(String(config?.standardVersion??'')) || strictReleaseTruth || config?.evidence?.candidateRequiredForRelease === true || requiredProducers.length > 0 || config?.evidence?.requireTestAdequacy === true || seoReleaseApplicable;
let candidate = null;
if (candidateRequired) try { candidate = loadCandidate(projectRoot); const checked = validateCandidate(projectRoot, candidate); if (checked.errors.length) errors.push(`candidate validation failed: ${checked.errors.map((e) => `[${e.code}] ${e.message}`).join('; ')}`); } catch (error) { errors.push(`candidate envelope required: ${error.message}`); }
else notes.push('Candidate envelope: NOT_REQUIRED');

if (config?.seo?.requiredForRelease === true) {
  const seoGate = runKitScript('bin/validate-seo.mjs', ['--release']);
  if (seoGate.missing) errors.push('SEO release gate is required but bin/validate-seo.mjs is missing');
  else if (seoGate.status !== 0) errors.push(`SEO release gate failed:\n${output(seoGate)}`);
  else if (seoReleaseApplicable) notes.push('SEO S3 release gate: PASS for current candidate contract binding; runtime/production claims still require their declared evidence.');
}

const maxAgeMinutes = Number(config?.evidence?.maxAgeMinutes ?? 1440);
const validEvidence = [];
if (candidate && (requiredProducers.length || config?.evidence?.requireTestAdequacy === true)) {
  try {
    const reports = loadEvidence(projectRoot, candidate.candidateId), byProducer = new Map(reports.map((report) => [report.producer, report]));
    for (const id of requiredProducers) if (!byProducer.has(id)) errors.push(`required evidence producer missing for candidate ${candidate.candidateId}: ${id}`);
    for (const report of reports) {
      const failures = validateCollectedEvidence(projectRoot, candidate, report, { maxAgeMinutes });
      if (!failures.length) validEvidence.push(report);
      else if (requiredProducers.includes(report.producer)) errors.push(`required evidence producer is not a trusted PASS for the current candidate/environment: ${report.producer}: ${failures.join('; ')}`);
    }
  } catch (error) { errors.push(`required evidence loading failed: ${error.message}`); }
}

if (strictReleaseTruth) {
  try {
    const revalidation = analyzeRevalidation(projectRoot);
    if (revalidation.revalidationRequired) {
      const impacted = revalidation.impactedJourneys?.map((item) => item.id).join(', ') || 'none mapped';
      const accepted = revalidation.acceptedTasksAtRisk?.map((item) => item.taskId).join(', ') || 'none mapped';
      errors.push(`candidate changes require revalidation before release; impacted journeys: ${impacted}; accepted contracts at risk: ${accepted}; missing/invalid current evidence: ${revalidation.evidence?.missing?.join(', ') || 'unknown'}`);
    } else notes.push(`Change-impact revalidation: ${revalidation.status}`);
  } catch (error) { errors.push(`change-impact revalidation failed: ${error.message}`); }
}

if(/^[45]\./.test(String(config?.standardVersion??'')) && candidate){
  try{
    const v4=validateV4ReleaseGates(projectRoot,{candidate,checkDeployment:config?.deployment?.enabled!==false&&config?.distributionRepository!==true});
    if(!v4.ok)errors.push('v4 final release gates failed: '+v4.errors.map((e)=>e.code+(e.system?':'+e.system:'')+(e.message?':'+e.message:'')).join(', '));
    else notes.push('ExecutionKit v4 Test/Reconcile/Audit/Launch gates: PASS and candidate-bound.');
  }catch(error){errors.push('v4 final release gate validation failed: '+error.message);}
}

if (config?.evidence?.requireTestAdequacy === true) {
  const reportRel = config.evidence.testReportPath;
  if (!reportRel) errors.push('test adequacy is required but evidence.testReportPath is empty');
  else {
    let reportFull = null; try { reportFull = inside(reportRel, 'evidence.testReportPath', { file:true }); } catch (error) { errors.push(error.message); }
    if (reportFull && !fs.existsSync(reportFull)) errors.push(`test adequacy report missing: ${reportRel}`);
    else if (reportFull) {
      const bound = validEvidence.some((report) => report.artifact && path.resolve(projectRoot, report.artifact.path) === reportFull);
      if (!bound) errors.push('test adequacy report is not bound to a valid current-candidate collected artifact; configure an evidence producer with this reportPath and run collect-evidence');
      let validator=null;
      try{
        validator=path.resolve(kitRoot,'bin/validate-test-evidence.mjs');
        const delta=path.relative(kitRoot,validator);
        if(delta.startsWith('..')||path.isAbsolute(delta)||!fs.existsSync(validator)||!fs.statSync(validator).isFile())throw new Error('trusted Kit runtime test adequacy validator is missing');
      }catch(error){errors.push(error.message);}
      if (validator) {
        const cmd = [validator, reportFull]; if (config.evidence.testFormat) cmd.push('--format', config.evidence.testFormat); if (Number(config.evidence.minimumTests ?? 0) > 0) cmd.push('--minimum', String(config.evidence.minimumTests)); if (config.evidence.allowSkipped === true) cmd.push('--allow-skipped'); if (config.evidence.allowFlaky === true) cmd.push('--allow-flaky');
        const result = run(process.execPath, cmd); if (result.status !== 0) errors.push(`test adequacy failed:\n${output(result)}`);
      }
    }
  }
}

if (errors.length) { console.error('Release readiness: FAIL'); for (const error of errors) console.error(`  - ${error}`); for (const note of notes) console.error(`  · ${note}`); process.exit(1); }
console.log('Release readiness: PASS'); for (const note of notes) console.log(`  · ${note}`);
console.log(`Branch ${branch.stdout.trim()} is clean and synchronized with its local upstream reference (remote freshness is not established); Agent/v2.2 policy/Execution/CI/Deep Integration integrity and configured live discovery/integration/SEO/candidate/trusted-evidence gates passed; canonical required work is terminal and phase convergence is proven.`);
