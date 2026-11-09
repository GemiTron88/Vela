#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { configuredAdapter, localBin, packageHas, runCommand, writeRaw } from '../lib/external-adapters.mjs';
import { resolveDerivedPath, resolveProjectPathSafe } from '../lib/derived-state.mjs';
import { sha256 } from '../lib/evidence-model.mjs';
import { parsePlaywrightJson, validateAdequacy } from '../lib/test-evidence.mjs';

const root = path.resolve(process.argv[2] ?? '.');
try {
  const cfg = configuredAdapter(root, 'browser');
  const bin = cfg.command ? null : localBin(root, 'playwright');
  if (!cfg.command && !bin) {
    console.log(JSON.stringify({ status: 'NOT_AVAILABLE', tool: 'playwright', message: 'Install explicit ExecutionKit browser tooling or configure adapters.browser.command' }, null, 2));
    process.exit(2);
  }

  const report = resolveDerivedPath(root, '.executionkit/evidence/raw/playwright.json', 'Playwright JSON output', { createParents:true });
  fs.rmSync(report, { force: true });
  const axeFileBefore = cfg.requireAxe === true && cfg.axeEvidencePath ? resolveProjectPathSafe(root, cfg.axeEvidencePath, 'adapters.browser.axeEvidencePath', {file:true}) : null;
  const axeBefore = axeFileBefore && fs.existsSync(axeFileBefore) ? {hash:sha256(axeFileBefore),mtimeMs:fs.statSync(axeFileBefore).mtimeMs} : null;
  const startedAtMs = Date.now();
  const command = cfg.command ?? bin;
  const args = cfg.command ? (cfg.args ?? []) : (cfg.args ?? ['test', '--reporter=json', '--workers=1']);
  const result = runCommand(root, command, args, {
    shell: Boolean(cfg.command),
    timeoutMs: Number(cfg.timeoutMs ?? 1800000),
    env: { ...(cfg.env ?? {}), PLAYWRIGHT_JSON_OUTPUT_FILE: report },
  });

  const errors = [];
  let summary = null;
  if (!result.ok) errors.push({ code: 'BROWSER_SUITE_FAILED', message: `Exit ${result.exitCode}: ${result.error ?? result.stderr.slice(-1000)}` });
  if (!fs.existsSync(report)) errors.push({ code: 'PLAYWRIGHT_REPORT_MISSING', message: 'Current browser run did not produce the required Playwright JSON report' });
  else {
    resolveDerivedPath(root, '.executionkit/evidence/raw/playwright.json', 'Playwright JSON output', { mustExist:true, file:true });
    const stat = fs.statSync(report);
    if (stat.mtimeMs < startedAtMs - 2000) errors.push({ code: 'PLAYWRIGHT_REPORT_STALE', message: 'Playwright JSON report predates the current adapter run' });
    try { summary = parsePlaywrightJson(JSON.parse(fs.readFileSync(report, 'utf8'))); }
    catch (error) { errors.push({ code: 'PLAYWRIGHT_REPORT_INVALID', message: error.message }); }
  }
  if (summary) errors.push(...validateAdequacy(summary, { minimumTests: Number(cfg.minimumTests ?? 1), allowSkipped: Boolean(cfg.allowSkipped), allowFlaky: Boolean(cfg.allowFlaky) }));

  const axePresent = packageHas(root, '@axe-core/playwright');
  let axeEvidence = null;
  if (cfg.requireAxe === true) {
    if (!cfg.axeEvidencePath) errors.push({ code: 'AXE_EVIDENCE_REQUIRED', message: 'requireAxe=true requires adapters.browser.axeEvidencePath from the current browser run; package installation alone is not evidence' });
    else {
      const axeFile = resolveProjectPathSafe(root, cfg.axeEvidencePath, 'adapters.browser.axeEvidencePath', { file:true });
      if (!fs.existsSync(axeFile)) errors.push({ code: 'AXE_EVIDENCE_MISSING', message: cfg.axeEvidencePath });
      else if (fs.statSync(axeFile).mtimeMs < startedAtMs - 2000) errors.push({ code: 'AXE_EVIDENCE_STALE', message: cfg.axeEvidencePath });
      else if (axeBefore && axeBefore.hash === sha256(axeFileBefore) && axeBefore.mtimeMs === fs.statSync(axeFileBefore).mtimeMs) errors.push({code:'AXE_EVIDENCE_STALE',message:'Axe evidence was not refreshed by this run'});
      else {
        const raw = JSON.parse(fs.readFileSync(axeFile,'utf8')), results = Array.isArray(raw) ? raw : raw?.results ?? [raw];
        if (!Array.isArray(results) || !results.length || results.some((r)=>!r || !Array.isArray(r.violations) || !Array.isArray(r.passes) || !Array.isArray(r.incomplete) || r.passes.length+r.violations.length+r.incomplete.length===0)) errors.push({code:'AXE_EVIDENCE_INVALID',message:'Axe evidence requires non-empty scan results with violations, passes and incomplete arrays'});
        else {
          const violations=results.reduce((n,r)=>n+r.violations.length,0), incomplete=results.reduce((n,r)=>n+r.incomplete.length,0);
          if (violations || incomplete) errors.push({code:'AXE_FINDINGS_UNRESOLVED',message:`${violations} violations and ${incomplete} incomplete checks require resolution`});
          axeEvidence={path:cfg.axeEvidencePath,currentRun:true,scanCount:results.length,violations,incomplete,sha256:sha256(axeFile)};
        }
      }
    }
  }

  const evidence = { schemaVersion:'1.0.0', status:errors.length?'FAIL':'PASS', tool:'playwright', command:result.command, summary, axePresent, axeEvidence, visualEvidencePolicy:cfg.visualEvidence??'project-tests', exitCode:result.exitCode, errors, startedAt:new Date(startedAtMs).toISOString(), observedAt:new Date().toISOString() };
  writeRaw(root, 'browser-quality.json', evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exit(errors.length ? 1 : 0);
} catch (error) {
  console.error(`Browser quality validation failed: ${error.message}`);
  process.exit(1);
}
