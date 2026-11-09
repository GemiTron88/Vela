#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../lib/execution-model.mjs';
import { projectFile } from '../lib/quality-model.mjs';

const args = process.argv.slice(2), root = path.resolve(args.find((a) => !a.startsWith('--')) ?? '.');
const here = path.dirname(fileURLToPath(import.meta.url));
const kitRoot = path.resolve(here, '..');
const arg = (name, fallback = '') => {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for --${name}`);
  return value;
};
const PREMIUM_STARTER = {
  schemaVersion: '1.1.0',
  profile: 'premium',
  sourcePaths: [],
  premiumPolicy: {
    designAuthorityPaths: [],
    referencePaths: [],
    componentContractPath: 'executionkit.components.json',
    designContractPath: 'executionkit.design.json',
    singleTokenAuthority: true,
    extendBeforeCreate: true,
    rawPrimitiveBypass: 'forbid-when-covered',
    legacyDebtPolicy: 'shrink-only',
    renderedReviewRequired: true,
    productionShapedDataRequired: true,
    antiGenericReviewRequired: true,
    requiredStates: ['loading','skeleton','empty','error','success','disabled','permission','degraded','offline','retry','conflict'],
    requiredFormFactors: ['mobile','tablet','desktop'],
    requiredDirections: ['rtl','ltr'],
    requiredInputModes: ['touch','mouse','keyboard','screen-reader'],
    supportedThemes: ['light','dark','system'],
    platformNotes: 'Reconcile this starter against the real product. Remove inapplicable directions/themes/states only when repository truth supports that decision; populate canonical designAuthorityPaths and real subjects/requirements before acceptance.',
  },
  subjects: [],
  requirements: [],
  evidencePath: 'docs/quality/evidence.json',
};

try {
  const { source } = loadConfig(root);
  if (!source) throw new Error('Adopt ExecutionKit before configuring product quality');
  const raw = fs.readFileSync(source, 'utf8'), config = JSON.parse(raw);
  if (Object.hasOwn(config, 'quality')) throw new Error('Quality already configured; reconcile the existing contract instead of creating another');
  const relative = 'docs/quality/contract.json', file = projectFile(root, relative);
  if (fs.existsSync(file)) throw new Error('Existing contract found; inspect and register it explicitly without overwriting');

  const standard = args.includes('--standard');
  const nonUiReason = arg('non-ui-reason', '').trim();
  if (standard && !nonUiReason) throw new Error('--standard is reserved for products with no user-facing UI and requires --non-ui-reason "<evidence-backed reason>". UI-bearing projects must use Premium Experience 1.1.');
  if (!standard && args.includes('--non-ui-reason')) throw new Error('--non-ui-reason is valid only with --standard');

  let contract;
  if (standard) {
    contract = { schemaVersion: '1.0.0', profile: 'standard', sourcePaths: [], subjects: [], requirements: [], evidencePath: 'docs/quality/evidence.json' };
  } else {
    const templatePath = path.join(kitRoot, 'templates/quality.contract.json');
    if (fs.existsSync(templatePath)) {
      contract = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
      if (JSON.stringify(contract) !== JSON.stringify(PREMIUM_STARTER)) throw new Error('Premium quality template drifted from the self-contained managed starter');
    } else {
      contract = structuredClone(PREMIUM_STARTER);
    }
    if (contract.schemaVersion !== '1.1.0' || contract.profile !== 'premium') throw new Error('Premium quality starter is not the expected fail-closed 1.1.0 profile');
  }

  const premiumDocRel = 'docs/quality/premium-experience.md';
  const premiumDoc = projectFile(root, premiumDocRel);
  let createdPremiumDoc = false;
  if (args.includes('--apply')) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(contract, null, 2) + '\n');
      config.quality = { contractPath: relative };
      config.premiumExperience = {
        applicability: standard ? 'NOT_APPLICABLE' : 'REQUIRED',
        qualityProfile: contract.profile,
        notApplicableReason: standard ? nonUiReason : '',
      };
      config.projectState = 'BOOTSTRAP';
      fs.writeFileSync(source, JSON.stringify(config, null, 2) + '\n');

      if (!standard && !fs.existsSync(premiumDoc)) {
        const skill = projectFile(root, '.agents/skills/premium-experience/SKILL.md');
        if (!fs.existsSync(skill)) throw new Error('Premium Experience Agent skill is missing; cannot create the project-local Premium contract mirror');
        const skillText = fs.readFileSync(skill, 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n+/, '');
        fs.writeFileSync(premiumDoc, `<!-- Generated from the managed Premium Experience Agent protocol; preserve stronger project-native authorities. -->\n\n${skillText}`);
        createdPremiumDoc = true;
      }
    } catch (error) {
      fs.writeFileSync(source, raw);
      fs.rmSync(file, { force: true });
      if (createdPremiumDoc) fs.rmSync(premiumDoc, { force: true });
      throw error;
    }
  }
  console.log(JSON.stringify({
    apply: args.includes('--apply'),
    profile: contract.profile,
    schemaVersion: contract.schemaVersion,
    contractPath: relative,
    premiumExperienceApplicability: standard ? 'NOT_APPLICABLE' : 'REQUIRED',
    nonUiReason: standard ? nonUiReason : null,
    projectState: 'BOOTSTRAP',
    selfContainedStarter: !standard,
    projectLocalPremiumContract: !standard ? premiumDocRel : null,
    note: standard
      ? 'Standard quality is allowed only for an evidence-backed non-UI product. Reconcile real API/content/journey subjects, source files and TODO IDs before acceptance.'
      : 'Premium 1.1 is mandatory for UI-bearing scope and deliberately fail-closed. Reconcile canonical designAuthorityPaths, component/design contracts, supported states/form-factors/directions/input modes, real subjects/requirements, source files and TODO IDs before acceptance. No task state is changed.',
  }, null, 2));
} catch (error) { console.error(error.message); process.exit(1); }
