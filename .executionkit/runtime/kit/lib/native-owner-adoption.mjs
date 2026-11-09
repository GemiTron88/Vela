import { canonicalState, extractDependencies, stateIsTerminal, stateSatisfiesDependency } from './execution-model.mjs';

function dependencyClosure(task, byId) {
  const seen = new Set();
  const stack = [...extractDependencies(task)];
  while (stack.length) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const dependency = byId.get(id);
    if (dependency) stack.push(...extractDependencies(dependency));
  }
  return seen;
}

export function validateNativeOwnerIntegration(tasks, config, { requireGateAccepted = false } = {}) {
  const adoption = config?.adoption ?? {};
  const errors = [];
  const warnings = [];
  const issue = (code, message) => errors.push({ code, message });
  const active = (tasks ?? []).filter(task => !task.isArchive);
  const byId = new Map(active.map(task => [task.id, task]));
  const phase = String(adoption.integrationPhase ?? '').trim();
  const gateId = String(adoption.integrationGateTaskId ?? '').trim();
  const activationId = String(adoption.integrationActivationTaskId ?? gateId).trim() || gateId;

  if (adoption.deepIntegrationRequired !== true) issue('NATIVE_OWNER_DEEP_INTEGRATION_DISABLED', 'EXISTING_CANONICAL_OWNER requires adoption.deepIntegrationRequired=true');
  if (adoption.integrationStrategy !== 'EXISTING_CANONICAL_OWNER') issue('NATIVE_OWNER_STRATEGY_INVALID', 'Native-owner validator requires adoption.integrationStrategy=EXISTING_CANONICAL_OWNER');
  if (adoption.productExecutionBlockedUntilGateAccepted !== true) issue('NATIVE_OWNER_PRODUCT_GUARD_DISABLED', 'Native-owner integration requires productExecutionBlockedUntilGateAccepted=true');
  if (!phase) issue('NATIVE_OWNER_PHASE_MISSING', 'adoption.integrationPhase must name the existing project phase that owns the integration gate');
  if (!gateId) issue('NATIVE_OWNER_GATE_MISSING', 'adoption.integrationGateTaskId must name an existing canonical project task');

  const gate = gateId ? byId.get(gateId) : null;
  if (gateId && !gate) issue('NATIVE_OWNER_GATE_NOT_FOUND', `Existing canonical integration gate is absent from active task authority: ${gateId}`);
  if (gate && String(gate.meta?.Phase ?? '').trim() !== phase) issue('NATIVE_OWNER_GATE_PHASE_MISMATCH', `${gateId} must belong to integration phase ${phase}`);
  if (gate && String(gate.meta?.Action ?? '').trim().toLowerCase() !== 'audit') issue('NATIVE_OWNER_GATE_NOT_AUDIT', `${gateId} must project Action: audit`);
  if (gate && String(gate.meta?.['Audit Boundary'] ?? '').trim().toLowerCase() !== 'phase') issue('NATIVE_OWNER_GATE_BOUNDARY_INVALID', `${gateId} must project Audit Boundary: phase`);

  const activation = activationId ? byId.get(activationId) : null;
  if (activationId && activationId !== gateId) {
    if (!activation) issue('NATIVE_OWNER_ACTIVATION_NOT_FOUND', `Configured activation task is absent: ${activationId}`);
    else if (!dependencyClosure(activation, byId).has(gateId)) issue('NATIVE_OWNER_ACTIVATION_BYPASSES_GATE', `${activationId} must depend transitively on ${gateId}`);
  }

  if (!['NONE','LITE','STANDARD','FULL'].includes(config?.capabilities?.seo)) issue('NATIVE_OWNER_SEO_APPLICABILITY_MISSING', 'Current v3 integration requires an explicit SEO capability level');
  for (const capability of ['execution','agent','content','audit','test','launch']) {
    if (!['NONE','LITE','STANDARD','FULL'].includes(config?.capabilities?.[capability])) issue('NATIVE_OWNER_CAPABILITY_MISSING', `Capability ${capability} must be explicit`);
  }

  if (gate && adoption.productExecutionBlockedUntilGateAccepted === true) {
    for (const task of active) {
      if (task.id === gateId || task.id === activationId || String(task.meta?.Phase ?? '').trim() === phase || stateIsTerminal(task, config)) continue;
      const ancestry = dependencyClosure(task, byId);
      if (!ancestry.has(gateId)) issue('PRODUCT_FRONTIER_BYPASSES_NATIVE_INTEGRATION', `${task.id} is ${canonicalState(task, config)} outside ${phase} but does not transitively depend on native integration gate ${gateId}`);
    }
  }

  const gateAccepted = Boolean(gate && stateSatisfiesDependency(gate, config));
  if (config?.projectState === 'ACTIVE' && !gateAccepted) issue('ACTIVE_BEFORE_NATIVE_INTEGRATION_ACCEPTED', `projectState=ACTIVE requires accepted native integration gate ${gateId}`);
  if (requireGateAccepted && !gateAccepted) issue('NATIVE_OWNER_GATE_NOT_ACCEPTED', `Activation requires accepted native integration gate ${gateId}`);

  return {
    required: true,
    strategy: 'EXISTING_CANONICAL_OWNER',
    status: errors.length ? 'FAIL' : gateAccepted ? 'PASS' : 'PENDING',
    adoption,
    gate: gate ? { id: gate.id, state: gate.meta?.Status ?? null, semanticState: canonicalState(gate, config), accepted: gateAccepted } : null,
    activation: activation ? { id: activation.id, sameAsGate: activationId === gateId } : null,
    errors,
    warnings,
  };
}
