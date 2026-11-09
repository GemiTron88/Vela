#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_AGENT_CONFIG } from '../lib/executionkit-agent.mjs';
import { sanitizeTelemetryValue, validateSemanticEventName } from '../lib/telemetry-events.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] || path.join(here,'..'));
const errors = [];
const requireFile = (rel) => { const file=path.join(root,rel); if (!fs.existsSync(file) || !fs.statSync(file).isFile()) errors.push(`required file missing: ${rel}`); return file; };
const read = (rel) => fs.readFileSync(requireFile(rel),'utf8');
const required = [
  'TODO.md','STANDARD.md','STANDARD_V3.md','PLAYBOOK.md','.agents/manifest.json','lib/executionkit-agent.mjs','lib/executionkit-agent-v3.mjs','lib/repository-identity.mjs','lib/state-model.mjs','lib/agent-pulse.mjs','lib/agent-inspection.mjs','lib/telemetry-events.mjs',
  'bin/executionkit-agent.mjs','bin/agent-doctor.mjs','bin/validate-v30-project.mjs','bin/validate-v30-docs.mjs','bin/validate-v30-post-publication.mjs','schemas/agent-telemetry.schema.json','schemas/agent-telemetry-ack.schema.json',
  'docs/architecture/executionkit-agent.md','docs/architecture/v3.0-scope.md','docs/architecture/v3-fleet-protocol.md','docs/architecture/v3-bootstrap-mode.md','docs/operations/v3-release-validation.md',
  'bin/migrate-v3.mjs','bin/mcp-server.mjs','tests/v30-agent.test.mjs','tests/v30-bootstrap-mode.test.mjs','tests/v30-protocol.test.mjs','tests/v30-reality-policy.test.mjs','tests/state-os.test.mjs',
];
for (const rel of required) requireFile(rel);

if (DEFAULT_AGENT_CONFIG.pulse.host !== '127.0.0.1') errors.push('Agent pulse listener must default to 127.0.0.1');
if (DEFAULT_AGENT_CONFIG.scan.idleMs < 60_000) errors.push('idle scan cadence is too aggressive');
if (DEFAULT_AGENT_CONFIG.heartbeat.idleMs < 120_000) errors.push('idle heartbeat cadence is too aggressive');
if (DEFAULT_AGENT_CONFIG.network.maxSpoolBytes > 16 * 1024 * 1024) errors.push('default spool exceeds 16 MiB budget');
if (!Number.isInteger(DEFAULT_AGENT_CONFIG.network.batchSize) || DEFAULT_AGENT_CONFIG.network.batchSize < 1 || DEFAULT_AGENT_CONFIG.network.batchSize > 100) errors.push('default batchSize must stay within protocol v1 1..100 events');
if (!Number.isFinite(DEFAULT_AGENT_CONFIG.network.maxBatchBytes) || DEFAULT_AGENT_CONFIG.network.maxBatchBytes < 64 * 1024) errors.push('default maxBatchBytes must be at least 64 KiB');
if (!Number.isInteger(DEFAULT_AGENT_CONFIG.network.gzipLevel) || DEFAULT_AGENT_CONFIG.network.gzipLevel < 1 || DEFAULT_AGENT_CONFIG.network.gzipLevel > 6) errors.push('default gzipLevel must be 1..6');
if (DEFAULT_AGENT_CONFIG.network.maxSpoolBytes < DEFAULT_AGENT_CONFIG.network.maxBatchBytes) errors.push('default spool must be at least one batch');
if (DEFAULT_AGENT_CONFIG.privacy.shareLocalPaths !== false) errors.push('local paths must be private by default');
if (DEFAULT_AGENT_CONFIG.privacy.shareHostname !== false) errors.push('hostname must be private by default');
if (DEFAULT_AGENT_CONFIG.privacy.machineResourceTelemetry !== false) errors.push('machine resource telemetry must be opt-in');

