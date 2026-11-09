import {readFileSync} from 'node:fs';
import { V4_STANDARD_TARGET } from './v4-config.mjs';

export const V4_CLI_VERSION = V4_STANDARD_TARGET;
export const CLI_VERSION=readFileSync(new URL('../VERSION',import.meta.url),'utf8').trim();
export const CLI_SYSTEM_COUNT=CLI_VERSION.startsWith('5.')?11:10;

export const EXIT_CODES = Object.freeze({
  OK: 0,
  BLOCKED: 1,
  CLI_ERROR: 2,
});

export const HELP_ALIASES = Object.freeze(['help', '--help', '-h']);
export const VERSION_ALIASES = Object.freeze(['version', '--version', '-V']);

// Help, discovery and grouping are derived from the registry below.

export const CLI_COMMAND_REGISTRY = Object.freeze([
  {
    name: 'start',
    family: 'execution',
    description: 'Enter project execution, construct execution envelope and dispatch next canonical command',
    subcommands: [],
    flags: ['host', 'boost', 'deep', 'timing'],
    outputSchema: 'executionkit-v4-envelope/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit start [project] [--host antigravity] [--boost] [--deep]']
  },
  {
    name: 'status',
    family: 'execution',
    description: 'Inspect execution envelope and pending task status',
    subcommands: [],
    flags: ['host', 'boost', 'deep', 'timing'],
    outputSchema: 'executionkit-v4-envelope/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit status [project] [--host antigravity] [--boost] [--deep]']
  },
  {
    name: 'next',
    family: 'execution',
    description: 'Select next actionable task and execution envelope',
    subcommands: [],
    flags: ['host', 'boost', 'deep', 'timing'],
    outputSchema: 'executionkit-v4-envelope/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit next [project] [--host antigravity] [--boost] [--deep]']
  },
  {
    name: 'systems',
    family: 'systems',
    description: 'Inspect live status and evidence contracts across all configured systems',
    subcommands: ['status'],
    flags: [],
    outputSchema: 'executionkit-v4-systems/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit systems status [project]']
  },
  {
    name: 'control-plane',
    family: 'control-plane',
    description: 'Inspect GitHub-native control plane and verify exact canonical HEAD',
    subcommands: ['status', 'verify-head'],
    flags: ['expected'],
    outputSchema: 'executionkit-v4-control-plane/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit control-plane status|verify-head [project] [--expected <40-char-sha>]']
  },
  {
    name: 'platform',
    family: 'platform',
    description: 'Inspect platform, architecture, Node environment, runner portability and global host contract synchronization',
    subcommands: ['status','provision','sync-global'],
    flags: ['source','target','apply','dry-run'],
    outputSchema: 'executionkit-v4-platform/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: [
      'executionkit platform status [project]',
      'executionkit platform provision [project] [--source <exact-v4-source>]',
      'executionkit platform sync-global [project] [--target <path>] [--apply|--dry-run]'
    ]
  },
  {
    name: 'activation',
    family: 'activation',
    description: 'Inspect or apply project-level v4 system activation',
    subcommands: ['status', 'apply'],
    flags: ['no-commit'],
    outputSchema: 'executionkit-v4-activation/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit activation status|apply [project] [--no-commit]']
  },
  {
    name: 'boundary',
    family: 'boundary',
    description: 'Run wave or phase lifecycle convergence boundaries',
    subcommands: ['wave', 'phase'],
    flags: ['base', 'timeout-ms'],
    outputSchema: 'executionkit-v4-boundary/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit boundary wave|phase [project] [--base <git-ref>] [--timeout-ms <milliseconds>]']
  },
  {
    name: 'product',
    family: 'product',
    description: 'Inspect Product Closure status, discover product surfaces/components and reconcile canonical gap tasks',
    subcommands: ['status', 'reconcile', 'discover', 'components'],
    flags: ['task', 'no-commit'],
    outputSchema: 'executionkit-v4-product-closure/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit product status|reconcile|discover|components [project] [--task <id>] [--no-commit]']
  },
  {
    name: 'todo',
    family: 'todo',
    description: 'Inspect, maintain, migrate, archive or atomically complete canonical TODO tasks and shards',
    subcommands: ['status', 'maintain', 'migrate', 'complete', 'archive'],
    flags: ['apply', 'task', 'verify', 'status', 'evidence', 'no-reconcile', 'dry-run'],
    outputSchema: 'executionkit-todo-maintenance/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: [
      'executionkit todo status|maintain|migrate|archive [project] [--apply]',
      'executionkit todo complete [project] --task <id> [--verify <cmd>] [--status VERIFIED|ACCEPTED] [--evidence <summary>] [--apply|--dry-run]'
    ]
  },
  {
    name: 'proof',
    family: 'proof',
    description: 'Inspect or seal durable task evidence and receipts',
    subcommands: ['status', 'seal'],
    flags: ['task', 'active-only', 'apply'],
    outputSchema: 'executionkit-task-proof-status/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit proof status|seal [project] [--task <id>] [--active-only] [--apply]']
  },
  {
    name: 'upgrade-revalidation',
    family: 'upgrade-revalidation',
    description: 'Inspect, plan or run invariant-aware upgrade revalidation',
    subcommands: ['status', 'plan', 'run'],
    flags: ['dry-run', 'no-task','all-checks','progress','timeout-ms'],
    outputSchema: 'executionkit-v4-upgrade-revalidation/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit upgrade-revalidation status|plan|run [project] [--dry-run] [--no-task] [--all-checks] [--timeout-ms <ms>]']
  },
  {
    name: 'visual',
    family: 'visual',
    description: 'Discover, plan, capture, inspect, compare and independently certify rendered product quality',
    subcommands: ['status', 'validate', 'discover', 'plan', 'media-plan', 'media-check', 'capture', 'inspect', 'compare', 'remediate', 'certify', 'boundary'],
    flags: ['init', 'boundary', 'mode', 'base', 'changed', 'run', 'resume', 'claim', 'release', 'human', 'task-findings', 'finding', 'accept', 'waive', 'rationale', 'offset', 'limit', 'verify', 'cell', 'response', 'reviewer'],
    outputSchema: 'executionkit-visual-os/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit visual status|validate [project]', 'executionkit visual discover|plan|capture|inspect|compare|remediate|certify|boundary [project] [--mode impact|full] [--base <git-ref>] [--run <uuid>] [--cell <cellId> --response <file>]', 'executionkit visual discover [project] --init', 'executionkit visual media-plan|media-check [project] [--offset N] [--limit 1..100] [--verify]']
  },
  {
    name: 'state',
    family: 'state',
    description: 'Inspect, rehydrate, checkpoint or test State OS continuity',
    subcommands: ['status', 'rehydrate', 'checkpoint', 'amnesia', 'memory'],
    flags: ['reason', 'note', 'next-safe-action', 'context-health', 'working-file', 'evidence'],
    outputSchema: 'executionkit-state-os/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit state status|rehydrate|checkpoint|amnesia|memory [project]']
  },
  {
    name: 'knowledge',
    family: 'knowledge',
    description: 'Query, refresh or search Repository Intelligence fabric',
    subcommands: ['status', 'refresh', 'search', 'impact', 'providers', 'context', 'auto', 'usage', 'freshness', 'read', 'symbol', 'relation', 'engineering', 'engineering-stored', 'engineering-refresh', 'external-ingest', 'external-stored', 'external-search'],
    flags: ['purpose', 'query', 'target', 'operation', 'op', 'base', 'git-args', 'max-bytes', 'path', 'start-line', 'end-line', 'max-lines', 'symbol', 'limit', 'depth', 'context-lines', 'artifact', 'apply', 'persist', 'full', 'docs', 'paths'],
    outputSchema: 'executionkit-knowledge/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: [
      'executionkit knowledge status|refresh|search|impact|providers|context|freshness|read|symbol|relation [project]',
      'executionkit knowledge auto [project] --purpose agent-context|macro-context|docs-context|knowledge-search|relationship|impact|test-impact|git-read',
      'executionkit knowledge usage [project]'
    ]
  },
  {
    name: 'guard',
    family: 'guard',
    description: 'Mandatory local assets, forms, translations, AntiFake, UX/UI, Flutter, Visuals, Performance/Speed and live vhost guards',
    subcommands: ['all','assets','forms','lang','antifake','ux','flutter','visuals','perf','vhost'],
    flags: ['all','files'],
    outputSchema: 'executionkit-surface-guard/v1',
    exitCodes: { OK: 0, FAIL: 1, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit guard all|assets|forms|lang|antifake|ux|flutter|visuals|perf|vhost [project] [--all|--files file1;file2]']
  },
  {
    name: 'decision',
    family: 'decision',
    description: 'Bundled deterministic Decision OS, local canonical plan alignment and validated KB refresh',
    subcommands: ['status','advise','refresh','align'],
    flags: ['input','task','accept','authorize','expected-goal'],
    outputSchema: 'executionkit-decision-adapter/v1',
    exitCodes: { OK: 0, MANDATORY_DENIAL: 1, BLOCKED: 1, UNAVAILABLE: 2, CLI_ERROR: 2 },
    usage: ['executionkit decision status [project]','executionkit decision advise [project] --input <typed-request.json>','executionkit decision refresh [project]','executionkit decision align [project] --task <id> [--accept --authorize --expected-goal <digest>]']
  },
  {
    name: 'db',
    family: 'db',
    description: 'Database Integrity Fabric: status, refresh, guard, table/column/model lookup',
    subcommands: ['status', 'refresh', 'guard', 'table', 'column', 'model'],
    flags: ['all', 'files', 'table', 'column', 'model', 'deep'],
    outputSchema: 'executionkit-database-integrity/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit db status|refresh|guard|table|column|model [project] [--all|--files file1;file2]']
  },
  {
    name: 'route',
    family: 'route',
    description: 'Route Integrity Fabric: compile route truth, guard named references and probe HTTP 404/5xx failures',
    subcommands: ['status','refresh','guard','probe'],
    flags: ['all','files','probe','base-url','timeout-ms','limit','deep'],
    outputSchema: 'executionkit-route-integrity/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: [
      'executionkit route status|refresh|guard [project] [--all|--files file1;file2] [--probe --base-url <url>]',
      'executionkit route probe [project] [--base-url <url>] [--timeout-ms 5000] [--limit 250]'
    ]
  },
  {
    name: 'content',
    family: 'content',
    description: 'Content OS: status, discover, validate',
    subcommands: ['status', 'discover', 'validate'],
    flags: ['boundary'],
    outputSchema: 'executionkit-content-os/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit content status|discover|validate [project] [--boundary task|wave|phase|release]']
  },
  {
    name: 'docs',
    family: 'docs',
    description: 'Docs OS: status, refresh, build, validate, search',
    subcommands: ['status', 'refresh', 'build', 'validate', 'search'],
    flags: ['query'],
    outputSchema: 'executionkit-docs-os/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit docs status|refresh|build|validate|search [project]']
  },
  {
    name: 'seo',
    family: 'seo',
    description: 'SEO OS: status, validate',
    subcommands: ['status', 'validate'],
    flags: ['boundary', 'no-write'],
    outputSchema: 'executionkit-seo-os/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit seo status|validate [project]']
  },
  {
    name: 'audit',
    family: 'audit',
    description: 'Audit OS: task, wave, phase, release mechanical, security, data-safety, health, quality and storage audits',
    subcommands: ['task', 'wave', 'phase', 'release', 'security', 'data-safety', 'health', 'quality', 'storage'],
    flags: ['strict', 'release'],
    outputSchema: 'executionkit-audit-orchestrator/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit audit task|wave|phase|release|security|data-safety|health|quality|storage [project]']
  },
  {
    name: 'test',
    family: 'test',
    description: 'Test OS: impact, portfolio, task, wave, phase, release, journeys, flakes and targeted test execution',
    subcommands: ['impact', 'portfolio', 'task', 'wave', 'phase', 'release', 'journeys', 'flakes', 'select'],
    flags: ['base', 'dry-run', 'init', 'platform', 'boundary', 'target', 'files', 'filter', 'task'],
    outputSchema: 'executionkit-test-os/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit test impact|portfolio|task|wave|phase|release|flakes|select [project] [--target <file>] [--filter <pattern>] [--base <git-ref>] [--dry-run]', 'executionkit test journeys [project] [--dry-run|--init --platform web|android|ios] [--boundary wave|phase|release]']
  },
  {
    name: 'launch',
    family: 'launch',
    description: 'Launch OS: status, plan, build, verify, validate-artifact, readiness, release, deploy, rollback',
    subcommands: ['status', 'plan', 'build', 'verify', 'validate-artifact', 'readiness', 'host-plan', 'host-check', 'storage', 'providers', 'providers-discover', 'backup', 'release', 'deploy', 'rollback', 'mobile', 'service'],
    flags: ['environment','target-id','artifact-sha256','authorize', 'mode', 'kind', 'expected-commit', 'job', 'worker', 'principal', 'desired', 'release', 'channel', 'receipt', 'artifact', 'artifact-file', 'output-file', 'handoff-file', 'test-evidence-file', 'flutter-version', 'skip-tests', 'allow-untested', 'max-evidence-age-ms', 'run-build', 'notes', 'digest', 'operation', 'adapter-root', 'adapter-sha', 'project-file', 'input-file', 'config', 'port'],
    outputSchema: 'executionkit-launch-os/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit launch status|plan|build|verify| host-plan|host-check|storage|backup|release|deploy|rollback [project] [--authorize for backup/deploy/rollback]'.replace('verify| host-plan','verify|host-plan'), 'executionkit launch validate-artifact|readiness [project] [--release <id>]', 'executionkit launch providers|providers-discover [project] [--environment production] [--artifact-sha256 <sha256>] [--target-id production]', 'executionkit launch service start|status [project] [--config <file>] [--port <1-65535>]', 'executionkit launch mobile [project] --mode status|plan|doctor|build|inspect|handoff|import|submit|agents|cancel|control|attest|release|approve|publish|rollback|provider|classify|history [--kind verify|apk|debug_apk|aab] [--expected-commit <sha>] [--artifact-file <path>] [--output-file <path>] [--handoff-file <path>] [--worker <id> --principal <id>] [--authorize for build/import/submit/cancel/control/attest/release/approve/publish/provider mutations]']
  },
  {
    name: 'agents',
    family: 'agents',
    description: 'Agent OS: status, plan, run, collect, delegated, integrate, reconcile, cleanup, result',
    subcommands: ['status', 'plan', 'run', 'collect', 'delegated', 'decline', 'integrate', 'reconcile', 'cleanup', 'result'],
    flags: ['boost', 'claim', 'apply', 'force', 'status', 'message', 'verification', 'evidence', 'retry-spawn', 'spawn-tool', 'worker-id', 'reason'],
    outputSchema: 'executionkit-v4-agent-runtime/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: [
      'executionkit agents status|plan|run|collect [project] [--boost] [--retry-spawn for agents run]',
      'executionkit agents delegated [project] --claim <id> --spawn-tool <actual-tool> --worker-id <returned-worker-id>',
      'executionkit agents decline [project] [--reason HOST_SPAWN_UNAVAILABLE]',
      'executionkit agents integrate|reconcile|cleanup [project] --claim <id> [--apply|--force]',
      'executionkit agents result [worker-worktree] --status COMPLETED|BLOCKED [--verification cmd1;cmd2 --evidence ref1;ref2]'
    ]
  },
  {
    name: 'reconcile',
    family: 'reconcile',
    description: 'Reconcile lifecycle boundaries and tasks against Git and docs truth',
    subcommands: ['status', 'task', 'wave', 'phase', 'release'],
    flags: ['task', 'base', 'no-doc-commit', 'boundary', 'timeout-ms'],
    outputSchema: 'executionkit-v4-reconcile/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit reconcile status|task|wave|phase|release [project] [--task <id>] [--base <git-ref>] [--timeout-ms <ms>]']
  },
  {
    name: 'install',
    family: 'installation',
    description: 'Install ExecutionKit into a project',
    subcommands: [],
    flags: ['source', 'apply', 'auto', 'dry-run', 'plan-id', 'allow-dirty'],
    outputSchema: 'executionkit-v4-installer/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit install [project] [--source <v4-source>] [--apply|--auto|--dry-run] [--plan-id <id>] [--allow-dirty]']
  },
  {
    name: 'self-update',
    family: 'installation',
    description: 'Check for canonical updates and self-update project-local ExecutionKit safely',
    subcommands: ['status', 'check', 'apply'],
    flags: ['force', 'allow-dirty', 'dry-run'],
    outputSchema: 'executionkit-v4-self-update/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: [
      'executionkit self-update status [project]',
      'executionkit self-update check [project] [--force]',
      'executionkit self-update apply [project] [--allow-dirty] [--dry-run]'
    ]
  },
  {
    name: 'update',
    family: 'installation',
    description: 'Update installed ExecutionKit to latest official main or source',
    subcommands: [],
    flags: ['source', 'apply', 'auto', 'dry-run', 'plan-id', 'allow-dirty'],
    outputSchema: 'executionkit-v4-installer/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit update [project] [--source <v4-source>] [--apply|--auto|--dry-run] [--plan-id <id>] [--allow-dirty]']
  },
  {
    name: 'upgrade',
    family: 'installation',
    description: 'Upgrade project from legacy ExecutionKit version to v4',
    subcommands: [],
    flags: ['source', 'apply', 'auto', 'dry-run', 'plan-id', 'allow-dirty'],
    outputSchema: 'executionkit-v4-installer/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit upgrade [project] [--source <v4-source>] [--apply|--auto|--dry-run] [--plan-id <id>] [--allow-dirty]']
  },
  {
    name: 'repair',
    family: 'installation',
    description: 'Repair damaged or incomplete ExecutionKit installation',
    subcommands: [],
    flags: ['source', 'apply', 'auto', 'dry-run', 'plan-id', 'allow-dirty'],
    outputSchema: 'executionkit-v4-installer/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit repair [project] [--source <v4-source>] [--apply|--auto|--dry-run] [--plan-id <id>] [--allow-dirty]']
  },
  {
    name: 'doctor',
    family: 'installation',
    description: 'Verify health, permissions and completeness of ExecutionKit installation, or run full V5 review / CLI audit',
    subcommands: [],
    flags: ['bootstrap', 'review', 'cli-audit', 'distribution'],
    outputSchema: 'executionkit-v4-doctor/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit doctor [project] [--bootstrap|--review|--cli-audit|--distribution]']
  },
  {
    name: 'providers',
    family: 'providers',
    description: 'Inspect native provider tooling status',
    subcommands: ['status', 'doctor'],
    flags: [],
    outputSchema: 'executionkit-v4-providers/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit providers status|doctor [project] (native-only)']
  },
  {
    name: 'rollback',
    family: 'installation',
    description: 'Rollback a previous installation or migration transaction',
    subcommands: [],
    flags: ['transaction'],
    outputSchema: 'executionkit-v4-rollback/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit rollback [project] --transaction <id>']
  },
  {
    name: 'help',
    family: 'meta',
    description: 'Show general or command-specific CLI usage and discovery metadata',
    subcommands: [],
    flags: [],
    outputSchema: 'executionkit-v4-cli/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit help [command]']
  },
  {
    name: 'version',
    family: 'meta',
    description: 'Show ExecutionKit version identity',
    subcommands: [],
    flags: [],
    outputSchema: 'executionkit-v4-cli/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit version']
  }
]);

