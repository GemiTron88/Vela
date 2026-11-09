#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] ?? path.join(here, '..'));
const errors = [];
const issue = (code, message) => errors.push({ code, message });
const norm = (value) => value.split(path.sep).join('/');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && /\.md$/i.test(entry.name)) out.push(full);
  }
  return out;
}
function activeMarkdownFiles() {
  const explicit = ['STANDARD.md', 'STANDARD_V3.md', 'STANDARD_V4.md', 'STANDARD_V5.md', 'AGENTS.md', 'README.md', 'PLAYBOOK.md'];
  const files = explicit.map((rel) => path.join(root, rel)).filter(fs.existsSync);
  for (const base of ['docs', 'contracts', 'templates']) {
    for (const full of walk(path.join(root, base))) {
      const rel = norm(path.relative(root, full));
      if (rel.startsWith('docs/audits/') || rel.startsWith('docs/archive/') || rel.includes('/historical/') || rel.includes('/history/')) continue;
      files.push(full);
    }
  }
  return [...new Set(files)];
}

const stalePatterns = [
  ['STALE_FIVE_CAPABILITY_MODEL', /\bfive\s+(?:named\s+)?(?:OS\s+)?capabilit/i],
  ['STALE_PROFILE_SELECTION', /Choose\s+Execution\s*,\s*Content\s*,\s*Audit\s*,\s*Test\s+and\s+Launch\s+levels/i],
  ['STALE_PHASE_VERIFIED', /all\s+mandatory\s+tasks\s+[`*_]*VERIFIED[`*_]*/i],
  ['STALE_READY_TO_VERIFIED', /(?:move|moves|moving|from)\s+[`*_]*READY[`*_]*[^\n]{0,80}(?:to|->)\s+[`*_]*VERIFIED[`*_]*/i],
  ['STALE_CI_VERIFIED', /cannot\s+claim\s+[`*_]*VERIFIED[`*_]*/i],
  ['STALE_EVIDENCE_VERIFIED', /Evidence\s+is[^\n]{0,100}supporting\s+VERIFIED\s+and\s+RELEASED/i],
  ['STALE_READY_ONLY_SCHEDULER', /ignore\s+CANCELLED\s*\/\s*VERIFIED\s*\/\s*RELEASED/i],
  ['STALE_VERIFIED_DEPENDENCY', /hard\s+dependencies\s+(?:are|must\s+be)\s+[`*_]*VERIFIED[`*_]*/i],
  ['STALE_BOOTSTRAP_MIGRATION', /Fresh\s*\/\s*migrated\s+v2\s+installations\s+enter\s+[`*_]*BOOTSTRAP[`*_]*/i],
  ['STALE_V2_0_HEADING', /^#\s+[^\n]+—\s+v2\.0\.0\s*$/im],
  ['STATE_AS_TASK_AUTHORITY', /State\s+OS\s+(?:is|becomes|owns)\s+(?:the\s+)?(?:canonical\s+)?(?:task|backlog|status)\s+authority/i],
  ['MEMORY_AS_TASK_AUTHORITY', /Memory\s+MCP\s+(?:is|becomes|owns)\s+(?:the\s+)?(?:canonical\s+)?(?:task|backlog|status)\s+authority/i],
  ['SEO_AS_TASK_AUTHORITY', /SEO\s+OS\s+(?:is|becomes|owns)\s+(?:the\s+)?(?:canonical\s+)?(?:task|backlog|status)\s+authority/i],
];

const files = activeMarkdownFiles();
for (const full of files) {
  const rel = norm(path.relative(root, full));
  const text = fs.readFileSync(full, 'utf8');
  for (const [code, pattern] of stalePatterns) if (pattern.test(text)) issue(code, `${rel} contains stale/unsafe semantics matching ${pattern}`);
}

if (fs.existsSync(path.join(root, 'STANDARD_V5.md'))) {
// Current authority is checked independently of retained V3/V4 migration text.
for (const rel of ['AGENTS.md','README.md','PLAYBOOK.md']) {
  const full = path.join(root, rel);
  if (fs.existsSync(full)) {
    const current = fs.readFileSync(full, 'utf8');
    if ((rel !== 'AGENTS.md' && !current.includes('STANDARD_V5.md')) || !/eleven(?:\*\*)? (?:executable )?(?:ExecutionKit )?systems/i.test(current))
      issue('CURRENT_V5_AUTHORITY_MISSING', rel + ' must route current use to eleven systems');
  }
}

}

const requiredFiles = [
  'STANDARD_V3.md',
  'docs/capabilities/execution-os.md','docs/capabilities/agent-os.md','docs/capabilities/content-os.md','docs/capabilities/seo-os.md','docs/capabilities/audit-os.md','docs/capabilities/test-os.md','docs/capabilities/launch-os.md',
  'docs/architecture/state-os.md','templates/STATE_OS.md','PLAYBOOK.md','templates/SEO_OS.md','templates/executionkit.seo.json',
  'templates/EXECUTION_OS.md','templates/AGENT_OS.md','templates/CONTENT_OS.md','templates/AUDIT_OS.md','templates/TEST_OS.md','templates/LAUNCH_OS.md',
  'contracts/finding-contract.md','docs/adoption/project-intake.md','docs/adoption/universal-adoption.md','docs/adoption/deep-integration.md','docs/architecture/v2.2-scope.md','docs/architecture/v3.0-scope.md','docs/architecture/v3-fleet-protocol.md','docs/architecture/v3-bootstrap-mode.md','docs/architecture/concurrency.md','docs/integrations/antigravity.md',
];
for (const rel of requiredFiles) if (!fs.existsSync(path.join(root, rel))) issue('CANONICAL_SURFACE_MISSING', rel);

function requireText(rel, checks) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return;
  const text = fs.readFileSync(full, 'utf8');
  for (const [code, pattern, description] of checks) if (!pattern.test(text)) issue(code, `${rel}: ${description}`);
}
function forbidText(rel, checks) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return;
  const text = fs.readFileSync(full, 'utf8');
  for (const [code, pattern, description] of checks) if (pattern.test(text)) issue(code, `${rel}: ${description}`);
}