const rootExecutionConfig = JSON.parse(read('execution.config.json'));
if (rootExecutionConfig.todoPath !== 'TODO.md') errors.push('ExecutionKit distribution must self-host canonical TODO.md, not an example TODO');
if (rootExecutionConfig.agent?.manifestPath !== '.agents/manifest.json') errors.push('ExecutionKit distribution must self-host root .agents/manifest.json');
if (String(rootExecutionConfig.todoPath || '').startsWith('examples/')) errors.push('ExecutionKit distribution task authority may not point into examples/');
if (String(rootExecutionConfig.agent?.manifestPath || '').startsWith('examples/')) errors.push('ExecutionKit distribution Agent authority may not point into examples/');
const rootManifest = JSON.parse(read('.agents/manifest.json'));
if (rootManifest.taskAuthority?.path !== 'TODO.md' || rootManifest.taskAuthority?.mutableStateOwner !== 'TODO.md' || rootManifest.taskAuthority?.shadowBacklogsForbidden !== true) errors.push('root .agents manifest must bind sole mutable TODO.md authority');
const rootTodo = read('TODO.md');
for (const id of ['EK3-001','EK3-002','EK3-003','EK3-004','EK3-005','EK3-006','EK3-007','EK3-008','EK3-009','EK3-010','EK3-011','EK3-012','EK3-013']) if (!rootTodo.includes(`TASK:${id}`)) errors.push(`root canonical TODO missing v3 lifecycle task ${id}`);

const standardV3 = read('STANDARD_V3.md');
for (const marker of ['CANONICAL MAJOR-VERSION OVERLAY','exactly **eight systems**','sole mutable execution/backlog/status authority','Elmasna3 MUST NOT become a required dependency','Remote control remains disabled in protocol v1','hide hostname by default','tested commit/environment']) if (!standardV3.includes(marker)) errors.push(`normative 3.0 Standard overlay missing: ${marker}`);
const playbook = read('PLAYBOOK.md');
for (const marker of ['STANDARD_V3.md','ExecutionKit Agent — optional fleet observability','NOT_CONFIGURED','one Agent per physical developer device','HOST_ACTIVE','EXECUTION_ACTIVE','Project migration to current 3.x','Self-hosted CI and exact-candidate evidence']) if (!playbook.includes(marker)) errors.push(`3.0 Playbook contract missing: ${marker}`);
const releaseRunbook = read('docs/operations/v3-release-validation.md');
for (const marker of ['physical-device certification evidence','workflow_dispatch','Missing physical certification does **not** convert','Publication boundary']) if (!releaseRunbook.includes(marker)) errors.push(`3.0 release validation runbook missing: ${marker}`);

const agentCli = read('bin/executionkit-agent.mjs');
if (!agentCli.includes('ExecutionKitAgentRuntimeV3')) errors.push('Agent CLI is not routed through the 3.0 runtime');
for (const command of ['register','unregister','config','install','uninstall','stop']) if (!agentCli.includes(`command === '${command}'`)) errors.push(`Agent CLI command missing: ${command}`);
if (!agentCli.includes('inspectAgentLocalState')) errors.push('Agent CLI read-only commands must route through side-effect-free inspection');
if (agentCli.includes('readAgentStatus') || agentCli.includes('listAgentProjects')) errors.push('Agent CLI still uses state-creating legacy inspection helpers');
for (const flag of ['--share-hostname','--hide-hostname','--share-local-paths','--hide-local-paths','--token-stdin','--clear-token']) if (!agentCli.includes(flag)) errors.push(`Agent CLI privacy/credential flag missing: ${flag}`);
if (!agentCli.includes('[STORED_LOCAL_SECRET]')) errors.push('Agent CLI must mask locally stored credentials in config output');

const hook = read('bin/antigravity-hook.mjs');
if (!hook.includes('emitAgentPulse')) errors.push('Antigravity host activity pulse is not installed');
const pulse = read('lib/agent-pulse.mjs');
if (!pulse.includes("DEFAULT_AGENT_PULSE_HOST = '127.0.0.1'")) errors.push('Agent pulse sender must be hard-pinned to 127.0.0.1');
if (pulse.includes('EXECUTIONKIT_AGENT_HOST')) errors.push('Agent pulse host override is forbidden because workspace roots are local-only');