export function deriveCliSurface(registry) {
  return {
    groupedCommands: new Set(registry.filter((cmd) => cmd.subcommands?.length).map((cmd) => cmd.name)),
    usage: registry.flatMap((cmd) => cmd.usage ?? []),
    availableCommands: [...new Set(registry.map((cmd) => cmd.name).concat(['help', 'version']))].sort()
  };
}

const CLI_SURFACE = deriveCliSurface(CLI_COMMAND_REGISTRY);
export const GROUPED_COMMANDS = Object.freeze(CLI_SURFACE.groupedCommands);
export const HELP_USAGE = Object.freeze(CLI_SURFACE.usage);

export function commandToken(line) {
  return String(line).replace(/^executionkit\s+/, '').split(/\s+/)[0] ?? '';
}

export function usageForCommand(name) {
  return findCommandSpec(name)?.usage ?? [];
}

export function availableCommands() {
  return [...CLI_SURFACE.availableCommands];
}

export function cliInputErrorCode(message) {
  if (/^Unknown ExecutionKit v4 command:/.test(message)) return 'UNKNOWN_COMMAND';
  if (/^Unknown .* action:/.test(message) || /^External provider plan\/apply commands/.test(message)) return 'UNKNOWN_ACTION';
  if (/^(?:[a-z0-9-]+\s+[a-z0-9-]+\s+requires\s+|--[a-z0-9-]+ is required|Choose --dry-run|Plan revision acceptance requires --authorize|Canonical task not found|DECISION_INPUT_INVALID)/.test(message)) return 'INVALID_ARGUMENT';
  return null;
}

