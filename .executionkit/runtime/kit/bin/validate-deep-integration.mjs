#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, loadTasks } from '../lib/execution-model.mjs';
import { validateDeepIntegration } from '../lib/adoption-model.mjs';
import { validateNativeOwnerIntegration } from '../lib/native-owner-adoption.mjs';
import { validateIntegrationContract } from '../lib/integration-model.mjs';
import { projectFile, validateQuality } from '../lib/quality-model.mjs';
import { hostRuntimeStatus } from '../lib/host-bootstrap.mjs';

const args = process.argv.slice(2);
const root = path.resolve(args.find((arg) => !arg.startsWith('--')) ?? '.');
const asJson = args.includes('--json');
const requireGateAccepted = args.includes('--require-gate-accepted');

function meaningful(value) {
  return typeof value === 'string' && value.trim().length >= 8 && !/^(none|n\/a|not applicable|todo|tbd|pending)$/i.test(value.trim());
}

function reconcilePremiumApplicability(root, config, result) {
  if (!result.required || (!/^(?:3|4)\./.test(String(config?.standardVersion ?? '')) && config?.adoption?.integrationPhase !== 'EK00')) return;
  const mustResolve = requireGateAccepted || config?.projectState === 'ACTIVE' || result.gate?.accepted === true;
  const premium = config?.premiumExperience;
  const fail = (code, message) => result.errors.push({ code, message });
  const warn = (code, message) => result.warnings.push({ code, message });

  if (!premium || !['REQUIRED', 'NOT_APPLICABLE'].includes(premium.applicability)) {
    const message = 'Premium Experience applicability is unresolved. UI-bearing projects require Premium quality schema 1.1.0; only genuinely non-UI products may record NOT_APPLICABLE with an evidence-backed reason.';
    if (mustResolve) fail('DEEP_INTEGRATION_PREMIUM_APPLICABILITY_UNRESOLVED', message);
    else warn('DEEP_INTEGRATION_PREMIUM_APPLICABILITY_UNRESOLVED', message);
    return;
  }

  if (!config?.quality?.contractPath) {
    if (mustResolve) fail('DEEP_INTEGRATION_QUALITY_CONTRACT_MISSING', 'Resolved Premium Experience applicability requires an explicit quality.contractPath before integration acceptance/activation.');
    return;
  }

  let contract;
  try {
    contract = JSON.parse(fs.readFileSync(projectFile(root, config.quality.contractPath), 'utf8'));
  } catch (error) {
    const message = `Configured quality contract cannot be read: ${error.message}`;
    if (mustResolve) fail('DEEP_INTEGRATION_QUALITY_CONTRACT_INVALID', message);
    else warn('DEEP_INTEGRATION_QUALITY_CONTRACT_INVALID', message);
    return;
  }

  if (premium.applicability === 'REQUIRED') {
    if (contract.schemaVersion !== '1.1.0' || contract.profile !== 'premium') {
      fail('DEEP_INTEGRATION_PREMIUM_PROFILE_BYPASS', 'UI-bearing projects must use quality schemaVersion 1.1.0 with profile=premium; Standard quality cannot satisfy Premium Experience applicability.');
    }
    if (premium.qualityProfile && premium.qualityProfile !== 'premium') fail('DEEP_INTEGRATION_PREMIUM_CONFIG_DRIFT', 'premiumExperience.qualityProfile must be premium when applicability=REQUIRED.');
  } else {
    if (!meaningful(premium.notApplicableReason)) fail('DEEP_INTEGRATION_PREMIUM_NA_REASON_MISSING', 'Premium Experience NOT_APPLICABLE requires a concrete evidence-backed non-UI reason.');
    if (contract.profile !== 'standard') fail('DEEP_INTEGRATION_PREMIUM_NA_PROFILE_INVALID', 'Premium Experience NOT_APPLICABLE must use the standard quality profile rather than contradictory premium UI scope.');
    if (premium.qualityProfile && premium.qualityProfile !== 'standard') fail('DEEP_INTEGRATION_PREMIUM_CONFIG_DRIFT', 'premiumExperience.qualityProfile must be standard when applicability=NOT_APPLICABLE.');
  }

  if (mustResolve) {
    const quality = validateQuality(root, { ...config, quality: { contractPath: config.quality.contractPath } });
    for (const error of quality.errors) fail(`DEEP_INTEGRATION_${error.code}`, error.message);
  }
}

function reconcileHostAcceptance(root, config, result) {
  if (!config?.editors?.antigravity) return;
  const mustResolve = requireGateAccepted || config?.projectState === 'ACTIVE' || result.gate?.accepted === true;
  let host;
  try { host = hostRuntimeStatus(root); }
  catch (error) { host = { status:'INVALID', runtimeVerified:false, reason:error.message }; }
  result.host = host;
  if (host.runtimeVerified === true) return;
  const message = `Antigravity host is ${host.status}. Structural installation is not activation evidence; verify fresh ExecutionKit hook observation and live CLI verification before integration acceptance.`;
  const item = { code:'DEEP_INTEGRATION_ANTIGRAVITY_HOST_UNVERIFIED', message };
  if (mustResolve) result.errors.push(item);
  else result.warnings.push(item);
}

