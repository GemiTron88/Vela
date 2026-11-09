import fs from 'node:fs';
import path from 'node:path';
import {
  canonicalState,
  declaredAuditBoundary,
  declaredExecutionAction,
  stateSatisfiesDependency,
  transitiveDependencyIds,
} from './execution-model.mjs';
import { resolveProjectPathSafe } from './derived-state.mjs';
import { loadAdapterConfig } from './adapter-registry.mjs';
import { loadDeclaredScope } from './discovery-model.mjs';

export function integrationContractPath(root, config, { mustExist = false } = {}) {
  const rel = config.integration?.journeyContractPath ?? 'executionkit.integration.json';
  return {
    rel,
    full: resolveProjectPathSafe(root, rel, 'integration journey contract', { mustExist, file: true }),
  };
}

export function loadIntegrationContract(root, config, { required = false } = {}) {
  const { rel, full } = integrationContractPath(root, config);
  if (!fs.existsSync(full)) {
    if (required) throw new Error(`Required integration journey contract is missing: ${rel}`);
    return { status: 'MISSING', rel, contract: null };
  }
  const contract = JSON.parse(fs.readFileSync(full, 'utf8'));
  return { status: 'LOADED', rel, contract };
}

export function validateIntegrationContract(root, config, tasks, { release = false } = {}) {
  const errors = [], notes = [];
  const requiredForRelease = config.integration?.requireCriticalJourneysForRelease === true;
  let loaded;
  try {
    loaded = loadIntegrationContract(root, config, { required: release && requiredForRelease });
  } catch (error) {
    return { errors: [{ code: 'INTEGRATION_CONTRACT_MISSING', message: error.message }], notes, contract: null };
  }
  if (loaded.status === 'MISSING') {
    notes.push('Integration journey contract: NOT_CONFIGURED');
    return { errors, notes, contract: null };
  }
  const contract = loaded.contract;
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    return { errors: [{ code: 'INTEGRATION_CONTRACT_INVALID', message: `${loaded.rel} must contain a JSON object` }], notes, contract };
  }
  if (contract.schemaVersion !== '1.0.0') errors.push({ code: 'INTEGRATION_SCHEMA_VERSION', message: `${loaded.rel} schemaVersion must be 1.0.0` });
  if (!['UNRESOLVED','REQUIRED','NOT_APPLICABLE'].includes(contract.applicability)) errors.push({ code: 'INTEGRATION_APPLICABILITY_INVALID', message: `${loaded.rel} applicability is invalid` });
  if (release && requiredForRelease && contract.applicability === 'UNRESOLVED') errors.push({ code: 'INTEGRATION_APPLICABILITY_UNRESOLVED', message: 'Critical-journey applicability must be resolved before release' });
  if (contract.applicability === 'NOT_APPLICABLE') {
    if (String(contract.notApplicableReason ?? '').trim().length < 8) errors.push({ code: 'INTEGRATION_NA_REASON_MISSING', message: 'NOT_APPLICABLE requires a concrete rationale' });
    if ((contract.journeys ?? []).length) errors.push({ code: 'INTEGRATION_NA_HAS_JOURNEYS', message: 'NOT_APPLICABLE cannot declare critical journeys' });
    if (release && requiredForRelease && config.integration?.allowNotApplicableForRelease !== true) {
      errors.push({ code: 'INTEGRATION_NA_RELEASE_FORBIDDEN', message: 'Release-critical journey proof is required for this project; NOT_APPLICABLE is forbidden unless integration.allowNotApplicableForRelease=true is explicitly authorized.' });
    }
    return { errors, notes, contract };
  }
  if (contract.applicability === 'REQUIRED' && (!Array.isArray(contract.journeys) || contract.journeys.length === 0)) {
    errors.push({ code: 'CRITICAL_JOURNEYS_MISSING', message: 'REQUIRED integration contract must declare at least one critical journey' });
    return { errors, notes, contract };
  }
  if (contract.applicability === 'REQUIRED' && config.integration?.requireJourneyDenominator === true) {
    try {
      const scope = loadDeclaredScope(root, config.discovery?.scopePath ?? 'executionkit.scope.json');
      const requiredJourneys = (scope.required ?? []).filter((item) => item?.kind === 'journey');
      const excludedJourneys = new Set((scope.excluded ?? []).filter((item) => item?.kind === 'journey').map((item) => String(item.id ?? '').trim()).filter(Boolean));
      if (!requiredJourneys.length) errors.push({ code:'JOURNEY_DENOMINATOR_MISSING', message:'Product scope must declare at least one required kind=journey denominator when critical journeys are REQUIRED' });
      const declared = new Set((contract.journeys ?? []).map((journey) => String(journey?.id ?? '').trim()).filter(Boolean));
      const missing = requiredJourneys.map((item) => String(item.id ?? '').trim()).filter(Boolean).filter((id) => !declared.has(id));
      if (missing.length) errors.push({ code:'JOURNEY_DENOMINATOR_UNMAPPED', message:`Required scope journey(s) are missing from the integration contract: ${missing.join(', ')}` });
      const unnamed = requiredJourneys.filter((item) => !String(item.id ?? '').trim());
      if (unnamed.length) errors.push({ code:'JOURNEY_DENOMINATOR_ID_MISSING', message:'Every required kind=journey scope entry must declare a stable id' });
      const undeclared = [...declared].filter((id) => !requiredJourneys.some((item) => String(item.id ?? '').trim() === id));
      if (undeclared.length) errors.push({ code:'JOURNEY_CONTRACT_OUTSIDE_DENOMINATOR', message:`Integration journey(s) are not declared in the product scope denominator: ${undeclared.join(', ')}` });
      const excludedActive = [...declared].filter((id) => excludedJourneys.has(id));
      if (excludedActive.length) errors.push({ code:'JOURNEY_DENOMINATOR_EXCLUDED_ACTIVE', message:`Journey(s) cannot be both excluded and active integration contracts: ${excludedActive.join(', ')}` });
    } catch (error) { errors.push({ code:'JOURNEY_DENOMINATOR_INVALID', message:error.message }); }
  }
  if (!Array.isArray(contract.journeys)) {
    errors.push({ code: 'CRITICAL_JOURNEYS_INVALID', message: 'journeys must be an array' });
    return { errors, notes, contract };
  }

  let adapterConfig = { adapters:{} };
  try { adapterConfig = loadAdapterConfig(root, config.evidence?.adapterConfigPath ?? 'executionkit.adapters.json'); }
  catch (error) { errors.push({ code:'INTEGRATION_ADAPTER_CONFIG_INVALID', message:error.message }); }

  const byId = new Map(tasks.map((task) => [task.id, task]));
  if (contract.applicability === 'REQUIRED' && config.integration?.requireSystemReleaseGate === true) {
    const releaseGateId = String(contract.releaseGateTask ?? '').trim();
    const configuredGateId = String(config.integration?.systemReleaseGateTaskId ?? '').trim();
    if (!configuredGateId) errors.push({ code:'SYSTEM_RELEASE_GATE_ID_MISSING', message:'integration.systemReleaseGateTaskId is required when requireSystemReleaseGate=true' });
    else if (releaseGateId !== configuredGateId) errors.push({ code:'SYSTEM_RELEASE_GATE_ID_DRIFT', message:`Integration contract releaseGateTask ${releaseGateId || 'MISSING'} does not match execution config ${configuredGateId}` });
    const releaseGate = byId.get(releaseGateId);
    if (!releaseGate) {
      errors.push({ code:'SYSTEM_RELEASE_GATE_UNKNOWN', message:`Configured system release gate does not exist: ${releaseGateId || 'MISSING'}` });
    } else {
      if (declaredExecutionAction(releaseGate) !== 'audit' || declaredAuditBoundary(releaseGate) !== 'release') {
        errors.push({ code:'SYSTEM_RELEASE_GATE_NOT_AUDIT', message:`System release gate ${releaseGate.id} must be Action:audit with Audit Boundary:release` });
      }
      if (release) {
        if (!stateSatisfiesDependency(releaseGate, config)) errors.push({ code:'SYSTEM_RELEASE_GATE_NOT_ACCEPTED', message:`System release gate ${releaseGate.id} is not ACCEPTED/RELEASED` });
        const deps = transitiveDependencyIds(releaseGate, tasks);
        const denominator = tasks.filter((task) => !task.isArchive && task.id !== releaseGate.id && canonicalState(task, config) !== 'CANCELLED');
        const missing = denominator.filter((task) => !deps.has(task.id)).map((task) => task.id);
        if (missing.length) errors.push({ code:'SYSTEM_RELEASE_GATE_INCOMPLETE_CONVERGENCE', message:`System release gate ${releaseGate.id} does not transitively converge the complete active denominator; missing: ${missing.join(', ')}` });
      }
    }
  }
  const seen = new Set();
  const requiredProducers = new Set(config.evidence?.requiredProducers ?? []);
  for (const journey of contract.journeys) {
    const id = String(journey?.id ?? '').trim();
    if (!id || !/^[A-Za-z][A-Za-z0-9._-]*$/.test(id)) { errors.push({ code: 'JOURNEY_ID_INVALID', message: `Invalid journey id: ${id || 'MISSING'}` }); continue; }
    if (seen.has(id)) { errors.push({ code: 'JOURNEY_ID_DUPLICATE', message: `Duplicate journey id: ${id}` }); continue; }
    seen.add(id);
    const members = Array.isArray(journey.tasks) ? [...new Set(journey.tasks.map((value) => String(value).trim()).filter(Boolean))] : [];
    if (!members.length) errors.push({ code: 'JOURNEY_TASKS_MISSING', message: `${id} has no member tasks` });
    const unknown = members.filter((taskId) => !byId.has(taskId));
    if (unknown.length) errors.push({ code: 'JOURNEY_UNKNOWN_TASK', message: `${id} references unknown task(s): ${unknown.join(', ')}` });
    if (release && journey.requiredForRelease === true) {
      const cancelled = members.filter((taskId) => {
        const member = byId.get(taskId);
        return member && canonicalState(member, config) === 'CANCELLED';
      });
      if (cancelled.length) errors.push({ code:'JOURNEY_MEMBER_CANCELLED', message:`${id} still includes cancelled release-critical task(s): ${cancelled.join(', ')}; reconcile the journey denominator and contract instead of inheriting stale scope` });
    }
    const gate = byId.get(journey.gateTask);
    if (!gate) { errors.push({ code: 'JOURNEY_GATE_UNKNOWN', message: `${id} gate task does not exist: ${journey.gateTask ?? 'MISSING'}` }); continue; }
    if (declaredExecutionAction(gate) !== 'audit' || !['phase','release'].includes(declaredAuditBoundary(gate))) {
      errors.push({ code: 'JOURNEY_GATE_NOT_AUDIT', message: `${id} gate ${gate.id} must be Action:audit with phase or release boundary` });
    }
    const deps = transitiveDependencyIds(gate, tasks);
    const missing = members.filter((taskId) => taskId !== gate.id && !deps.has(taskId));
    if (missing.length) errors.push({ code: 'JOURNEY_GATE_INCOMPLETE_CONVERGENCE', message: `${id} gate ${gate.id} does not transitively depend on: ${missing.join(', ')}` });

    const verification = journey.verification ?? {};
    const modes = Array.isArray(verification.modes) ? verification.modes : [];
    const producers = Array.isArray(verification.producers) ? verification.producers : [];
    const requiredScenarios = Array.isArray(verification.requiredScenarios) ? [...new Set(verification.requiredScenarios.map((value) => String(value).trim()).filter(Boolean))] : [];
    if (!modes.length) errors.push({ code: 'JOURNEY_VERIFICATION_MODE_MISSING', message: `${id} must declare verification modes` });
    if (journey.requiredForRelease === true && !requiredScenarios.length) errors.push({ code:'JOURNEY_SCENARIOS_MISSING', message:`${id} release journey must declare concrete requiredScenarios` });
    if (release && journey.requiredForRelease === true) {
      const isReleaseGate = declaredExecutionAction(gate) === 'audit' && declaredAuditBoundary(gate) === 'release';
      const gateReadyForRelease = isReleaseGate ? ['READY', 'IN_PROGRESS', 'IMPLEMENTED', 'ACCEPTED', 'RELEASED'].includes(canonicalState(gate, config)) : stateSatisfiesDependency(gate, config);
      if (!gateReadyForRelease) errors.push({ code: 'JOURNEY_GATE_NOT_ACCEPTED', message: `${id} release gate ${gate.id} is not ACCEPTED/RELEASED` });
      if (!modes.some((mode) => ['black-box','runtime','browser','device'].includes(mode))) errors.push({ code: 'JOURNEY_BLACK_BOX_MISSING', message: `${id} release journey requires black-box/runtime/browser/device verification` });
      if (!producers.length) errors.push({ code: 'JOURNEY_PRODUCER_MISSING', message: `${id} release journey must bind to at least one trusted evidence producer` });
      const unrequired = producers.filter((producer) => !requiredProducers.has(producer));
      if (unrequired.length) errors.push({ code: 'JOURNEY_PRODUCER_NOT_REQUIRED', message: `${id} producer(s) are not configured as release-required evidence: ${unrequired.join(', ')}` });
      let blackBoxProducer = false;
      for (const producer of producers) {
        const cfg = adapterConfig.adapters?.[producer];
        if (!cfg || cfg.kind !== 'evidence') {
          errors.push({ code:'JOURNEY_PRODUCER_NOT_CONFIGURED', message:`${id} producer ${producer} is not a configured evidence adapter` });
          continue;
        }
        if (!cfg.command || !cfg.reportPath) errors.push({ code:'JOURNEY_PRODUCER_NOT_EXECUTABLE', message:`${id} producer ${producer} requires command and reportPath` });
        if (!cfg.scenarioReportPath) errors.push({ code:'JOURNEY_SCENARIO_REPORT_MISSING', message:`${id} producer ${producer} requires scenarioReportPath so declared scenario coverage is proven by the current collector run` });
        const boundary = String(cfg.observationBoundary ?? '');
        if (['external-black-box','browser-black-box','runtime-black-box','device-black-box','integration-fixture'].includes(boundary)) blackBoxProducer = true;
        const allowedTypes = new Set(['journey','integration','browser','runtime','device','e2e']);
        if (!allowedTypes.has(String(cfg.evidenceType ?? '').toLowerCase())) {
          errors.push({ code:'JOURNEY_PRODUCER_TYPE_INVALID', message:`${id} producer ${producer} must use journey/integration/browser/runtime/device/e2e evidenceType, not ${cfg.evidenceType ?? 'MISSING'}` });
        }
        const covered = new Set(Array.isArray(cfg.journeyCoverage?.[id]) ? cfg.journeyCoverage[id] : []);
        const missingScenarios = requiredScenarios.filter((scenario) => !covered.has(scenario));
        if (missingScenarios.length) errors.push({ code:'JOURNEY_SCENARIO_COVERAGE_INCOMPLETE', message:`${id} producer ${producer} does not declare coverage for scenario(s): ${missingScenarios.join(', ')}` });
      }
      if (!blackBoxProducer) errors.push({ code:'JOURNEY_BLACK_BOX_PRODUCER_MISSING', message:`${id} has no producer with an explicit black-box/runtime/device/integration observation boundary` });
    }
  }
  return { errors, notes, contract };
}