export function findCommandSpec(name) {
  return CLI_COMMAND_REGISTRY.find((cmd) => cmd.name === name) ?? null;
}

export function getCliCommandRegistry() {
  return {
    outputPolicy:{default:'compact-json',terminal:'human',jsonFlag:'--json',budgetBytes:4096,fullOutputFlag:'--full-output',progressFlag:'--progress',progressDefault:'bounded-heartbeat',humanFlag:'--human',colorFlag:'--color'},
    schemaVersion: 'executionkit-v4-cli-registry/v1',
    version: CLI_VERSION,
    mcp: 'DISABLED',
    systems: CLI_SYSTEM_COUNT,
    commands: CLI_COMMAND_REGISTRY,
    usage: HELP_USAGE,
    groupedCommands: [...GROUPED_COMMANDS].sort(),
    availableCommands: availableCommands()
  };
}

function isPathToken(token) {
  if (!token) return false;
  return token === '.' || token === '..' || token.includes('/') || token.includes('\\');
}

const BOOLEAN_CLI_FLAGS = new Set([
  'json', 'human', 'full-output', 'progress', 'timing', 'color', 'help',
  'boost', 'deep', 'apply', 'auto', 'dry-run', 'force', 'allow-dirty',
  'no-reconcile', 'no-commit', 'no-doc-commit', 'no-task', 'no-write',
  'all', 'all-checks', 'probe', 'release', 'init', 'authorize',
  'skip-tests', 'allow-untested', 'run-build', 'retry-spawn',
  'accept', 'waive', 'verify', 'changed', 'resume', 'bootstrap',
  'review', 'cli-audit', 'distribution', 'full', 'docs', 'persist'
]);

