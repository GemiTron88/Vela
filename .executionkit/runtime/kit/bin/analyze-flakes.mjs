#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
try {
  const base = path.join(root, '.executionkit', 'evidence'), events = [];
  if (fs.existsSync(base)) for (const candidate of fs.readdirSync(base)) {
    const dir = path.join(base, candidate);
    if (!fs.statSync(dir).isDirectory() || candidate === 'raw') continue;
    for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
      try {
        const report = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
        if (report.kind === 'test' || /test|playwright|flutter/i.test(report.producer ?? report.kind ?? '')) events.push(report);
      } catch {}
    }
  }

  const by = new Map();
  for (const report of events) {
    const key = report.producer ?? 'unknown';
    const value = by.get(key) ?? { producer: key, runs: 0, failures: 0, passes: 0, flakySignals: 0 };
    value.runs++;
    if (report.result === 'PASS') value.passes++;
    else value.failures++;
    if (/flaky|retry/i.test(`${report.stdout ?? ''}\n${report.stderr ?? ''}`)) value.flakySignals++;
    by.set(key, value);
  }

  const producers = [...by.values()];
  const status = !events.length ? 'NOT_ENOUGH_DATA' : producers.some((value) => value.flakySignals || (value.failures && value.passes)) ? 'REVIEW_REQUIRED' : 'PASS';
  console.log(JSON.stringify({ schemaVersion: '1.0.0', eventCount: events.length, producers, status, limits: status === 'NOT_ENOUGH_DATA' ? 'No candidate-bound test history exists yet; flake absence is not proven.' : undefined }, null, 2));
} catch (error) {
  console.error(`Flake analysis failed: ${error.message}`);
  process.exit(1);
}
