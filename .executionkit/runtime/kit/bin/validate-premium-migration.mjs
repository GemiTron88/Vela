#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const errors = [];
const fail = (code, message) => errors.push({ code, message });
const file = (rel) => path.join(root, rel);
const read = (rel) => {
  const full = file(rel);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    fail('PREMIUM_MIGRATION_FILE_MISSING', rel);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
};
const requirePattern = (rel, pattern, description) => {
  const text = read(rel);
  if (text && !pattern.test(text)) fail('PREMIUM_MIGRATION_GUARD_MISSING', `${rel}: ${description}`);
};

for (const rel of ['bin/migrate-current.mjs','bin/migrate-premium-experience.mjs','bin/migrate-v3.mjs','bin/migrate-v2.mjs','bin/adopt-project.mjs','tests/migration.test.mjs','tests/premium-experience.test.mjs']) read(rel);

requirePattern('bin/migrate-current.mjs', /baseMigration\s*=.*migrate-v3\.mjs/s, 'current 3.x migration must route through the v3 layer');
requirePattern('bin/migrate-current.mjs', /migrate-seo-os\.mjs[\s\S]*migrate-premium-experience\.mjs/, 'current migration must compose SEO then Premium overlays after the base layer');
requirePattern('bin/migrate-current.mjs', /premiumExperienceIsOperatingSystem:\s*false/, 'current migration must preserve the non-OS Premium boundary');

requirePattern('bin/migrate-v3.mjs', /Object\.hasOwn\(migratedConfig, ['"]premiumExperience['"]\)/, 'v3 migration must distinguish an existing Premium decision from an absent one');
requirePattern('bin/migrate-v3.mjs', /applicability:\s*['"]UNRESOLVED['"][\s\S]*qualityProfile:\s*['"]UNRESOLVED['"]/, 'absent Premium applicability must initialize fail-closed instead of guessing UI/non-UI truth');
requirePattern('bin/migrate-v3.mjs', /premiumExperienceMigrationPolicy:\s*['"]preserve-existing-or-initialize-unresolved['"]/, 'v3 migration report must expose its preservation policy');

requirePattern('bin/migrate-v2.mjs', /['"]bin\/configure-quality\.mjs['"]/, 'base migration must distribute the project-local quality configurator');
requirePattern('bin/migrate-v2.mjs', /['"]lib\/quality-model\.mjs['"]/, 'base migration must distribute the quality runtime');
requirePattern('bin/migrate-v2.mjs', /['"]schemas\/quality-contract\.schema\.json['"]/, 'base migration must distribute the quality contract schema');
requirePattern('bin/adopt-project.mjs', /templates\/\.agents/, 'Agent adoption must source the managed Agent template tree that contains Premium routing/skills');

requirePattern('bin/migrate-premium-experience.mjs', /preservesExistingQualityContract/, 'Premium overlay must report preservation of an existing project quality contract');
requirePattern('bin/migrate-premium-experience.mjs', /preservesExistingPremiumDecision/, 'Premium overlay must report preservation of an existing applicability decision');
requirePattern('bin/migrate-premium-experience.mjs', /preservesNativeAgentResources:\s*true/, 'Premium overlay must preserve native Agent resources');
requirePattern('bin/migrate-premium-experience.mjs', /--replace-managed-tooling/, 'managed Premium conflicts must require explicit replacement authorization');
requirePattern('bin/migrate-premium-experience.mjs', /Managed Premium Experience conflict/, 'managed conflicts must fail closed rather than silently overwrite project changes');
requirePattern('bin/migrate-premium-experience.mjs', /applicability:'UNRESOLVED'/, 'missing Premium applicability must remain unresolved rather than guessed');
requirePattern('bin/migrate-premium-experience.mjs', /skill\.premium-experience[\s\S]*skill\.component-system[\s\S]*skill\.design-system/, 'Premium overlay must distribute the governed UI skill chain');
requirePattern('bin/migrate-premium-experience.mjs', /hash\(todoPath\)\s*!==\s*todoHash/, 'Premium overlay must byte-protect canonical TODO');
requirePattern('bin/migrate-premium-experience.mjs', /validate-agents\.mjs/, 'Premium overlay must validate the reconciled Agent layer');

requirePattern('tests/migration.test.mjs', /premiumExperienceMigrationPolicy/, 'migration regression must assert the v3 Premium migration policy');
requirePattern('tests/migration.test.mjs', /nativePremiumContract/, 'migration regression must prove an existing native quality contract is preserved');
requirePattern('tests/migration.test.mjs', /\.agents\/skills\/premium-experience\/SKILL\.md/, 'migration regression must prove the Premium Agent skill reaches the migrated project');
requirePattern('tests/premium-experience.test.mjs', /migrate-premium-experience\.mjs/, 'Premium distribution regression must inspect the dedicated migration overlay');

if (errors.length) {
  console.error(`Premium migration distribution: FAIL (${errors.length} finding${errors.length === 1 ? '' : 's'})`);
  for (const error of errors) console.error(`[${error.code}] ${error.message}`);
  process.exit(1);
}
console.log('Premium migration distribution: PASS (static migration/preservation coherence only; no migrated project suite, rendered UI acceptance or release certification was executed).');
