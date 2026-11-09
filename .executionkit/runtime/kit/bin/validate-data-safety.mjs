#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { writeRaw } from '../lib/external-adapters.mjs';

const root = path.resolve(process.argv[2] ?? '.');
const strict = process.argv.includes('--strict');

function normalizePhpMigration(text) {
  return String(text)
    // Dynamic method-call syntax is semantically identical and must not bypass scanning.
    .replace(/->\s*\{\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\}\s*\(/g, '->$1(')
    // Collapse Laravel Schema connection selectors for destructive-operation detection.
    .replace(/Schema::connection\s*\([^;\n]*?\)\s*->\s*/g, 'Schema::');
}

function methodBody(text, name) {
  const re = new RegExp(String.raw`(?:public\s+|protected\s+|private\s+)?function\s+${name}\s*\([^)]*\)[^{]*\{`, 'm');
  const match = re.exec(text);
  if (!match) return null;
  const open = text.indexOf('{', match.index);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') {
      const nl = text.indexOf('\n', i + 2);
      if (nl < 0) break;
      i = nl;
      continue;
    }
    if (ch === '#') {
      const nl = text.indexOf('\n', i + 1);
      if (nl < 0) break;
      i = nl;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end < 0) break;
      i = end + 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return text.slice(open + 1);
}

const PATTERNS = [
  ['DROP_TABLE', /Schema::drop(?:IfExists)?\s*\(/g],
  ['DROP_COLUMN', /->dropColumn\s*\(/g],
  ['DELETE_DATA', /->delete\s*\(/g],
  ['RAW_DESTRUCTIVE_SQL', /\b(?:DROP|TRUNCATE)\s+(?:TABLE|COLUMN)\b|\bDELETE\s+FROM\b/gi],
  ['UNSAFE_RENAME', /->renameColumn\s*\(/g],
];

function scanSegment(segment, direction, rel) {
  const findings = [];
  if (!segment) return findings;
  const normalized = normalizePhpMigration(segment);
  for (const [code, re] of PATTERNS) {
    re.lastIndex = 0;
    if (!re.test(normalized)) continue;
    const blockingDirection = direction === 'up' || direction === 'unknown';
    const severity = strict && blockingDirection ? 'HIGH' : 'REVIEW';
    findings.push({
      code,
      severity,
      direction,
      path: rel,
      rationale: direction === 'down'
        ? 'Rollback/down migrations may legitimately reverse schema changes; review rollback/backup policy but do not treat historical down() code as current release mutation.'
        : 'Forward/unknown migration path contains a destructive or compatibility-sensitive operation and requires explicit current-candidate migration safety evidence before release.',
    });
  }
  return findings;
}

try {
  const findings = [], migrationFiles = [];
  const dirs = ['database/migrations', 'prisma/migrations', 'drizzle'];
  for (const dir of dirs) {
    const base = path.join(root, dir);
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base)) {
      const candidate = path.join(base, name);
      const stat = fs.statSync(candidate);
      const filesToScan = [];
      if (stat.isFile() && /\.(?:php|sql)$/i.test(name)) {
        filesToScan.push({ file: candidate, rel: `${dir}/${name}` });
      } else if (stat.isDirectory()) {
        for (const sub of fs.readdirSync(candidate)) {
          const subFile = path.join(candidate, sub);
          if (/\.(?:php|sql)$/i.test(sub) && fs.statSync(subFile).isFile()) {
            filesToScan.push({ file: subFile, rel: `${dir}/${name}/${sub}` });
          }
        }
      }
      for (const { file, rel } of filesToScan) {
        migrationFiles.push(rel);
        const text = fs.readFileSync(file, 'utf8');
        const up = methodBody(text, 'up');
        const down = methodBody(text, 'down');

        findings.push(...scanSegment(up, 'up', rel));
        findings.push(...scanSegment(down, 'down', rel));

        // If we cannot split a file that still contains destructive migration operations,
        // fail closed in strict mode instead of letting unusual syntax bypass the gate.
        if (up === null && down === null) {
          findings.push(...scanSegment(text, 'unknown', rel));
        }
      }
    }
  }

  if (!migrationFiles.length) {
    const evidence = { schemaVersion: '1.1.0', status: 'NOT_APPLICABLE', migrationFiles: 0, findings: [], observedAt: new Date().toISOString(), limits: 'No supported database/migrations surface was discovered.' };
    writeRaw(root, 'data-safety.json', evidence);
    console.log(JSON.stringify(evidence, null, 2));
    process.exit(0);
  }

  const errors = findings.filter((f) => f.severity === 'HIGH');
  const evidence = {
    schemaVersion: '1.1.0',
    status: errors.length ? 'FAIL' : findings.length ? 'REVIEW_REQUIRED' : 'PASS',
    migrationFiles: migrationFiles.length,
    findings,
    policy: 'Strict release blocking applies to destructive/compatibility-sensitive forward or unknown migration paths. down() rollback code remains review evidence and requires project-specific backup/rollback policy rather than automatic failure.',
    evasionResistance: 'Laravel Schema::connection(...) selectors and dynamic method syntax are normalized before matching.',
    observedAt: new Date().toISOString(),
  };
  writeRaw(root, 'data-safety.json', evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exit(errors.length ? 1 : 0);
} catch (error) {
  console.error(`Data safety validation failed: ${error.message}`);
  process.exit(1);
}