export function parseCliArgs(rawArgv = []) {
  const args = [...rawArgv];
  const rawCommand = args.shift() ?? 'help';
  const isHelpAlias = HELP_ALIASES.includes(rawCommand);
  const isVersionAlias = VERSION_ALIASES.includes(rawCommand);
  let command = isHelpAlias ? 'help' : isVersionAlias ? 'version' : rawCommand;

  // Support `executionkit help <command>` as command-specific help.
  let helpTarget = null;
  if (command === 'help' && args[0] && !args[0].startsWith('-') && !isPathToken(args[0])) {
    helpTarget = args.shift();
  }

  // Help anywhere in a command must short-circuit dispatch, including mutating
  // subcommands such as `launch deploy --help` and `decision refresh -h`.
  const commandHelpRequested = Boolean(helpTarget) || (!isHelpAlias && !isVersionAlias && (
    HELP_ALIASES.includes(args[0] ?? '') || args.some(arg=>arg==='--help'||arg==='-h') ||
    GROUPED_COMMANDS.has(command)&&args[1]==='help'
  ));
  if (helpTarget) command = helpTarget;
  if (commandHelpRequested && HELP_ALIASES.includes(args[0] ?? '')) args.shift();

  const spec = findCommandSpec(command);
  const canTakeSub = GROUPED_COMMANDS.has(command) && args[0] && !args[0].startsWith('--') && !isPathToken(args[0]) && (!commandHelpRequested || spec?.subcommands?.includes(args[0]));
  const rawSub = canTakeSub ? args.shift() : null;
  const sub = command === 'test' && ['run', 'target'].includes(rawSub) ? 'task' : rawSub;
  if (commandHelpRequested && HELP_ALIASES.includes(args[0] ?? '')) args.shift();
  const serviceAction=command==='launch'&&sub==='service'&&args[0]&&!args[0].startsWith('--')&&!isPathToken(args[0])?args.shift():null;
  const doctorAction=command==='doctor'&&args[0]&&['review','cli-audit','distribution','bootstrap'].includes(args[0])?args.shift():null;
  const isDbLookupArg=command==='db'&&['table','column','model'].includes(sub)&&args[0]&&!args[0].startsWith('--')&&!isPathToken(args[0])&&!(args[1]&&!args[1].startsWith('--')&&!isPathToken(args[1])&&sub!=='column')&&!(sub==='column'&&args[2]&&!args[2].startsWith('--'));
  const projectArg = !isDbLookupArg && args[0] && !args[0].startsWith('--') ? args.shift() : '.';

  const flags = new Set();
  const options = new Map();
  const positionalArgs = [];

  for (let i = 0; i < args.length; i++) {
    const item = args[i];
    if (item.startsWith('--')) {
      const eqIdx = item.indexOf('=');
      if (eqIdx >= 0) {
        const key = item.slice(2, eqIdx);
        const val = item.slice(eqIdx + 1);
        options.set(key, val);
        flags.add(key);
      } else {
        const key = item.slice(2);
        flags.add(key);
        if (!BOOLEAN_CLI_FLAGS.has(key) && i + 1 < args.length && !args[i + 1].startsWith('--')) {
          options.set(key, args[i + 1]);
          i++;
        }
      }
    } else if (!item.startsWith('-')) {
      positionalArgs.push(item);
    }
  }

  return {
    rawCommand,
    command,
    sub,
    serviceAction,
    doctorAction,
    projectArg,
    commandHelpRequested,
    isHelp: command === 'help' && !commandHelpRequested,
    isVersion: command === 'version',
    flags,
    options,
    positionalArgs,
    remainingArgs: args
  };
}


