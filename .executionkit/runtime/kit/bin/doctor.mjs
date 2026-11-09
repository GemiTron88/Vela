#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig, loadTasks, resolveNextExecution, closureSummary } from '../lib/execution-model.mjs';
import { validateAgentLayer } from '../lib/agent-model.mjs';
import { validateQuality } from '../lib/quality-model.mjs';
import { validateAntigravity } from '../lib/antigravity.mjs';
import { commandExists, loadAdapterConfig } from '../lib/adapter-registry.mjs';
import { detectStacks, discoverProduct } from '../lib/discovery-model.mjs';
import { readCheckpoint, recoverRuntime } from '../lib/runtime-orchestrator.mjs';
import { candidateFile, validateCandidate } from '../lib/evidence-model.mjs';
import { localBin, composerHas, runCommand } from '../lib/external-adapters.mjs';
import { toolingStatus, resolveToolingModule } from '../lib/tooling-loader.mjs';
import { inspectAgentLocalState } from '../lib/agent-inspection.mjs';
import { validateIntegrationContract } from '../lib/integration-model.mjs';
import { analyzeRevalidation } from '../lib/revalidation-model.mjs';

const root = path.resolve(process.argv[2] ?? '.');
const git = (args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 5000, windowsHide:true }); return r.status === 0 ? r.stdout.trim() : null; };
const tool = (name, applicable = true) => !applicable ? { status: 'NOT_APPLICABLE' } : commandExists(name, { cwd: root }) ? { status: 'READY' } : { status: 'NOT_AVAILABLE' };
const configured = (adapters, id) => Boolean(adapters.adapters?.[id]);

