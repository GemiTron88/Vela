#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] || path.join(here, '..'));
const errors = [];
const read = (rel) => {
  const file = path.join(root, rel);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    errors.push(`required documentation file missing: ${rel}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
};
const requireMarkers = (rel, markers) => {
  const value = read(rel);
  for (const marker of markers) if (!value.includes(marker)) errors.push(`${rel} missing retained V3 compatibility marker: ${marker}`);
  return value;
};
const requireMarkersAlt = (rel, markerSets) => {
  const value = read(rel);
  for (const alts of markerSets) {
    const alternatives = alts[0];
    if (!alternatives.some(alt => value.includes(alt))) errors.push(`${rel} missing retained V3 compatibility marker: ${alternatives[0]}`);
  }
  return value;
};

const version = read('VERSION').trim();
let pkg = {};
try { pkg = JSON.parse(read('package.json') || '{}'); }
catch (error) { errors.push(`package.json invalid: ${error.message}`); }

const readme = requireMarkers('README.md', [
  'STANDARD_V3.md',
  'Eight systems, one control plane',
  'SEO OS',
  'EK00-005S',
  'ExecutionKit Agent — 3.0 fleet observability',
  'one lightweight deterministic Node.js Agent per developer device',
  'HOST_ACTIVE',
  'EXECUTION_ACTIVE',
  'Large TODO files are observed through cheap metadata sentinels',
  'Remote control remains disabled',
  'docs/operations/v3-release-validation.md',
]);
requireMarkers('STANDARD_V3.md', [
  'CANONICAL MAJOR-VERSION OVERLAY',
  'exactly **eight systems**',
  'The first seven are capability authorities',
  'SEO OS is a first-class conditional capability authority',
  'Programmatic SEO MUST fail closed',
  'one lightweight deterministic daemon per developer device',
  'Elmasna3 MUST NOT become a required dependency',
  'Remote control remains disabled in protocol v1',
]);
requireMarkersAlt('AGENTS.md', [
  [['seven **capability authorities**','ten executable systems','eleven executable systems']],
  [['State OS as cross-cutting system #8','State OS']],
  [['SEO OS']],
]);
requireMarkersAlt('PLAYBOOK.md', [
  [['all eight ExecutionKit systems','all ten ExecutionKit systems','all eleven ExecutionKit systems']],
  [['SEO OS — conditional search authority']],
  [['ExecutionKit Agent — optional fleet observability']],
  [['Control-plane bootstrap mode']],
  [['Project migration to current 3.x']],
  [['Self-hosted CI and exact-candidate evidence']],
]);
requireMarkers('docs/capabilities/seo-os.md', [
  'CANONICAL',
  'AUTO',
  'Search Surface Contract',
  'PROVEN_ONLY',
]);
requireMarkers('docs/adoption/deep-integration.md', [
  'Seven capability authorities + State OS',
  'EK00-005S',
  '### SEO OS',
  'State OS — cross-cutting system #8',
]);
requireMarkers('templates/TODO.md', [
  'TASK:EK00-004S',
  'TASK:EK00-005S',
  '| SEO |',
  'State OS is system #8',
]);
requireMarkers('docs/architecture/v3.0-scope.md', [
  'Bootstrap and control-plane independence',
  'Resource/network efficiency',
  'Elmasna3 compatibility contract',
]);
requireMarkers('docs/architecture/v3-fleet-protocol.md', [
  'Control-plane optionality',
  'NOT_CONFIGURED',
  '(deviceId, worktreeId)',
]);
requireMarkers('docs/architecture/v3-bootstrap-mode.md', [
  'External fleet observability is never a prerequisite',
  'Elmasna3 dogfood bootstrap',
]);
requireMarkers('docs/operations/v3-release-validation.md', [
  'physical-device certification evidence',
  'project-ai-excutionkit',
  'Distribution publication may precede physical-device certification',
  'Missing physical certification does **not** convert the published distribution into a failed project execution dependency',
]);
requireMarkers('docs/operations/v3-publication-status.md', [
  'Publication and Device Certification Status',
  'distribution publication',
  'physical-device certification',
  'no unexecuted PASS is claimed',
  'Elmasna3 may adopt and execute with ExecutionKit 3.0.0',
]);

if (version.startsWith('5.')) {
  for (const rel of ['README.md','PLAYBOOK.md','AGENTS.md']) {
    const text=read(rel);
    if(!text.includes('STANDARD_V5.md') || !/eleven(?:\*\*)? (?:executable )?(?:ExecutionKit )?systems/i.test(text))
      errors.push(rel+' must identify current V5 authority and eleven systems independently of compatibility history');
  }
  if(!/historical|compatibility/i.test(readme)) errors.push('README must label retained V3 guidance as historical/compatibility');
}

if (pkg.version !== version) errors.push(`VERSION ${version || 'MISSING'} does not match package.json ${pkg.version ?? 'MISSING'}`);

if (version === '2.2.4') {
  if (!readme.includes('Current published version: **2.2.4**')) errors.push('candidate README must identify 2.2.4 as the current published version');
} else if (/^(?:3\.\d+\.\d+|4\.\d+\.\d+|5\.\d+\.\d+(?:-dev)?)$/.test(version)) {
  // A 3.x/4.x/5.x branch may contain compatible current-line work, but publication truth remains explicit in README/TODO.
  if (version === '3.0.0' && !readme.includes('Current published version: **3.0.0**')) errors.push('3.0.0 mode requires README to identify 3.0.0 as current published version');
  const changelog = read('CHANGELOG.md');
  if (version.startsWith('4.')||version.startsWith('5.')) {
    const candidate=changelog.includes(`## ${version} — Unreleased candidate`);
    if(candidate&&!readme.includes(`Current development candidate: **${version}**`)) errors.push(`candidate README must identify ${version} without claiming publication`);
    if(!candidate&&!readme.includes(`Current tagged stable version: **${version}**`)&&!readme.includes(`Current published version: **${version}**`)) errors.push(`published README must identify ${version} as current stable version`);
  }
  if (!changelog.includes(`## ${version}`)) errors.push(`VERSION ${version} requires a matching CHANGELOG entry before the version surface is considered coherent`);
} else {
  errors.push(`unsupported release mode VERSION=${version || 'MISSING'}; expected preserved 2.2.4 or a semantic 3.x/4.x version`);
}

if (readme.includes('## Seven systems, one control plane')) errors.push('README still exposes the stale seven-system current model');
if (read('STANDARD_V3.md').includes('There is no eighth OS')) errors.push('STANDARD_V3.md still contains the stale pre-SEO eighth-system prohibition');
if (read('PLAYBOOK.md').includes('use all seven ExecutionKit systems')) errors.push('PLAYBOOK still tells operators to use only seven systems');

console.log(JSON.stringify({ schemaVersion:'executionkit-v30-docs/v2', version, status:errors.length ? 'FAIL' : 'PASS', errors }, null, 2));
process.exit(errors.length ? 1 : 0);
