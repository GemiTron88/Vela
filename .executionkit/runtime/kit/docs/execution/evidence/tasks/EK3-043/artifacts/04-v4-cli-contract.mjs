import { V4_STANDARD_TARGET } from './v4-config.mjs';

export const V4_CLI_VERSION = V4_STANDARD_TARGET;

export const EXIT_CODES = Object.freeze({
  OK: 0,
  BLOCKED: 1,
  CLI_ERROR: 2,
});

export const HELP_ALIASES = Object.freeze(['help', '--help', '-h']);
export const VERSION_ALIASES = Object.freeze(['version', '--version', '-V']);

export const GROUPED_COMMANDS = Object.freeze(new Set([
  'systems',
  'control-plane',
  'platform',
  'activation',
  'boundary',
  'visual',
  'state',
  'knowledge',
  'db',
  'content',
  'docs',
  'seo',
  'audit',
  'test',
  'launch',
  'agents',
  'providers',
  'reconcile',
  'todo',
  'product',
  'proof',
  'upgrade-revalidation'
]));

export const HELP_USAGE = Object.freeze([
  'executionkit start|status|next [project] [--host antigravity] [--boost] [--deep]',
  'executionkit systems status [project]',
  'executionkit control-plane status|verify-head [project] [--expected <40-char-sha>]',
  'executionkit platform status [project]',
  'executionkit activation status|apply [project] [--no-commit]',
  'executionkit boundary wave|phase [project] [--base <git-ref>] [--timeout-ms <milliseconds>]',
  'executionkit product status|reconcile [project] [--task <id>] [--no-commit]',
  'executionkit todo status|maintain|migrate [project] [--apply]',
  'executionkit proof status|seal [project] [--task <id>] [--active-only] [--apply]',
  'executionkit upgrade-revalidation status|plan|run [project] [--dry-run] [--no-task]',
  'executionkit visual status|validate [project]',
  'executionkit state status|rehydrate|checkpoint|amnesia [project]',
  'executionkit knowledge status|refresh|search|impact|providers|context [project]',
  'executionkit knowledge auto [project] --purpose agent-context|macro-context|docs-context|knowledge-search|relationship|impact|test-impact|git-read',
  'executionkit knowledge usage [project]',
  'executionkit db status|refresh|guard|table|column|model [project] [--all|--files file1;file2]',
  'executionkit content status|discover|validate [project] [--boundary task|wave|phase|release]',
  'executionkit docs status|refresh|build|validate|search [project]',
  'executionkit seo status|validate [project]',
  'executionkit audit task|wave|phase|release [project]',
  'executionkit test impact|task|wave|phase|release [project] [--base <git-ref>] [--dry-run]',
  'executionkit launch status|plan|build|verify|release|deploy|rollback [project] [--authorize for deploy/rollback]',
  'executionkit agents status|plan|run|collect [project] [--boost]',
  'executionkit agents delegated [project] --claim <id>',
  'executionkit agents integrate|reconcile|cleanup [project] --claim <id> [--apply|--force]',
  'executionkit agents result [worker-worktree] --status COMPLETED|BLOCKED [--verification cmd1;cmd2 --evidence ref1;ref2]',
  'executionkit install|update|upgrade|repair [project] [--source <v4-source>] [--apply|--auto|--dry-run] [--plan-id <id>] [--allow-dirty]',
  'executionkit reconcile status|task|wave|phase|release [project] [--task <id>] [--base <git-ref>]',
  'executionkit providers status|doctor [project] (native-only)',
  'executionkit doctor [project]',
  'executionkit rollback [project] --transaction <id>'
]);

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
    description: 'Inspect live status and evidence contracts across all ten systems',
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
    description: 'Inspect platform, architecture, Node environment and runner portability',
    subcommands: ['status'],
    flags: [],
    outputSchema: 'executionkit-v4-platform/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit platform status [project]']
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
    description: 'Inspect Product Closure status and reconcile canonical gap tasks',
    subcommands: ['status', 'reconcile'],
    flags: ['task', 'no-commit'],
    outputSchema: 'executionkit-v4-product-closure/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit product status|reconcile [project] [--task <id>] [--no-commit]']
  },
  {
    name: 'todo',
    family: 'todo',
    description: 'Inspect, maintain or migrate canonical TODO shards',
    subcommands: ['status', 'maintain', 'migrate'],
    flags: ['apply'],
    outputSchema: 'executionkit-todo-maintenance/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit todo status|maintain|migrate [project] [--apply]']
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
    flags: ['dry-run', 'no-task'],
    outputSchema: 'executionkit-v4-upgrade-revalidation/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit upgrade-revalidation status|plan|run [project] [--dry-run] [--no-task]']
  },
  {
    name: 'visual',
    family: 'visual',
    description: 'Inspect or validate Visual OS evidence contracts',
    subcommands: ['status', 'validate'],
    flags: [],
    outputSchema: 'executionkit-visual-os/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit visual status|validate [project]']
  },
  {
    name: 'state',
    family: 'state',
    description: 'Inspect, rehydrate, checkpoint or test State OS continuity',
    subcommands: ['status', 'rehydrate', 'checkpoint', 'amnesia'],
    flags: [],
    outputSchema: 'executionkit-state-os/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit state status|rehydrate|checkpoint|amnesia [project]']
  },
  {
    name: 'knowledge',
    family: 'knowledge',
    description: 'Query, refresh or search Repository Intelligence fabric',
    subcommands: ['status', 'refresh', 'search', 'impact', 'providers', 'context', 'auto', 'usage'],
    flags: ['purpose'],
    outputSchema: 'executionkit-knowledge/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: [
      'executionkit knowledge status|refresh|search|impact|providers|context [project]',
      'executionkit knowledge auto [project] --purpose agent-context|macro-context|docs-context|knowledge-search|relationship|impact|test-impact|git-read',
      'executionkit knowledge usage [project]'
    ]
  },
  {
    name: 'db',
    family: 'db',
    description: 'Database Integrity Fabric: status, refresh, guard, table/column/model lookup',
    subcommands: ['status', 'refresh', 'guard', 'table', 'column', 'model'],
    flags: ['all', 'files'],
    outputSchema: 'executionkit-database-integrity/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit db status|refresh|guard|table|column|model [project] [--all|--files file1;file2]']
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
    flags: [],
    outputSchema: 'executionkit-docs-os/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit docs status|refresh|build|validate|search [project]']
  },
  {
    name: 'seo',
    family: 'seo',
    description: 'SEO OS: status, validate',
    subcommands: ['status', 'validate'],
    flags: [],
    outputSchema: 'executionkit-seo-os/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit seo status|validate [project]']
  },
  {
    name: 'audit',
    family: 'audit',
    description: 'Audit OS: task, wave, phase, release mechanical and runtime audits',
    subcommands: ['task', 'wave', 'phase', 'release'],
    flags: [],
    outputSchema: 'executionkit-audit-orchestrator/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit audit task|wave|phase|release [project]']
  },
  {
    name: 'test',
    family: 'test',
    description: 'Test OS: impact, task, wave, phase, release test execution',
    subcommands: ['impact', 'task', 'wave', 'phase', 'release'],
    flags: ['base', 'dry-run'],
    outputSchema: 'executionkit-test-os/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit test impact|task|wave|phase|release [project] [--base <git-ref>] [--dry-run]']
  },
  {
    name: 'launch',
    family: 'launch',
    description: 'Launch OS: status, plan, build, verify, release, deploy, rollback',
    subcommands: ['status', 'plan', 'build', 'verify', 'release', 'deploy', 'rollback'],
    flags: ['authorize'],
    outputSchema: 'executionkit-launch-os/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit launch status|plan|build|verify|release|deploy|rollback [project] [--authorize for deploy/rollback]']
  },
  {
    name: 'agents',
    family: 'agents',
    description: 'Agent OS: status, plan, run, collect, delegated, integrate, reconcile, cleanup, result',
    subcommands: ['status', 'plan', 'run', 'collect', 'delegated', 'integrate', 'reconcile', 'cleanup', 'result'],
    flags: ['boost', 'claim', 'apply', 'force', 'status', 'message', 'verification', 'evidence'],
    outputSchema: 'executionkit-v4-agent-runtime/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: [
      'executionkit agents status|plan|run|collect [project] [--boost]',
      'executionkit agents delegated [project] --claim <id>',
      'executionkit agents integrate|reconcile|cleanup [project] --claim <id> [--apply|--force]',
      'executionkit agents result [worker-worktree] --status COMPLETED|BLOCKED [--verification cmd1;cmd2 --evidence ref1;ref2]'
    ]
  },
  {
    name: 'reconcile',
    family: 'reconcile',
    description: 'Reconcile lifecycle boundaries and tasks against Git and docs truth',
    subcommands: ['status', 'task', 'wave', 'phase', 'release'],
    flags: ['task', 'base', 'no-doc-commit', 'boundary'],
    outputSchema: 'executionkit-v4-reconcile/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit reconcile status|task|wave|phase|release [project] [--task <id>] [--base <git-ref>]']
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
    description: 'Verify health, permissions and completeness of ExecutionKit installation',
    subcommands: [],
    flags: [],
    outputSchema: 'executionkit-v4-doctor/v1',
    exitCodes: { OK: 0, BLOCKED: 1, CLI_ERROR: 2 },
    usage: ['executionkit doctor [project]']
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

