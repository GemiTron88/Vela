import { canonicalState, stateIsTerminal, extractDependencies, extractTags, stateSatisfiesDependency } from './execution-model.mjs';
import { validateNativeOwnerIntegration } from './native-owner-adoption.mjs';

export const DEFAULT_DEEP_INTEGRATION = {
  deepIntegrationRequired: false,
  integrationPhase: 'EK00',
  integrationGateTaskId: 'EK00-AUDIT',
  integrationActivationTaskId: 'EK00-ACTIVATE',
  productExecutionBlockedUntilGateAccepted: true,
};

function configFor(config) {
  return { ...DEFAULT_DEEP_INTEGRATION, ...(config?.adoption ?? {}) };
}

function dependencyClosure(task, byId) {
  const seen = new Set();
  const stack = [...extractDependencies(task)];
  while (stack.length) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const dep = byId.get(id);
    if (dep) stack.push(...extractDependencies(dep));
  }
  return seen;
}

function isSeoIntegrationTask(task, phase) {
  if (!task || String(task.meta?.Phase ?? '').trim() !== phase || String(task.meta?.Action ?? '').toLowerCase() === 'audit') return false;
  if (task.id === 'EK00-005S') return true;
  const tags = extractTags(task).map((tag) => tag.toLowerCase());
  const title = String(task.title ?? '').toLowerCase();
  const contract = String(task.meta?.Contract ?? '').toLowerCase();
  const verification = String(task.meta?.Verification ?? '').toLowerCase();
  return (
    tags.includes('seo-os') ||
    title.includes('seo os') ||
    contract.includes('seo-os')
  );
}

function isPremiumIntegrationTask(task, phase) {
  if (!task || String(task.meta?.Phase ?? '').trim() !== phase || String(task.meta?.Action ?? '').toLowerCase() === 'audit') return false;
  if (task.id === 'EK00-005P') return true;
  const tags = extractTags(task).map((tag) => tag.toLowerCase());
  const title = String(task.title ?? '').toLowerCase();
  const contract = String(task.meta?.Contract ?? '').toLowerCase();
  const verification = String(task.meta?.Verification ?? '').toLowerCase();
  return (
    tags.some((tag) => ['premium', 'premium-experience', 'product-quality', 'design-system', 'component-system', 'ui-architecture'].includes(tag)) ||
    title.includes('premium experience') ||
    title.includes('premium quality') ||
    contract.includes('premium-experience') ||
    verification.includes('configure-quality.mjs') ||
    verification.includes('validate-quality.mjs') ||
    (verification.includes('quality contract') && verification.includes('component'))
  );
}