try {
  const { config, source } = loadConfig(root), loaded = loadTasks(root, config);
  const agent = validateAgentLayer(root, config), quality = validateQuality(root, config), editor = validateAntigravity(root, config);
  const integration = validateIntegrationContract(root, config, loaded.tasks, { release:false });
  const errors = [...loaded.errors, ...agent.errors, ...quality.errors, ...editor.errors];
  if (config.projectState === 'ACTIVE') errors.push(...integration.errors.map((item) => ({ code:`INTEGRATION_${item.code}`, message:item.message })));
  if (!source) errors.push({ code: 'CONFIG_MISSING', message: 'No explicit execution configuration' });
  const execution = spawnSync(process.execPath, [fileURLToPath(new URL('./validate-execution.mjs', import.meta.url)), root], { cwd: root, encoding: 'utf8', timeout: 30000, windowsHide:true });
  if (execution.status !== 0) errors.push({ code: 'EXECUTION_INTEGRITY_FAILED', message: (execution.stderr || execution.stdout || execution.error?.message || `Validator terminated: ${execution.signal}`).trim() });
  const next = errors.length ? null : resolveNextExecution(loaded.tasks, config, { mode: 'closure' });
  let adapters;
  try { adapters = loadAdapterConfig(root, config.evidence?.adapterConfigPath ?? 'executionkit.adapters.json'); }
  catch (error) { adapters = { schemaVersion:null, adapters:{}, sourcePath:config.evidence?.adapterConfigPath ?? 'executionkit.adapters.json' }; errors.push({ code:'ADAPTER_CONFIG_INVALID', message:error.message }); }
  const stacks = detectStacks(root);
  let inventory = null, discoveryError = null;
  try { inventory = discoverProduct(root); } catch (error) { discoveryError = error.message; }
  const checkpoint = readCheckpoint(root);
  let recovery = null; try { recovery = recoverRuntime(root); } catch (error) { recovery = { status: 'ERROR', error: error.message }; }
  let candidate = { status: 'NOT_BUILT' };
  if (fs.existsSync(candidateFile(root))) { const result = validateCandidate(root); candidate = { status: result.errors.length ? 'STALE' : 'READY', errors: result.errors, candidateId: result.candidate?.candidateId ?? null }; }
  let revalidation = { status:'NOT_EVALUATED', revalidationRequired:false };
  if (candidate.status !== 'NOT_BUILT') {
    try { revalidation = analyzeRevalidation(root); }
    catch (error) { revalidation = { status:'ERROR', revalidationRequired:true, error:error.message }; }
  }

  const laravel = stacks.includes('laravel'), flutter = stacks.includes('flutter'), node = stacks.includes('node');
  const browserConfigured = configured(adapters, 'browser'), seoConfigured = configured(adapters, 'seo-performance');
  const tooling = toolingStatus(root), playwrightBin = node ? localBin(root, 'playwright') : null, lhciBin = node ? localBin(root, 'lhci') : null, axeResolved = node ? resolveToolingModule(root, '@axe-core/playwright') : null;

  let laravelBoost = { status: 'NOT_APPLICABLE' };
  if (laravel && composerHas(root, 'laravel/boost')) {
    if (!commandExists('php', { cwd: root })) laravelBoost = { status: 'NOT_AVAILABLE', reason: 'php executable not found', mcpCommand: 'php artisan boost:mcp' };
    else {
      const list = runCommand(root, 'php', ['artisan', 'list', '--format=json'], { timeoutMs: 30000 });
      let registered = false; try { const parsed = JSON.parse(list.stdout); registered = Array.isArray(parsed.commands) && parsed.commands.some((c) => (c.name ?? c) === 'boost:mcp'); } catch { registered = /boost:mcp/.test(list.stdout); }
      laravelBoost = { status: list.ok && registered ? 'READY' : 'DEGRADED', packageInstalled: true, mcpRegistered: registered, mcpCommand: 'php artisan boost:mcp' };
    }
  }

  let dartMcp = { status: 'NOT_APPLICABLE' };
  if (flutter) {
    if (!commandExists('dart', { cwd: root })) dartMcp = { status: 'NOT_AVAILABLE', reason: 'dart executable not found', mcpCommand: 'dart mcp-server' };
    else { const help = runCommand(root, 'dart', ['mcp-server', '--help'], { timeoutMs: 15000 }); dartMcp = { status: help.ok ? 'READY' : 'NOT_AVAILABLE', mcpCommand: 'dart mcp-server', reason: help.ok ? null : 'dart mcp-server subcommand is unavailable' }; }
  }

  const executionkitMcpRequired = editor.enabled === true, executionkitMcpReady = tooling['@modelcontextprotocol/server'] === 'READY' && tooling.zod === 'READY';
  const toolchains = {
    node: { status: 'READY', version: process.version }, git: tool('git'), php: tool('php', laravel), composer: tool('composer', laravel), flutter: tool('flutter', flutter), dart: tool('dart', flutter),
    playwright: !node ? { status: 'NOT_APPLICABLE' } : playwrightBin ? { status: 'READY', source: playwrightBin.includes('.executionkit') ? 'executionkit-tooling' : 'project' } : browserConfigured ? { status: 'NOT_AVAILABLE' } : { status: 'NOT_CONFIGURED' },
    axe: !node ? { status: 'NOT_APPLICABLE' } : axeResolved ? { status: 'READY' } : browserConfigured ? { status: 'NOT_AVAILABLE' } : { status: 'NOT_CONFIGURED' },
    lhci: !node ? { status: 'NOT_APPLICABLE' } : lhciBin ? { status: 'READY', source: lhciBin.includes('.executionkit') ? 'executionkit-tooling' : 'project' } : seoConfigured ? { status: 'NOT_AVAILABLE' } : { status: 'NOT_CONFIGURED' },
    laravelBoost, dartMcp,
    executionkitMcp: executionkitMcpReady ? { status: 'READY', modules: tooling } : executionkitMcpRequired ? { status: 'NOT_AVAILABLE', modules: tooling } : { status: 'NOT_CONFIGURED', modules: tooling },
  };

  let fleetAgent = { status:'NOT_APPLICABLE' };
  if (config.fleet?.enabled === true) {
    const local = inspectAgentLocalState();
    fleetAgent = {
      status: !local.configured ? 'NOT_CONFIGURED' : !local.running ? 'DEGRADED' : !local.config.serverConfigured ? 'DEGRADED' : local.status?.lastServerError ? 'DEGRADED' : 'READY',
      configured: local.configured,
      running: local.running,
      transportConfigured: local.config.serverConfigured,
      deviceId: local.identity?.deviceId ?? null,
      hostActiveProjects: local.status?.hostActiveProjects ?? [],
      executionActiveProjects: local.status?.executionActiveProjects ?? [],
      lastFlushAt: local.status?.lastFlushAt ?? null,
      lastServerError: local.status?.lastServerError ?? null,
      authority:'OBSERVATIONAL_ONLY',
    };
  }
  toolchains.executionkitAgent = fleetAgent;

  const candidateRequired = config.evidence?.candidateRequiredForRelease === true || (config.evidence?.requiredProducers ?? []).length > 0 || config.evidence?.requireTestAdequacy === true;
  const nonReadyFleet = config.fleet?.enabled === true && !['READY','NOT_APPLICABLE'].includes(fleetAgent.status);
  const hostNotVerified = editor.enabled === true && editor.nativeRuntimeVerified !== true;
  const degraded = Object.values(toolchains).some((value) => ['NOT_AVAILABLE', 'DEGRADED'].includes(value.status)) || nonReadyFleet || hostNotVerified || discoveryError || integration.errors.length > 0 || revalidation.revalidationRequired === true || candidate.status === 'STALE' || (candidateRequired && candidate.status === 'NOT_BUILT');
  const status = errors.length ? 'BLOCKED' : degraded ? 'DEGRADED' : 'READY';
  console.log(JSON.stringify({
    schemaVersion: '3.0.0-dev', status, ok: errors.length === 0, projectState: config.projectState, executionIntegrity: execution.status === 0,
    git: { head: git(['rev-parse', 'HEAD']), branch: git(['branch', '--show-current']), status: git(['status', '--porcelain']), upstream: git(['rev-parse', '--abbrev-ref', '@{upstream}']), remoteFreshness: 'NOT_FETCHED' },
    stacks, toolchains,
    adapters: { configured: Object.keys(adapters.adapters ?? {}), configSchema: adapters.schemaVersion, sourcePath: adapters.sourcePath ?? config.evidence?.adapterConfigPath ?? 'executionkit.adapters.json' },
    discovery: inventory ? { status: 'READY', fileCount: inventory.fileCount, counts: inventory.counts } : { status: 'DEGRADED', error: discoveryError },
    runtime: { checkpoint: checkpoint ? { status: checkpoint.status, taskId: checkpoint.plan?.task?.id ?? null, action: checkpoint.plan?.action ?? null } : null, recovery },
    fleet: { policy: config.fleet ?? { enabled:false }, agent: fleetAgent },
    candidate,
    integration: { status: integration.errors.length ? 'NEEDS_RECONCILIATION' : 'READY', errors: integration.errors, notes: integration.notes, contract: config.integration?.journeyContractPath ?? 'executionkit.integration.json' },
    revalidation,
    next: next ? { taskId: next.task.id, action: next.action, revalidationReason: next.revalidationReason ?? null } : null, closure: closureSummary(loaded.tasks, config),
    quality: { configured: quality.enabled, requirements: quality.requirementCount ?? 0, evidenceExecuted: false },
    antigravity: { configured: editor.enabled, runtimeVerified: editor.nativeRuntimeVerified === true, host: editor.host ?? null },
    errors,
    limits: 'Read-only local diagnosis. Host verification is reported only from prior explicit Antigravity hook + MCP acceptance evidence; this doctor does not itself fake or perform that handshake. No builds, product suites, network fetch, Elmasna3 server proof, device tests or physical runner checks were executed.'
  }, null, 2));
  process.exit(errors.length ? 1 : 0);
} catch (error) { console.error(`Doctor failed: ${error.message}`); process.exit(1); }