requireText('docs/capabilities/execution-os.md', [
  ['EXECUTION_AGENT_BOUNDARY_MISSING', /Agent OS/i, 'must bind Agent OS'],
  ['EXECUTION_ACCEPTED_MISSING', /\bACCEPTED\b/, 'must define ACCEPTED closure'],
  ['EXECUTION_CORRECTION_MISSING', /CORRECTION_REQUIRED/, 'must include correction lane'],
  ['EXECUTION_ACTIONABLE_BLOCKER_MISSING', /AI-actionable/i, 'must distinguish AI-actionable blockers'],
  ['EXECUTION_READY_STARVATION_GUARD_MISSING', /candidate[^\n]{0,100}READY|READY[^\n]{0,100}candidate/i, 'must prevent READY-only candidate starvation'],
]);
requireText('docs/adoption/project-intake.md', [
  ['INTAKE_SEVEN_CAPABILITIES_MISSING', /seven\s+capabilit|Execution[^\n]+Agent[^\n]+Content[^\n]+SEO[^\n]+Audit[^\n]+Test[^\n]+Launch/i, 'profile/intake must include all seven capability authorities'],
  ['INTAKE_SEARCH_SURFACE_MISSING', /public[^\n]{0,100}(?:search|index)|SEO\s+applicab/i, 'must classify public organic-search applicability'],
  ['INTAKE_ACCEPTED_MISSING', /\bACCEPTED\b/, 'must include ACCEPTED lifecycle/traceability'],
]);
requireText('contracts/finding-contract.md', [['FINDING_ACCEPTED_RISK_MISSING', /ACCEPTED_RISK/, 'must use ACCEPTED_RISK for accepted findings']]);
requireText('AGENTS.md', [
  ['ROOT_RELEASE_GATE_INCOMPLETE', /npm\s+run\s+check/, 'repository release instructions must use npm run check'],
  ['ROOT_SEVEN_CAPABILITIES_MISSING', /seven\s+capability authorities|(?:ten|eleven)(?:\*\*)?\s+executable\s+systems/i, 'must define current capability/system authorities'],
  ['ROOT_STATE_OS_MISSING', /State OS/i, 'must define State OS'],
  ['ROOT_SEO_AUTHORITY_MISSING', /SEO OS/i, 'must include SEO OS authority'],
  ['ROOT_STATE_ROUTING_MISSING', /registered\s+\*\*and routable\*\*|registered\s+\*\*and\s+routable\*\*/i, 'must require resources to be routable'],
  ['ROOT_AMNESIA_MISSING', /Amnesia Test/i, 'must require zero-context recovery proof'],
]);

