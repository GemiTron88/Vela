#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from '../lib/evidence-model.mjs';
import { resolveProjectPathSafe } from '../lib/derived-state.mjs';
import { configuredAdapter, localBin, runCommand, writeRaw } from '../lib/external-adapters.mjs';
import {loadConfig} from '../lib/execution-model.mjs';
import {validateMobileLighthouse,lighthouseSourceIdentity} from '../lib/lighthouse-gate.mjs';

const root = path.resolve(process.argv[2] ?? '.');
function currentLhrs(dir, startedAtMs, before) {
  if (!fs.existsSync(dir)) return [];
  let representativeFiles = null;
  const manifestPath = path.join(dir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      if (fs.statSync(manifestPath).mtimeMs >= startedAtMs - 2000) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (Array.isArray(manifest) && manifest.some((entry) => entry && typeof entry === 'object' && 'isRepresentativeRun' in entry)) {
          representativeFiles = new Set(manifest.filter((entry) => entry?.isRepresentativeRun !== false && typeof entry?.jsonPath === 'string').map((entry) => path.basename(entry.jsonPath)));
        }
      }
    } catch {}
  }
  const out = [];
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.json') && n !== 'manifest.json')) {
    if (representativeFiles && representativeFiles.size > 0 && !representativeFiles.has(name)) continue;
    const file = resolveProjectPathSafe(root, `.lighthouseci/${name}`, 'Lighthouse report', {file:true});
    try {
      const mtimeMs = fs.statSync(file).mtimeMs, hash=sha256(file);
      if (mtimeMs < startedAtMs - 2000 || (before.get(name)?.hash===hash && before.get(name)?.mtimeMs===mtimeMs)) continue;
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (parsed?.categories) out.push({...parsed,_proof:{path:'.lighthouseci/'+name,sha256:hash}});
    } catch {}
  }
  return out;
}

try {
  const cfg = configuredAdapter(root, 'seo-performance');
  const bin = cfg.command ? null : localBin(root, 'lhci');
  if (!cfg.command && !bin) {
    console.log(JSON.stringify({ status: 'NOT_AVAILABLE', tool: 'lhci', message: 'Install explicit ExecutionKit browser tooling or configure adapters.seo-performance.command' }, null, 2));
    process.exit(2);
  }
  const command = cfg.command ?? bin;
  const args = cfg.command ? (cfg.args ?? []) : (cfg.args ?? ['autorun', ...(cfg.config ? ['--config', cfg.config] : [])]);
  const dir = resolveProjectPathSafe(root,'.lighthouseci','Lighthouse output'), before=new Map();
  if(fs.existsSync(dir)) for(const name of fs.readdirSync(dir).filter((n)=>n.endsWith('.json'))) { const file=resolveProjectPathSafe(root,`.lighthouseci/${name}`,'Lighthouse report',{file:true});before.set(name,{hash:sha256(file),mtimeMs:fs.statSync(file).mtimeMs}); }
  const startedAtMs = Date.now();
  const result = runCommand(root, command, args, { shell: Boolean(cfg.command), timeoutMs: Number(cfg.timeoutMs ?? 1800000), env: cfg.env ?? {} });
  const reports = currentLhrs(dir, startedAtMs, before);
  const errors = [];
  if (!result.ok) errors.push({ code: 'LHCI_FAILED', message: `Exit ${result.exitCode}: ${result.error ?? result.stderr.slice(-1000)}` });
  if ((cfg.requireReports !== false || Object.keys(cfg.minimumScores ?? {}).length) && !reports.length) errors.push({ code: 'LHCI_REPORT_MISSING', message: 'No current-run Lighthouse result JSON found under .lighthouseci' });
  const minimum = cfg.minimumScores ?? {};
  if (!minimum || typeof minimum!=='object' || Array.isArray(minimum) || Object.values(minimum).some((n)=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>100)) errors.push({code:'LIGHTHOUSE_BUDGET_INVALID',message:'minimumScores must contain finite numeric scores from 0 to 100'});
  for (const report of reports) for (const [category, min] of Object.entries(minimum)) {
    const score = report.categories?.[category]?.score;
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1 || score * 100 < Number(min)) errors.push({ code: 'LIGHTHOUSE_BUDGET_FAILED', message: `${category} ${typeof score === 'number' ? Math.round(score * 100) : 'missing'} < ${min}`, url: report.finalDisplayedUrl ?? report.finalUrl ?? null });
  }
  const strict=/^[45]\./.test(String(loadConfig(root).config.standardVersion));
  const mobileGate=strict?validateMobileLighthouse(reports,{urls:cfg.urls,startedAtMs}):null;
  if(mobileGate)errors.push(...mobileGate.errors);
  const source=strict?lighthouseSourceIdentity(root):null;
  const evidence = {
    schemaVersion: '1.0.0',
    status: errors.length ? 'FAIL' : 'PASS',
    tool: 'lighthouse-ci',
    command: result.command,
    reportCount: reports.length,
    minimumScores: minimum,
    mobileGate,
    source,
    reports:reports.map(report=>report._proof),
    inlineReports:reports,
    errors,
    startedAt: new Date(startedAtMs).toISOString(),
    observedAt: new Date().toISOString(),
  };
  writeRaw(root, 'seo-performance.json', evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exit(errors.length ? 1 : 0);
} catch (error) {
  console.error(`SEO/performance validation failed: ${error.message}`);
  process.exit(1);
}