const repositoryIdentity = read('lib/repository-identity.mjs');
for (const marker of ["raw.includes('://')",'canonicalRepositoryIdentity','canonicalRepositoryKey','github.com']) if (!repositoryIdentity.includes(marker)) errors.push(`canonical repository identity helper incomplete: ${marker}`);
const daemonCore = read('lib/executionkit-agent.mjs');
if (!daemonCore.includes("canonicalRepositoryKey } from './repository-identity.mjs'")) errors.push('Agent registration must use the canonical repository identity helper');
if (!daemonCore.includes('canonicalRepositoryKey(origin.value)')) errors.push('Agent registration still hashes raw remote syntax');
for (const marker of ['MAX_EVENT_PAYLOAD_BYTES = 48 * 1024','MAX_PROTOCOL_BATCH_EVENTS = 100','maxBatchBytes: 512 * 1024','gzipLevel: 3','shareHostname: false','network.batchSize must be an integer from 1 to','network.maxSpoolBytes must be at least network.maxBatchBytes']) if (!daemonCore.includes(marker)) errors.push(`Agent protocol/config bound missing: ${marker}`);
const stateModel = read('lib/state-model.mjs');
if (!stateModel.includes("canonicalRepositoryKey } from './repository-identity.mjs'")) errors.push('State OS must use the shared canonical repository identity helper');
if (!stateModel.includes('repositoryKey: origin.ok ? canonicalRepositoryKey(origin.value) : null')) errors.push('State OS still hashes raw remote syntax');
const stateTest = read('tests/state-os.test.mjs');
if (!stateTest.includes('State OS repository identity is stable across GitHub HTTPS and SSH origin syntax')) errors.push('State OS canonical repository identity regression coverage is missing');
const runtime = read('lib/executionkit-agent-v3.mjs');
if (!runtime.includes("from './repository-identity.mjs'")) errors.push('v3 runtime must use the shared canonical repository identity helper');
for (const marker of ['single-daemon-per-device','staggered-project-scans','executionActiveProjects','hostActiveProjects','verified-batch-ack','maxBatchBytes','INVALID_CONTROL_PLANE_ACK','acknowledgeSpoolBatch','canonicalRepositoryIdentity','canonical-repository-identity','shareHostname','MAX_ACK_BYTES = 64 * 1024','boundedTransportBatch','readAckBody(response, controller)','compatibility.upgradeRequired === true','existing?.sessionId === this.sessionId','stateSnapshotFresh(snapshot)','bounded-http-exchange','state-os.freshness-guard']) if (!runtime.includes(marker)) errors.push(`3.0 Agent runtime marker missing: ${marker}`);