// STANDARD.md is the intentionally preserved v2.2.4 semantic base. Its six-capability/System-7 wording is historical and remains required there.
requireText('STANDARD.md', [
  ['STANDARD_SIX_CAPABILITIES_MISSING', /six\s+capabilities/i, 'historical v2.2.4 base must describe six capability authorities'],
  ['STANDARD_STATE_SYSTEM_MISSING', /State OS as cross-cutting system #7|State OS.*system #7/i, 'historical v2.2.4 base must define State OS as seventh system'],
  ['STANDARD_CONTEXT_DISPOSABLE_MISSING', /Context is disposable\. Repository state is reconstructable\./i, 'must define reconstructable-context principle'],
  ['STANDARD_STATE_REHYDRATION_MISSING', /BOOT\s*->\s*REHYDRATE\s*->\s*VERIFY\s*->\s*RESUME|BOOT\s*→\s*REHYDRATE\s*→\s*VERIFY\s*→\s*RESUME/i, 'must define resume protocol'],
  ['STANDARD_MEMORY_ADVISORY_MISSING', /ADVISORY_ONLY/i, 'must keep external memory advisory'],
  ['STANDARD_AMNESIA_MISSING', /Amnesia Test/i, 'must define zero-context recovery test'],
  ['STANDARD_COMPATIBLE_MIGRATION_MISSING', /compatible\s+v2\s+minor\/patch/i, 'must distinguish compatible v2 migration from major bootstrap'],
  ['STANDARD_DISTRIBUTION_SEMANTIC_SCAN_MISSING', /semantic\s+documentation\s+drift|canonical-document\s+semantic/i, 'must require semantic distribution drift checks'],
  ['STANDARD_SEQUENTIAL_RUNTIME_MISSING', /runtime\s+orchestration\s+is\s+[`*_]*SEQUENTIAL/i, 'must define sequential runtime'],
  ['STANDARD_DISCOVERY_MISSING', /product\s+discovery/i, 'must define product discovery'],
  ['STANDARD_CANDIDATE_EVIDENCE_MISSING', /candidate\s+identity/i, 'must define candidate-bound evidence'],
  ['STANDARD_DERIVED_STATE_MISSING', /derived\s+(?:state|artifacts)/i, 'must define derived-state boundary'],
  ['STANDARD_STATE_FLOOR_MISSING', /246\s+runtime tests\s+across\s+28\s+required test files/i, 'must preserve the historical v2.2.4 regression floor'],
]);
requireText('STANDARD_V3.md', [
  ['STANDARD_V3_OVERLAY_MISSING', /CANONICAL MAJOR-VERSION OVERLAY/i, 'must identify the normative major-version overlay'],
  ['STANDARD_V3_EIGHT_SYSTEMS_MISSING', /exactly\s+\*{0,2}eight systems|exactly\s+eight systems/i, 'must define the current eight-system model'],
  ['STANDARD_V3_SEVEN_CAPABILITIES_MISSING', /first seven are capability authorities/i, 'must define seven current capability authorities'],
  ['STANDARD_V3_SEO_MISSING', /SEO OS is a first-class[^\n]*conditional capability authority/i, 'must define conditional SEO authority'],
  ['STANDARD_V3_PROGRAMMATIC_GUARD_MISSING', /Programmatic SEO MUST fail closed/i, 'must fail programmatic SEO closed'],
  ['STANDARD_V3_TASK_AUTHORITY_MISSING', /sole mutable execution\/backlog\/status authority/i, 'must preserve sole mutable task authority'],
  ['STANDARD_V3_BOOTSTRAP_INDEPENDENCE_MISSING', /Elmasna3 MUST NOT become a required dependency/i, 'must preserve control-plane-independent execution'],
  ['STANDARD_V3_REMOTE_CONTROL_MISSING', /Remote control remains disabled in protocol v1/i, 'must keep protocol-v1 control disabled'],
  ['STANDARD_V3_PRIVACY_MISSING', /hide hostname by default/i, 'must require hostname privacy default'],
  ['STANDARD_V3_EXACT_CANDIDATE_MISSING', /exact applicable candidate|exact candidate/i, 'must require exact-candidate release evidence'],
]);
requireText('README.md', [
  ['README_EIGHT_SYSTEMS_MISSING', /(?:Eight|Ten) systems|eleven\s+(?:executable\s+)?systems/i, 'must present the current system model'],
  ['README_SEO_TASK_MISSING', /EK00-005S/i, 'must include canonical SEO deep-integration task'],
  ['README_SEO_COMMAND_MISSING', /validate-seo\.mjs/i, 'must expose SEO validation'],
]);
requireText('PLAYBOOK.md', [
  ['PLAYBOOK_STATE_LOOP_MISSING', /BOOT\s*→\s*REHYDRATE\s*→\s*VERIFY\s*→\s*RESUME/i, 'must define resume loop'],
  ['PLAYBOOK_EIGHT_SYSTEMS_MISSING', /all (?:eight|ten|eleven) ExecutionKit systems/i, 'must use all applicable ExecutionKit systems'],
  ['PLAYBOOK_SEO_SECTION_MISSING', /SEO OS — conditional search authority/i, 'must document SEO operation'],
  ['PLAYBOOK_SEO_MIGRATION_MISSING', /migrate-seo-os\.mjs/i, 'must document SEO migration'],
  ['PLAYBOOK_AMNESIA_MISSING', /state-amnesia-test\.mjs/i, 'must include Amnesia command'],
  ['PLAYBOOK_MEMORY_BOUNDARY_MISSING', /ADVISORY_ONLY|advisory/i, 'must keep Memory MCP advisory'],
  ['PLAYBOOK_V3_AGENT_MISSING', /ExecutionKit Agent — optional fleet observability/i, 'must document the per-device Agent'],
  ['PLAYBOOK_V3_BOOTSTRAP_MISSING', /NOT_CONFIGURED/i, 'must document control-plane-independent bootstrap'],
  ['PLAYBOOK_V3_ACTIVITY_SPLIT_MISSING', /HOST_ACTIVE[^\n]{0,120}EXECUTION_ACTIVE|EXECUTION_ACTIVE[^\n]{0,120}HOST_ACTIVE/i, 'must separate host and execution activity'],
]);
requireText('docs/architecture/state-os.md', [
  ['STATE_ARCH_SYSTEM_MISSING', /cross-cutting eighth system|system #8|ten executable systems/i, 'must define State OS system authority'],
  ['STATE_ARCH_AUTHORITY_MISSING', /ADVISORY_ONLY|advisory only/i, 'must keep Memory advisory'],
  ['STATE_ARCH_AMNESIA_MISSING', /Amnesia Test/i, 'must define recovery proof'],
]);
requireText('templates/STATE_OS.md', [
  ['STATE_TEMPLATE_PRINCIPLE_MISSING', /Context is disposable\. Repository state is reconstructable\./i, 'must carry core principle'],
  ['STATE_TEMPLATE_AUTHORITY_MISSING', /sole mutable|only mutable|never owns task/i, 'must preserve canonical task authority'],
  ['STATE_TEMPLATE_AMNESIA_MISSING', /Amnesia Test/i, 'must include Amnesia Test'],
]);
requireText('docs/capabilities/seo-os.md', [
  ['SEO_AUTHORITY_APPLICABILITY_MISSING', /AUTO|applicability/i, 'must define applicability'],
  ['SEO_AUTHORITY_SURFACE_CONTRACT_MISSING', /Search Surface Contract|surface family/i, 'must define search-surface contracts'],
  ['SEO_AUTHORITY_PROGRAMMATIC_MISSING', /fail closed|PROVEN_ONLY/i, 'must define programmatic fail-closed policy'],
  ['SEO_AUTHORITY_RELEASE_BINDING_MISSING', /candidate/i, 'must define candidate-bound release behavior'],
]);
requireText('templates/SEO_OS.md', [
  ['SEO_TEMPLATE_BACKLOG_BOUNDARY_MISSING', /TODO\.md|canonical/i, 'must preserve task authority'],
  ['SEO_TEMPLATE_APPLICABILITY_MISSING', /applicab/i, 'must expose applicability'],
]);
requireText('docs/adoption/universal-adoption.md', [
  ['ADOPTION_SEVEN_CAPABILITIES_MISSING', /seven capability authorities/i, 'must include seven capability authorities'],
  ['ADOPTION_STATE_OS_MISSING', /State OS[^\n]{0,100}(?:system #8|system 8|cross-cutting)/i, 'must include current State OS system number'],
  ['ADOPTION_STATE_TASK_MISSING', /EK00-004S/i, 'must map State deep-integration task'],
  ['ADOPTION_SEO_TASK_MISSING', /EK00-005S/i, 'must map SEO deep-integration task'],
  ['ADOPTION_MEMORY_BOUNDARY_MISSING', /ADVISORY_ONLY/i, 'must keep external memory advisory'],
]);
requireText('docs/adoption/deep-integration.md', [
  ['DEEP_SEVEN_CAPABILITIES_MISSING', /Seven capability authorities \+ State OS/i, 'must include seven capability authorities'],
  ['DEEP_STATE_OS_MISSING', /State OS — cross-cutting system #8|State OS.*system #8/i, 'must include State OS as current system eight'],
  ['DEEP_STATE_TASK_MISSING', /EK00-004S/i, 'must include State integration task'],
  ['DEEP_SEO_TASK_MISSING', /EK00-005S/i, 'must include SEO integration task'],
  ['DEEP_SEO_SECTION_MISSING', /^### SEO OS$/im, 'must include SEO authority section'],
  ['DEEP_AMNESIA_MISSING', /state-amnesia-test\.mjs|Amnesia Test/i, 'must require zero-context proof'],
]);
requireText('templates/TODO.md', [
  ['TODO_STATE_TASK_MISSING', /TASK:EK00-004S/, 'must include canonical State integration task'],
  ['TODO_SEO_TASK_MISSING', /TASK:EK00-005S/, 'must include canonical SEO integration task'],
  ['TODO_SEO_CAPABILITY_MISSING', /\| SEO \|/, 'must include SEO capability matrix row'],
  ['TODO_STATE_AUTHORITY_BOUNDARY_MISSING', /State OS.*(?:derived|non-authoritative|reconstructable)|Context is disposable/i, 'must keep State OS non-authoritative'],
]);
requireText('templates/AGENT_OS.md', [
  ['AGENT_TEMPLATE_DELEGATION_MISSING', /delegation\.mode\s*=\s*(?:DEPENDENCY_SAFE_PARALLEL|SEQUENTIAL)|delegation\.mode\s*=\s*`(?:DEPENDENCY_SAFE_PARALLEL|SEQUENTIAL)`/i, 'must define delegation mode with sequential fallback'],
  ['AGENT_TEMPLATE_DERIVED_MISSING', /derived\s+(?:state|artifacts)/i, 'must keep runtime/discovery/evidence non-authoritative'],
]);
requireText('docs/capabilities/agent-os.md', [
  ['AGENT_CAPABILITY_ORCHESTRATION_MISSING', /(?:DEPENDENCY_SAFE_PARALLEL[\s\S]{0,1000}sequential fallback|orchestration[\s\S]{0,100}SEQUENTIAL)/i, 'must define orchestration mode and sequential fallback'],
  ['AGENT_CAPABILITY_EVIDENCE_MISSING', /candidate\s+identity/i, 'must describe candidate/evidence integration'],
]);
requireText('docs/architecture/v2.2-scope.md', [
  ['V22_SCOPE_COUNT_MISSING', /34\s+v2\.2\s+additions/i, 'must enumerate the historical 34 additions'],
  ['V22_SCOPE_SEQUENTIAL_MISSING', /Runtime\s+execution\s+is\s+sequential/i, 'must forbid a parallel-session operating model'],
]);
requireText('docs/architecture/v3.0-scope.md', [
  ['V30_SCOPE_AGENT_MISSING', /one lightweight deterministic daemon per developer device/i, 'must define the per-device Agent'],
  ['V30_SCOPE_BOOTSTRAP_MISSING', /external control plane is therefore an optional observability\/control integration/i, 'must preserve bootstrap independence'],
  ['V30_SCOPE_REMOTE_CONTROL_MISSING', /Remote control remains disabled/i, 'must preserve read-only protocol v1'],
]);

const forbiddenParallelAuthority = [
  ['STALE_CONTROLLED_PARALLEL_POLICY', /controlled\s+parallel(?:ism|\s+execution)/i, 'must not present controlled parallel execution as current policy'],
  ['STALE_MAX_CONCURRENT_AGENTS', /maxConcurrentAgents/i, 'must not expose concurrent-agent policy in current authority'],
  ['STALE_CONTROLLED_PARALLEL_ENUM', /CONTROLLED_PARALLEL/, 'must not expose the old execution mode'],
];
for (const rel of ['STANDARD.md','STANDARD_V3.md','templates/AGENT_OS.md','docs/capabilities/agent-os.md','templates/TODO.md']) forbidText(rel, forbiddenParallelAuthority);

forbidText('STANDARD.md', [
  ['STANDARD_STATE_SHADOW_BACKLOG', /State OS[^\n]{0,120}(?:owns|is)\s+(?:a\s+)?(?:mutable\s+)?(?:task|backlog|queue)\s+authority/i, 'State OS may not own mutable task/backlog authority'],
]);
forbidText('STANDARD_V3.md', [
  ['STANDARD_V3_CONTROL_PLANE_AUTHORITY', /Elmasna3[^\n]{0,100}(?:owns|is)\s+(?:the\s+)?(?:canonical\s+)?(?:task|backlog|scheduler)\s+authority/i, 'Elmasna3 may not own project task authority'],
  ['STANDARD_V3_SEO_GUARANTEE', /SEO[^\n]{0,80}(?:guarantees?|ensures?)\s+(?:ranking|indexing|traffic|rich result)/i, 'SEO OS must not guarantee external search outcomes'],
]);
forbidText('README.md', [
  ['README_STALE_SIX_CURRENT', /^# Six capability authorities$/im, 'current README may not expose the old six-capability heading'],
  ['README_STALE_SEVEN_SYSTEM_CURRENT', /^## Seven systems, one control plane$/im, 'current README may not expose the old seven-system heading'],
]);
forbidText('PLAYBOOK.md', [
  ['PLAYBOOK_STALE_SEVEN_SYSTEMS', /use all seven ExecutionKit systems/i, 'current playbook must use the configured system model'],
]);

if (errors.length) {
  console.error('Canonical documentation integrity: FAIL');
  console.error(`Files scanned: ${files.length}; errors: ${errors.length}`);
  for (const error of errors) console.error(`  ERROR [${error.code}] ${error.message}`);
  process.exit(1);
}
console.log('Canonical documentation integrity: PASS');
console.log(`Files scanned: ${files.length}; current V5 authority where present and retained V2/V3/V4 compatibility semantics validated. This is documentation evidence only.`);
