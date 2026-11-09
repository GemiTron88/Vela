#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { configuredAdapter, runCommand, writeRaw } from '../lib/external-adapters.mjs';

const root = path.resolve(process.argv[2] ?? '.');
try {
  const findings = [];
  const trackedResult = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', timeout: 30000 });
  if (trackedResult.status !== 0) {
    const evidence = {
      schemaVersion: '1.0.0',
      status: 'NOT_AVAILABLE',
      coverage: 'NONE',
      findings: [{ code: 'GIT_TRACKED_FILE_SCAN_UNAVAILABLE', severity: 'HIGH', message: (trackedResult.stderr || trackedResult.error?.message || 'git ls-files failed').trim() }],
      tools: [],
      observedAt: new Date().toISOString(),
    };
    writeRaw(root, 'security.json', evidence);
    console.log(JSON.stringify(evidence, null, 2));
    process.exit(2);
  }

  const tracked = trackedResult.stdout.split(/\r?\n/).filter(Boolean);
  for (const rel of tracked) if (/(^|\/)\.env($|\.)/i.test(rel) && !/(\.example|\.sample|\.testing)$/i.test(rel)) findings.push({ code: 'TRACKED_ENV_SECRET_RISK', severity: 'HIGH', path: rel });
  for (const rel of ['.env.production', 'config/app.php']) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    const stripped = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replace(/^\s*#.*$/gm, '');
    if (/APP_DEBUG\s*=\s*true|['"]debug['"]\s*=>\s*(?:true|env\s*\(\s*['"]APP_DEBUG['"]\s*,\s*true\s*\))/i.test(stripped)) findings.push({ code: 'PRODUCTION_DEBUG_ENABLED', severity: 'HIGH', path: rel });
  }
  const corsFile = path.join(root, 'config/cors.php');
  if (fs.existsSync(corsFile)) {
    const strippedCors = fs.readFileSync(corsFile, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replace(/^\s*#.*$/gm, '');
    if (/['"]supports_credentials['"]\s*=>\s*true\b/i.test(strippedCors) && /['"]allowed_origins['"]\s*=>\s*\[[^\]]*['"]\*['"]/i.test(strippedCors)) {
      findings.push({ code: 'CORS_WILDCARD_WITH_CREDENTIALS', severity: 'HIGH', path: 'config/cors.php' });
    }
  }

  const cfg = configuredAdapter(root, 'security');
  const tools = [];
  for (const command of cfg.commands ?? []) {
    const result = runCommand(root, command, [], { shell: true, timeoutMs: Number(cfg.timeoutMs ?? 900000) });
    tools.push({ command: result.command, exitCode: result.exitCode });
    if (!result.ok) findings.push({ code: 'SECURITY_TOOL_FAILED', severity: 'HIGH', command: result.command });
  }
  const blocking = findings.filter((f) => f.severity === 'HIGH');
  const evidence = {
    schemaVersion: '1.0.0',
    status: blocking.length ? 'FAIL' : 'PASS',
    coverage: (cfg.commands ?? []).length ? 'BASELINE_PLUS_CONFIGURED_TOOLS' : 'BASELINE_ONLY',
    findings,
    tools,
    observedAt: new Date().toISOString(),
    limits: 'A PASS without configured security commands proves only the built-in tracked-secret/debug baseline, not a comprehensive security audit.',
  };
  writeRaw(root, 'security.json', evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exit(blocking.length ? 1 : 0);
} catch (error) {
  console.error(`Security validation failed: ${error.message}`);
  process.exit(1);
}