const migration = read('bin/migrate-v3.mjs');
for (const rel of ['lib/agent-pulse.mjs','lib/agent-inspection.mjs','lib/telemetry-events.mjs','bin/validate-v30-project.mjs','schemas/agent-telemetry.schema.json','schemas/agent-telemetry-ack.schema.json','docs/architecture/v3-fleet-protocol.md','docs/architecture/v3-bootstrap-mode.md']) if (!migration.includes(rel)) errors.push(`v3 migration omits project surface: ${rel}`);
if (!migration.includes('v3 project validation failed')) errors.push('v3 migration does not fail closed on project validation');
if (!migration.includes("remoteControl:'disabled'")) errors.push('v3 migration must force protocol-v1 remote control disabled');
const bootstrap = read('bin/init-project.mjs');
for (const rel of ['lib/agent-pulse.mjs','lib/agent-inspection.mjs','lib/telemetry-events.mjs','bin/validate-v30-project.mjs','schemas/agent-telemetry.schema.json','schemas/agent-telemetry-ack.schema.json','docs/architecture/v3-fleet-protocol.md','docs/architecture/v3-bootstrap-mode.md']) if (!bootstrap.includes(rel)) errors.push(`greenfield bootstrap omits v3 project surface: ${rel}`);
if (!bootstrap.includes("'validate-v30-project.mjs'")) errors.push('greenfield bootstrap does not post-validate v3 project wiring');
const projectWorkflow = read('templates/execution-integrity.yml');
if (!projectWorkflow.includes('validate-v30-project.mjs')) errors.push('generated self-hosted project workflow omits v3 project validation');
const inspector = read('lib/agent-inspection.mjs');
if (inspector.includes("from './executionkit-agent.mjs'")) errors.push('project-copyable agent inspection must not depend on per-device daemon core');
if (!inspector.includes('shareHostname:false')) errors.push('read-only Agent inspection must report hostname privacy disabled by default');
if (!inspector.includes('credentialStoredLocally')) errors.push('read-only Agent inspection must expose credential presence without exposing the secret');
if (/server\s*:\s*\{[^}]*token\s*:/s.test(inspector)) errors.push('read-only Agent inspection must not expose the stored credential value');
const agentDoctor = read('bin/agent-doctor.mjs');
for (const marker of ['credentialAvailable','credentialStoredLocally','NOT_CONFIGURED','Read-only local inspection']) if (!agentDoctor.includes(marker)) errors.push(`Agent Doctor credential/bootstrap marker missing: ${marker}`);
const projectValidator = read('bin/validate-v30-project.mjs');
for (const marker of ['V30_REMOTE_CONTROL_NOT_READ_ONLY','V30_PULSE_HOST_OVERRIDE_FORBIDDEN','V30_REALITY_POLICY_MISSING','V30_EVIDENCE_TRUTH_MODE_INVALID','V30_ACTIVE_RELEASE_PRODUCERS_MISSING','V30_ACTIVE_JOURNEY_APPLICABILITY_UNRESOLVED','V30_REQUIRED_PRODUCER_UNCONFIGURED','v3-bootstrap-mode.md']) if (!projectValidator.includes(marker)) errors.push(`v3 project validator hardening missing: ${marker}`);
const mcp = read('bin/mcp-server.mjs');
for (const marker of ['executionkit_agent_status','executionkit_fleet_status','state.checkpointed','runtime.cancelled']) if (!mcp.includes(marker)) errors.push(`MCP 3.0 integration marker missing: ${marker}`);
const requestSchema = JSON.parse(read('schemas/agent-telemetry.schema.json'));
if (!requestSchema.required?.includes('batchId')) errors.push('telemetry request schema must require batchId');
if (requestSchema.properties?.events?.maxItems !== 100) errors.push('telemetry request schema events.maxItems must remain 100 for protocol v1');
const kinds = requestSchema.$defs?.event?.properties?.kind?.enum ?? [];
for (const kind of ['executionkit.semantic','project.execution_active','project.execution_inactive']) if (!kinds.includes(kind)) errors.push(`telemetry schema missing ${kind}`);
const ackSchema = JSON.parse(read('schemas/agent-telemetry-ack.schema.json'));
for (const key of ['protocolVersion','batchId','status','acceptedCount','duplicateCount','serverTime','compatibility']) if (!ackSchema.required?.includes(key)) errors.push(`ACK schema missing required field ${key}`);
const protocolTest = read('tests/v30-protocol.test.mjs');
for (const marker of ['gzip','duplicate replay','PROTOCOL_UPGRADE_REQUIRED','latestSequence','INVALID_CONTROL_PLANE_ACK','2.0-only ACK compatibility cannot acknowledge or delete protocol v1 spool','upgradeRequired ACK cannot acknowledge or delete spool even when the range includes v1','complete HTTP exchange timeout includes delayed ACK body and retains spool','oversized ACK body is rejected before spool acknowledgement','serialized request envelope stays inside maxBatchBytes without dropping queued events','flushHeaders']) if (!protocolTest.includes(marker)) errors.push(`v3 protocol conformance coverage missing: ${marker}`);
const agentTest = read('tests/v30-agent.test.mjs');
for (const marker of ['GitHub SSH and HTTPS remotes resolve to one canonical repository identity','registered worktree identity stays stable when origin changes between HTTPS and SSH syntax','Agent config hydrates v3 defaults and rejects protocol-incompatible bounds','Agent rejects a single telemetry event that cannot fit the minimum batch budget','Agent rejects malformed durable ACK fields without deleting spool','single-instance lock rejects a second runtime even when it shares the same PID','State RUNNING snapshot activates execution only while the snapshot is fresh','one project observation failure is isolated and does not abort the device cycle']) if (!agentTest.includes(marker)) errors.push(`Agent v3 regression coverage missing: ${marker}`);
const bootstrapTest = read('tests/v30-bootstrap-mode.test.mjs');
for (const marker of ['read-only Agent status/list/stop','no control plane is configured','unreachable control plane','transport failure incorrectly became an execution failure']) if (!bootstrapTest.includes(marker)) errors.push(`v3 bootstrap-mode coverage missing: ${marker}`);
const bootstrapDoc = read('docs/architecture/v3-bootstrap-mode.md');
for (const marker of ['NOT_CONFIGURED','External fleet observability is never a prerequisite','Elmasna3 dogfood bootstrap','side-effect-free']) if (!bootstrapDoc.includes(marker)) errors.push(`v3 bootstrap-mode contract missing: ${marker}`);
const fleetProtocol = read('docs/architecture/v3-fleet-protocol.md');
for (const marker of ['Control-plane optionality','NOT_CONFIGURED','(deviceId, worktreeId)','Events produced before transport is configured','complete HTTP exchange','64 KiB','minProtocol <= localProtocol <= maxProtocol','stale RUNNING snapshot']) if (!fleetProtocol.includes(marker)) errors.push(`v3 fleet protocol bootstrap/identity contract missing: ${marker}`);