export function validateDeepIntegration(tasks, config, { requireGateAccepted = false } = {}) {
  const adoption = configFor(config);
  if (!adoption.deepIntegrationRequired) {
    return { required: false, status: 'NOT_REQUIRED', adoption, gate: null, errors: [], warnings: [] };
  }
  if (adoption.integrationStrategy === 'EXISTING_CANONICAL_OWNER') {
    return validateNativeOwnerIntegration(tasks, config, { requireGateAccepted });
  }

  const errors = [];
  const warnings = [];
  const issue = (code, message) => errors.push({ code, message });
  const warn = (code, message) => warnings.push({ code, message });
  const phase = String(adoption.integrationPhase ?? '').trim();
  const gateId = String(adoption.integrationGateTaskId ?? '').trim();

  if (!phase) issue('DEEP_INTEGRATION_PHASE_MISSING', 'adoption.integrationPhase must be a non-empty phase ID when deep integration is required');
  if (!gateId) issue('DEEP_INTEGRATION_GATE_ID_MISSING', 'adoption.integrationGateTaskId must be a non-empty task ID when deep integration is required');
  if (adoption.productExecutionBlockedUntilGateAccepted !== true) issue('DEEP_INTEGRATION_PRODUCT_GUARD_DISABLED', 'deep integration requires productExecutionBlockedUntilGateAccepted=true');

  const active = (tasks ?? []).filter((task) => !task.isArchive);
  const byId = new Map(active.map((task) => [task.id, task]));
  const gate = gateId ? byId.get(gateId) : null;

  if (gateId && !gate) issue('DEEP_INTEGRATION_GATE_MISSING', `Configured integration gate task does not exist in active task authority: ${gateId}`);
  if (gate && String(gate.meta?.Phase ?? '').trim() !== phase) issue('DEEP_INTEGRATION_GATE_PHASE_MISMATCH', `${gateId} must belong to integration phase ${phase}`);
  if (gate && String(gate.meta?.Action ?? '').trim().toLowerCase() !== 'audit') issue('DEEP_INTEGRATION_GATE_NOT_AUDIT', `${gateId} must declare Action: audit`);
  if (gate && String(gate.meta?.['Audit Boundary'] ?? '').trim().toLowerCase() !== 'phase') issue('DEEP_INTEGRATION_GATE_BOUNDARY_INVALID', `${gateId} must declare Audit Boundary: phase`);

  if (/^(?:3|4)\./.test(String(config?.standardVersion ?? ''))) {
    const study = active.find(t => String(t.meta?.Phase ?? '').trim() === phase && extractTags(t).includes('project-study'));
    const tooling = active.find(t => String(t.meta?.Phase ?? '').trim() === phase && extractTags(t).includes('tooling-bootstrap'));
    if (!study || !tooling || !dependencyClosure(study,byId).has(tooling.id) || (gate && !dependencyClosure(gate,byId).has(study.id))) issue('DEEP_INTEGRATION_STUDY_CHAIN_MISSING', 'Project study must follow tooling bootstrap and gate the independent integration audit');
    const seoLevel = config?.capabilities?.seo;
    if (!['NONE','LITE','STANDARD','FULL'].includes(seoLevel)) {
      issue('DEEP_INTEGRATION_SEO_CAPABILITY_MISSING', 'Current 3.x deep integration requires an explicit SEO capability level');
    }
    if (seoLevel && seoLevel !== 'NONE' && config?.seo?.requiredForRelease !== true) {
      issue('DEEP_INTEGRATION_SEO_RELEASE_BYPASS', 'Enabled SEO capability requires seo.requiredForRelease=true so Launch OS cannot bypass S3');
    }
    const seoTask = active.find(task => task.id === `${phase}-005S` && String(task.meta?.Phase ?? '').trim() === phase) ?? active.find((task) => isSeoIntegrationTask(task, phase));
    if (!seoTask) {
      issue('DEEP_INTEGRATION_SEO_TASK_MISSING', `Current 3.x integration phase ${phase} must contain EK00-005S or a semantically equivalent SEO OS applicability/reconciliation task`);
    } else if (gate) {
      const gateAncestry = dependencyClosure(gate, byId);
      if (!gateAncestry.has(seoTask.id)) issue('DEEP_INTEGRATION_SEO_TASK_BYPASSED', `${gateId} must transitively depend on SEO integration task ${seoTask.id}`);
    }

    const premiumTask = active.find(task => task.id === `${phase}-005P` && String(task.meta?.Phase ?? '').trim() === phase) ?? active.find((task) => isPremiumIntegrationTask(task, phase));
    if (!premiumTask) {
      issue('DEEP_INTEGRATION_PREMIUM_TASK_MISSING', `Current 3.x integration phase ${phase} must contain EK00-005P or a semantically equivalent Premium Experience applicability/design-component reconciliation task`);
    } else if (gate) {
      const gateAncestry = dependencyClosure(gate, byId);
      if (!gateAncestry.has(premiumTask.id)) issue('DEEP_INTEGRATION_PREMIUM_TASK_BYPASSED', `${gateId} must transitively depend on Premium Experience integration task ${premiumTask.id}`);
    }

    const qualityConfigured = Boolean(config?.quality?.contractPath && String(config.quality.contractPath).trim());
    const gateAcceptedForQuality = Boolean(gate && stateSatisfiesDependency(gate, config));
    const qualityMustBeResolved = requireGateAccepted || config?.projectState === 'ACTIVE' || gateAcceptedForQuality;
    const premium = config?.premiumExperience;
    const applicability = String(premium?.applicability ?? 'UNRESOLVED');
    const qualityProfile = String(premium?.qualityProfile ?? 'UNRESOLVED');
    const notApplicableReason = String(premium?.notApplicableReason ?? '').trim();

    if (!qualityMustBeResolved) {
      if (!premium || applicability === 'UNRESOLVED' || qualityProfile === 'UNRESOLVED' || !qualityConfigured) {
        warn('DEEP_INTEGRATION_QUALITY_UNRESOLVED', 'Product-quality applicability is not reconciled yet. Before EK00 acceptance, configure an explicit quality contract. UI-bearing projects require Premium Experience 1.1; only evidence-backed non-UI projects may resolve NOT_APPLICABLE with standard quality.');
      }
    } else {
      if (!premium || applicability === 'UNRESOLVED' || qualityProfile === 'UNRESOLVED') {
        issue('DEEP_INTEGRATION_PREMIUM_APPLICABILITY_UNRESOLVED', 'Accepted/activated current 3.x deep integration requires premiumExperience applicability to be resolved explicitly.');
      }
      if (!qualityConfigured) {
        issue('DEEP_INTEGRATION_QUALITY_CONTRACT_MISSING', 'Accepted/activated current 3.x deep integration requires an explicit quality.contractPath; NOT_CONFIGURED cannot satisfy the Premium Experience boundary.');
      }
      if (applicability === 'REQUIRED' && qualityProfile !== 'premium') {
        issue('DEEP_INTEGRATION_PREMIUM_PROFILE_BYPASS', 'premiumExperience.applicability=REQUIRED requires qualityProfile=premium; UI-bearing work cannot downgrade to standard quality.');
      }
      if (applicability === 'NOT_APPLICABLE' && (qualityProfile !== 'standard' || notApplicableReason.length < 8)) {
        issue('DEEP_INTEGRATION_PREMIUM_NA_INVALID', 'NOT_APPLICABLE is reserved for evidence-backed non-UI products and requires qualityProfile=standard plus a meaningful notApplicableReason.');
      }
      if (!['REQUIRED','NOT_APPLICABLE'].includes(applicability)) {
        issue('DEEP_INTEGRATION_PREMIUM_APPLICABILITY_INVALID', `Resolved Premium Experience applicability must be REQUIRED or NOT_APPLICABLE, got ${applicability || 'MISSING'}.`);
      }
    }
  }

  if (gate && adoption.productExecutionBlockedUntilGateAccepted === true) {
    for (const task of active) {
      if (String(task.meta?.Phase ?? '').trim() === phase) continue;
      const semantic = canonicalState(task, config);
      if (stateIsTerminal(task, config)) continue;
      const ancestry = dependencyClosure(task, byId);
      const activationId = adoption.integrationActivationTaskId;
      if (!ancestry.has(gateId) || !ancestry.has(activationId)) {
        issue('PRODUCT_FRONTIER_BYPASSES_DEEP_INTEGRATION', `${task.id} is ${semantic} outside ${phase} but does not transitively depend on ${gateId} through ${activationId}`);
      }
    }
  }

  const activationId = adoption.integrationActivationTaskId;
  const activation = byId.get(activationId);
  if (!activation || String(activation.meta?.Phase ?? '').trim() !== phase || !dependencyClosure(activation, byId).has(gateId)) issue('DEEP_INTEGRATION_ACTIVATION_INVALID', `Integration activation ${activationId} must exist in ${phase} and depend on ${gateId}`);

  const gateAccepted = Boolean(gate && stateSatisfiesDependency(gate, config));
  if (config?.projectState === 'ACTIVE' && !gateAccepted) issue('ACTIVE_BEFORE_DEEP_INTEGRATION_ACCEPTED', `projectState=ACTIVE requires accepted integration gate ${gateId}`);
  if (requireGateAccepted && !gateAccepted) issue('DEEP_INTEGRATION_GATE_NOT_ACCEPTED', `Activation requires accepted integration gate ${gateId}`);

  return {
    required: true,
    status: errors.length ? 'FAIL' : gateAccepted ? 'PASS' : 'PENDING',
    adoption,
    gate: gate ? { id: gate.id, state: gate.meta?.Status ?? null, semanticState: canonicalState(gate, config), accepted: gateAccepted } : null,
    errors,
    warnings,
  };
}
