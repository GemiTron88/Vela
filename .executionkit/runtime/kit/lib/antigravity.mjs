import fs from 'node:fs';
import path from 'node:path';
import { loadAgentManifest, validateAgentLayer } from './agent-model.mjs';
import { projectFile } from './quality-model.mjs';
import { hostRuntimeStatus } from './host-bootstrap.mjs';

const rulePath = '.agents/rules/executionkit-entry.md';
const rule = `# ExecutionKit entry rule

For authorized repository execution, read AGENTS.md and execution.config.json and use
the ExecutionKit MCP/plugin when available. Enter through the canonical TODO/native
authority and honor all eight current systems: Execution, Agent, Content, SEO, Audit,
Test, Launch and cross-cutting State OS. Repository-local diagnostic fallbacks are:

\`node bin/validate-state.mjs .\`
\`node bin/state-rehydrate.mjs .\`
\`node bin/validate-seo.mjs .\`
\`node bin/next-execution.mjs . --json\`
\`node bin/resolve-task-context.mjs . --next --json\`
\`node bin/runtime-status.mjs .\`

Read the returned canonical role, skill, rule, workflow and contract paths. Use TODO.md
(or its configured native authority) for all mutable task state. Runtime, discovery,
SEO evidence/contracts, State snapshots, plans, walkthroughs, checklists and screenshots
are derived context/evidence only. ExecutionKit 3.x resolves one lifecycle action at a
time. Do not fan canonical tasks into parallel sessions. A host-native subagent/tool may
receive one bounded current action, then must hand back a result/evidence before another
action is selected. Route review candidates to an independent reviewer. Preserve
interrupted/unrelated changes and follow the user's current scope. Missing tools, MCP
activation, search-engine observations or evidence are never a PASS.

Antigravity host activation is fail-closed. If local host-bootstrap state is not
HOST_VERIFIED, stop product execution. Structural plugin/skill/rule/hook/MCP files are
not activation evidence. A fresh live PreInvocation hook observation for the current
host-surface boundary plus successful ExecutionKit host MCP acceptance are required.

Premium Experience is a mandatory cross-cutting product-quality contract for UI-bearing
work, not a ninth OS or backlog authority. For Blade/Livewire/Tailwind/Alpine,
Flutter/mobile/Dart, Web Components/custom elements, frontend/page/screen, responsive,
accessibility, UI/UX/design or component work, resolve the Agent OS
\`design-system → component-system → premium-experience\` chain even when the task omitted
a literal \`premium\` tag. Inspect the real design/token authority and component contract,
extend before create, use production-shaped data and required states, and require rendered
review across applicable form factors/input modes/accessibility/native behavior. Source
existence or a happy-path render is not Premium acceptance; anti-generic review and an
independent rendered visual acceptance remain evidence gates.

When SEO is configured, treat NOT_APPLICABLE as valid only after actual public-surface
and product-intent inspection. Route search work through Agent OS SEO specialists, and
use candidate-bound SEO S3 through release-readiness at the release boundary. Do not
equate route existence, Lighthouse output or repository structure with indexing,
ranking, rich results or traffic.
`;
const hook = { PreInvocation: [{ type: 'command', command: 'node bin/antigravity-hook.mjs', timeout: 10 }] };
const nativeEntry = (kind, resource, root) => {
  const format = kind === 'skills' ? /^\.agents\/skills\/[^/]+\/SKILL\.md$/ : /^\.agents\/agents\/(?:[^/]+\.md|[^/]+\/agent\.md)$/;
  if (!format.test(resource.path)) return false;
  const content = fs.readFileSync(projectFile(root, resource.path), 'utf8');
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  return Boolean(fm && /^name:\s*\S/m.test(fm) && /^description:\s*\S/m.test(fm));
};

function reconcileHostAdapter(existing, expected, label) {
  if (!existing) return expected;
  if (existing.path !== expected.path || existing.adapterFor !== expected.adapterFor) throw new Error(`Conflicting adapter registration: ${label}`);
  if (existing.adapterHost && existing.adapterHost !== expected.adapterHost) throw new Error(`Conflicting adapter host: ${label}`);
  Object.assign(existing, expected);
  return existing;
}