try { validateSemanticEventName('runtime.step_started'); } catch (error) { errors.push(`semantic event validation failed: ${error.message}`); }
const sanitized = sanitizeTelemetryValue({ token:'secret', transcript:'private', localPath:'/private/work', dirtyPathSample:['a'], message:'private', safe:'ok' });
if ('token' in sanitized || 'transcript' in sanitized || 'localPath' in sanitized || 'dirtyPathSample' in sanitized || 'message' in sanitized || sanitized.safe !== 'ok') errors.push('telemetry sanitizer privacy contract failed');
for (const rel of ['execution.config.json','templates/execution.config.json']) {
  const config = JSON.parse(read(rel));
  if (config.fleet?.enabled !== true) errors.push(`${rel} must enable the 3.0 fleet surface`);
  if (config.fleet?.agentMode !== 'per-device') errors.push(`${rel} fleet Agent must be per-device`);
  if (config.fleet?.telemetry?.authority !== 'observational') errors.push(`${rel} telemetry authority must be observational`);
  if (config.fleet?.telemetry?.uploadTodoContent !== false || config.fleet?.telemetry?.uploadSourceContent !== false) errors.push(`${rel} must forbid routine TODO/source upload`);
  if (config.fleet?.remoteControl !== 'disabled') errors.push(`${rel} remote control must remain disabled for protocol v1`);
}
const pkg = JSON.parse(read('package.json'));
for (const script of ['agent:run','agent:status','agent:register','agent:unregister','agent:config','agent:stop','agent:doctor','agent:install','agent:uninstall','validate:self','validate:v30','validate:v30-docs','project:migrate:v3']) if (!pkg.scripts?.[script]) errors.push(`package script missing: ${script}`);
if (!String(pkg.scripts?.['validate:v30'] || '').includes('validate-v30-post-publication.mjs')) errors.push('validate:v30 must enforce the post-publication regression gate');
if (!String(pkg.scripts?.check || '').startsWith('npm run validate:self')) errors.push('canonical check must begin with self-hosted root validation');
if (!String(pkg.scripts?.check || '').includes('validate:v30')) errors.push('canonical check does not include validate:v30');
if (!String(pkg.scripts?.check || '').includes('validate:v30-docs')) errors.push('canonical check does not include validate:v30-docs');
console.log(JSON.stringify({ schemaVersion:'executionkit-v30-policy/v1', status:errors.length ? 'FAIL' : 'PASS', errors }, null, 2));
process.exit(errors.length ? 1 : 0);