try {
  const { config } = loadConfig(root);
  const isV4 = /^[45]\./.test(String(config?.standardVersion ?? '')) && (config?.adoption?.integrationGateTaskId?.includes('EK4') || config?.adoption?.integrationPhase === 'EK4');
  if (isV4) {
    const { inspectV4Activation } = await import('../lib/v4-activation.mjs');
    const activation = inspectV4Activation(root);
    const isBootstrap = (config.projectState ?? 'BOOTSTRAP') === 'BOOTSTRAP';
    const pass = activation.status === 'ACTIVE' || (activation.ready && activation.gateState === 'ACCEPTED') || (isBootstrap && !requireGateAccepted && activation.gateState != null);
    if (asJson) {
      console.log(JSON.stringify({
        status: pass ? 'PASS' : 'FAIL',
        required: true,
        strategy: 'V4_GITHUB_NATIVE_ACTIVATION',
        gate: { id: activation.gateId, state: activation.gateState, accepted: activation.gateState === 'ACCEPTED' },
        activation: { id: activation.activationId, state: activation.activationState, accepted: activation.activationState === 'ACCEPTED' },
        errors: activation.reasons,
        warnings: [],
      }, null, 2));
    } else {
      console.log(`Deep integration: ${pass ? 'PASS' : 'FAIL'}`);
      console.log(`Gate ${activation.gateId}: ${activation.gateState} (${activation.gateState === 'ACCEPTED' ? 'accepted' : 'not accepted'})`);
      console.log(`Activation ${activation.activationId}: ${activation.activationState} (${activation.activationState === 'ACCEPTED' ? 'accepted' : 'not accepted'})`);
      for (const r of activation.reasons) console.error(`[${r.code}] ${r.message}`);
    }
    process.exit(pass ? 0 : 1);
  }
  const loaded = loadTasks(root, config);
  if (loaded.errors.length) {
    const result = { status: 'FAIL', required: Boolean(config?.adoption?.deepIntegrationRequired), errors: loaded.errors, warnings: [] };
    if (asJson) console.log(JSON.stringify(result, null, 2));
    else {
      console.error('Deep integration: FAIL');
      for (const error of result.errors) console.error(`[${error.code}] ${error.message}`);
    }
    process.exit(1);
  }

  const nativeOwner = config?.adoption?.integrationStrategy === 'EXISTING_CANONICAL_OWNER';
  const result = nativeOwner
    ? validateNativeOwnerIntegration(loaded.tasks, config, { requireGateAccepted })
    : validateDeepIntegration(loaded.tasks, config, { requireGateAccepted });
  reconcilePremiumApplicability(root, config, result);
  const integration = validateIntegrationContract(root, config, loaded.tasks, { release: false });
  result.integration = { contract: config?.integration?.journeyContractPath ?? 'executionkit.integration.json', errorCount: integration.errors.length };
  const mustResolveIntegration = requireGateAccepted || config?.projectState === 'ACTIVE' || result.gate?.accepted === true;
  for (const item of integration.errors) {
    const mapped = { code: `DEEP_INTEGRATION_${item.code}`, message: item.message };
    if (mustResolveIntegration) result.errors.push(mapped);
    else result.warnings.push(mapped);
  }
  if (mustResolveIntegration && integration.contract?.applicability === 'UNRESOLVED') {
    result.errors.push({ code:'DEEP_INTEGRATION_CRITICAL_JOURNEY_UNRESOLVED', message:'Critical-journey/integration applicability must be resolved before deep-integration acceptance or project activation.' });
  }
  reconcileHostAcceptance(root, config, result);
  if (result.errors.length) result.status = 'FAIL';
  else if (result.gate?.accepted) result.status = 'PASS';
  else if (result.required) result.status = 'PENDING';

  if (asJson) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Deep integration: ${result.status}`);
    if (result.strategy) console.log(`Strategy: ${result.strategy}`);
    if (result.gate) console.log(`Gate ${result.gate.id}: ${result.gate.state} (${result.gate.accepted ? 'accepted' : 'not accepted'})`);
    if (result.host) console.log(`Antigravity host: ${result.host.status} (${result.host.runtimeVerified ? 'verified' : 'not verified'})`);
    for (const warning of result.warnings) console.warn(`[${warning.code}] ${warning.message}`);
    for (const error of result.errors) console.error(`[${error.code}] ${error.message}`);
  }
  process.exit(result.errors.length ? 1 : 0);
} catch (error) {
  console.error(`Deep integration validation failed: ${error.message}`);
  process.exit(1);
}