export function planAntigravity(root, config) {
  const runtime = config.installation?.runtimePath;
  const route = text => runtime ? text.replace(/\bnode bin\//g, `node ${runtime}/bin/`) : text;
  const expectedHook = JSON.parse(route(JSON.stringify(hook)));
  const validation = validateAgentLayer(root, config);
  if (validation.errors.length) throw new Error(validation.errors.map((e) => `[${e.code}] ${e.message}`).join('; '));
  const { manifestPath } = loadAgentManifest(root, config), manifest = structuredClone(validation.manifest);
  const writes = new Map(), reservedPaths = new Set(), reservedIds = new Set();
  for (const kind of ['roles', 'skills']) {
    for (const resource of manifest.resources[kind].filter((r) => !r.adapterFor && !r.adapterForWorkflow)) {
      if (nativeEntry(kind, resource, root)) continue;
      const name = `ek-${resource.id.replace(/[._]/g, '-')}`;
      const id = `adapter.antigravity.${resource.id}`;
      const target = kind === 'skills' ? `.agents/skills/${name}/SKILL.md` : `.agents/agents/${name}.md`;
      if (reservedPaths.has(target) || reservedIds.has(id)) throw new Error(`Antigravity alias collision: ${resource.id}`);
      reservedPaths.add(target); reservedIds.add(id);
      const description = `Loads canonical ExecutionKit ${kind === 'skills' ? 'skill' : 'role'} ${resource.id}; follow its declared task scope sequentially.`;
      const roleMetadata = kind === 'roles' ? 'model: inherit\ncommandExecutionPolicy: sandbox\ntools: [view_file, list_dir, grep_search, run_command, write_to_file, replace_file_content]\n' : '';
      const content = `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n${roleMetadata}---\n\nRead the canonical repository-root-relative file \`${resource.path}\`.\nThis entrypoint adapts host discovery only. TODO remains the only mutable task\nauthority. Handle one current lifecycle action; do not create parallel sessions.\n`;
      writes.set(target, content);
      const expected = { id, path: target, adapterFor: resource.id, adapterHost: 'antigravity', native: true };
      const existing = manifest.resources[kind].find((r) => r.id === id);
      if (!existing) manifest.resources[kind].push(expected);
      else reconcileHostAdapter(existing, expected, id);
    }
  }
  const expectedRule = {
    id: 'rule.antigravity-entry',
    path: rulePath,
    capabilities: ['agent', 'execution', 'seo'],
    adapterFor: 'rule.todo-authority',
    adapterHost: 'antigravity',
    native: true,
  };
  const existingRule = manifest.resources.rules.find((r) => r.id === expectedRule.id);
  if (!existingRule) manifest.resources.rules.push(expectedRule);
  else {
    if (existingRule.path !== rulePath) throw new Error('Conflicting Antigravity entry rule registration');
    if (existingRule.adapterFor && existingRule.adapterFor !== expectedRule.adapterFor) throw new Error('Conflicting Antigravity entry rule source');
    if (existingRule.adapterHost && existingRule.adapterHost !== expectedRule.adapterHost) throw new Error('Conflicting Antigravity entry rule host');
    Object.assign(existingRule, expectedRule);
  }
  writes.set(rulePath, route(rule));
  let hooks = {};
  const hookPath = projectFile(root, '.agents/hooks.json');
  if (fs.existsSync(hookPath)) hooks = JSON.parse(fs.readFileSync(hookPath, 'utf8'));
  if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) throw new Error('Existing hooks.json must be an object');
  if (hooks['executionkit-context'] && JSON.stringify(hooks['executionkit-context']) !== JSON.stringify(expectedHook)) throw new Error('Existing executionkit-context hook differs; reconcile it explicitly');
  hooks['executionkit-context'] = expectedHook;
  writes.set('.agents/hooks.json', JSON.stringify(hooks, null, 2) + '\n');
  writes.set(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return { writes, manifestPath, entrypointCount: reservedPaths.size, nativeRuntimeVerified: false };
}

export function validateAntigravity(root, config) {
  if (!config.editors?.antigravity) return { enabled: false, errors: [], nativeRuntimeVerified: false, host: { status:'NOT_CONFIGURED', runtimeVerified:false } };
  const errors = [];
  try {
    const plan = planAntigravity(root, config);
    for (const [rel, content] of plan.writes) {
      const full = projectFile(root, rel);
      if (!fs.existsSync(full) || fs.readFileSync(full, 'utf8').replaceAll('\r\n','\n') !== content) errors.push({ code: 'ANTIGRAVITY_ADAPTER_DRIFT', message: `Missing/stale adapter surface: ${rel}` });
    }
    if (!fs.existsSync(projectFile(root, `${config.installation?.runtimePath ? config.installation.runtimePath + '/' : ''}bin/antigravity-hook.mjs`))) errors.push({ code: 'ANTIGRAVITY_HOOK_MISSING', message: 'bin/antigravity-hook.mjs missing' });
    const pluginRoot = projectFile(root, '.agents/plugins/executionkit');
    if (!fs.existsSync(path.join(pluginRoot, 'plugin.json'))) errors.push({ code: 'ANTIGRAVITY_PLUGIN_MISSING', message: '.agents/plugins/executionkit/plugin.json missing' });
    else {
      const plugin = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'plugin.json'), 'utf8'));
      if (plugin.name !== 'executionkit') errors.push({ code: 'ANTIGRAVITY_PLUGIN_INVALID', message: 'ExecutionKit plugin name mismatch' });
      if (fs.existsSync(path.join(pluginRoot, 'agents'))) errors.push({ code: 'ANTIGRAVITY_PARALLEL_AGENT_BUNDLE_FORBIDDEN', message: 'ExecutionKit plugin must not contain agents/; canonical Agent OS delegation is project-bound and must not create a shadow subagent queue' });
      const mcpPath = path.join(pluginRoot, 'mcp_config.json');
      if (!fs.existsSync(mcpPath)) errors.push({ code: 'ANTIGRAVITY_MCP_CONFIG_MISSING', message: 'ExecutionKit plugin mcp_config.json missing' });
      else {
        const mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
        const hostServer = mcp.mcpServers?.['executionkit-host'];
        if (!hostServer || !Array.isArray(hostServer.args) || !hostServer.args.some((arg) => /host-mcp-server\.mjs$/.test(arg))) errors.push({ code:'ANTIGRAVITY_HOST_ACCEPTANCE_MCP_MISSING', message:'ExecutionKit host-acceptance MCP server is missing or unrouted' });
      }
      if (config.capabilities?.seo !== 'NONE' && !fs.existsSync(path.join(pluginRoot, 'skills', 'ek-seo', 'SKILL.md'))) errors.push({ code: 'ANTIGRAVITY_SEO_SKILL_MISSING', message: 'Enabled SEO capability requires bundled Antigravity ek-seo skill' });
      const entryRule = path.join(pluginRoot, 'rules', 'executionkit.md');
      if (config.capabilities?.seo !== 'NONE' && (!fs.existsSync(entryRule) || !fs.readFileSync(entryRule, 'utf8').includes('all **eight systems**'))) errors.push({ code: 'ANTIGRAVITY_EIGHT_SYSTEM_ENTRY_MISSING', message: 'Antigravity plugin entry rule must honor all eight current ExecutionKit systems' });
      if (!fs.existsSync(entryRule) || !/Premium Experience[\s\S]*design-system[^\n]*component-system[^\n]*premium-experience/i.test(fs.readFileSync(entryRule, 'utf8'))) errors.push({ code: 'ANTIGRAVITY_PREMIUM_ENTRY_MISSING', message: 'Antigravity plugin entry rule must enforce the cross-cutting Premium Experience construction invariant and UI skill chain' });
      if (!fs.existsSync(entryRule) || !/HOST_BOOTSTRAP_GATE[\s\S]*executionkit_host_accept/i.test(fs.readFileSync(entryRule, 'utf8'))) errors.push({ code:'ANTIGRAVITY_HOST_GATE_RULE_MISSING', message:'Antigravity entry rule must enforce live host acceptance before product work' });
    }
  } catch (error) { errors.push({ code: 'ANTIGRAVITY_ADAPTER_INVALID', message: error.message }); }
  let host;
  try { host = hostRuntimeStatus(root); } catch (error) { host = { status:'INVALID', runtimeVerified:false, reason:error.message }; }
  return { enabled: true, errors, nativeRuntimeVerified: host.runtimeVerified === true, sequentialOnly: true, host };
}