export function commandToken(line) {
  return String(line).replace(/^executionkit\s+/, '').split(/\s+/)[0] ?? '';
}

export function usageForCommand(name) {
  return HELP_USAGE.filter((line) => commandToken(line).split('|').includes(name));
}

export function availableCommands() {
  return [...new Set(HELP_USAGE.flatMap((line) => commandToken(line).split('|')).concat(['help', 'version']))].sort();
}

export function cliInputErrorCode(message) {
  if (/^Unknown ExecutionKit v4 command:/.test(message)) return 'UNKNOWN_COMMAND';
  if (/^Unknown .* action:/.test(message) || /^External provider plan\/apply commands/.test(message)) return 'UNKNOWN_ACTION';
  if (/^(?:[a-z0-9-]+\s+[a-z0-9-]+\s+requires\s+|--[a-z0-9-]+ is required|Choose --dry-run)/.test(message)) return 'INVALID_ARGUMENT';
  return null;
}

export function findCommandSpec(name) {
  return CLI_COMMAND_REGISTRY.find((cmd) => cmd.name === name) ?? null;
}

export function getCliCommandRegistry() {
  return {
    schemaVersion: 'executionkit-v4-cli-registry/v1',
    version: V4_CLI_VERSION,
    mcp: 'DISABLED',
    systems: 10,
    commands: CLI_COMMAND_REGISTRY,
    usage: HELP_USAGE,
    groupedCommands: [...GROUPED_COMMANDS].sort(),
    availableCommands: availableCommands()
  };
}

export function parseCliArgs(rawArgv = []) {
  const args = [...rawArgv];
  const rawCommand = args.shift() ?? 'help';
  const isHelpAlias = HELP_ALIASES.includes(rawCommand);
  const isVersionAlias = VERSION_ALIASES.includes(rawCommand);
  const command = isHelpAlias ? 'help' : isVersionAlias ? 'version' : rawCommand;

  const commandHelpRequested = !isHelpAlias && !isVersionAlias && HELP_ALIASES.includes(args[0] ?? '');
  if (commandHelpRequested) args.shift();

  const sub = !commandHelpRequested && GROUPED_COMMANDS.has(command) && args[0] && !args[0].startsWith('--') ? args.shift() : null;
  const projectArg = args[0] && !args[0].startsWith('--') ? args.shift() : '.';

  const flags = new Set();
  const options = new Map();

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
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          options.set(key, args[i + 1]);
        }
      }
    }
  }

  return {
    rawCommand,
    command,
    sub,
    projectArg,
    commandHelpRequested,
    isHelp: command === 'help',
    isVersion: command === 'version',
    flags,
    options,
    remainingArgs: args
  };
}
