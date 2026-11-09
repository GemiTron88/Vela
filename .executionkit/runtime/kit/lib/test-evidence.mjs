import fs from 'node:fs';

const count = (value) => Number.isSafeInteger(value) && value >= 0;
const empty = (format) => ({ format, tests:0, pass:0, fail:0, skipped:0, flaky:0, errors:[] });

export function parseTap(text) {
  const out = empty('tap'), scopes = [{ indent:0, points:[], plans:[] }], leaves = [];
  let allPoints = 0, childClosed = false, todoPoints = 0;
  const finish = () => {
    const scope = scopes.pop();
    if (scope.plans.length > 1 || (scope.plans.length && scope.plans[0] !== scope.points.length)) out.errors.push('TAP plan does not match completed test points');
    scope.points.forEach((point, i) => { if (point.number !== null && point.number !== i + 1) out.errors.push('TAP test numbering is incomplete or duplicated'); });
  };
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*Bail out!/i.test(line)) out.errors.push('TAP run bailed out');
    const point = line.match(/^( *)(not ok|ok)\b(?:\s+(\d+)\b)?(.*)$/);
    const plan = line.match(/^( *)1\.\.(\d+)(?:\s*#.*)?\s*$/);
    if (!point && !plan) continue;
    const indent = (point ?? plan)[1].length;
    while (scopes.length > 1 && scopes.at(-1).indent > indent) { finish(); childClosed = true; }
    if (scopes.at(-1).indent < indent) scopes.push({ indent, points:[], plans:[] });
    if (plan) { scopes.at(-1).plans.push(Number(plan[2])); continue; }
    const isTodo = /#\s*TODO\b/i.test(point[4]);
    if (isTodo) todoPoints++;
    const result = /#\s*(SKIP|TODO)\b/i.test(point[4]) ? 'skipped' : point[2] === 'not ok' ? 'fail' : 'pass';
    scopes.at(-1).points.push({ number:point[3] ? Number(point[3]) : null }); allPoints++;
    if (!childClosed) leaves.push(result);
    else if (result !== 'pass' && !isTodo) out.errors.push('TAP parent subtest did not pass');
    childClosed = false;
  }
  while (scopes.length) finish();
  for (const result of leaves) out[result]++;
  const stat = (name) => [...text.matchAll(new RegExp(`^#\\s*${name}\\s+(\\d+)\\s*$`, 'gmi'))].map((m) => Number(m[1])).at(-1);
  const declared = stat('tests');
  out.tests = declared ?? leaves.length;
  if (declared !== undefined && (declared < leaves.length || declared > allPoints)) out.errors.push('TAP summary has no matching completed test points');
  // Node may count parent tests as well as children, but a summary cannot hide observed failures/skips.
  const failStat = stat('fail');
  if (failStat !== undefined && failStat < out.fail) out.errors.push('TAP summary hides fail');
  out.fail = Math.max(out.fail, failStat ?? 0);
  const skippedStat = stat('skipped'), todoStat = stat('todo');
  if (skippedStat !== undefined && (skippedStat + (todoStat ?? 0)) < out.skipped) out.errors.push('TAP summary hides skipped');
  out.skipped = Math.max(out.skipped, (skippedStat ?? 0) + (todoStat ?? 0));
  if ((stat('cancelled') ?? 0) > 0 || (todoStat ?? 0) > 0 || todoPoints > 0) out.errors.push('TAP run contains cancelled or TODO tests');
  out.pass = Math.max(0, out.tests - out.fail - out.skipped);
  if (stat('pass') !== undefined && stat('pass') !== out.pass) out.errors.push('TAP pass count is inconsistent');
  return out;
}

// Small, non-expanding XML reader for JUnit result structure. DTDs/entities are never executed.
export function parseJUnit(text) {
  const out = empty('junit'), document = { name:'#document', attrs:{}, children:[] }, stack = [document];
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) { out.errors.push('JUnit DTD/entity declarations are unsupported'); return out; }
  const xml = text.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>/g, '');
  const tokens = xml.match(/<[^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>|[^<]+/g) ?? [];
  if (tokens.join('') !== xml) out.errors.push('Malformed JUnit XML');
  for (const token of tokens) {
    if (!token.startsWith('<')) continue;
    const close = token.match(/^<\/([\w:.-]+)\s*>$/);
    if (close) { if (stack.length === 1 || stack.at(-1).name !== close[1]) out.errors.push('Unbalanced JUnit XML'); else stack.pop(); continue; }
    const open = token.match(/^<([\w:.-]+)\b([\s\S]*?)(\/?)>$/);
    if (!open) { out.errors.push('Malformed JUnit element'); continue; }
    const attrs = {}, rest = open[2].replace(/\s+([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, (_, key, a, b) => { if (Object.hasOwn(attrs,key)) out.errors.push('Duplicate JUnit attribute'); attrs[key] = a ?? b; return ''; });
    if (rest.trim()) out.errors.push('Malformed JUnit attributes');
    const node = { name:open[1], attrs, children:[] }; stack.at(-1).children.push(node); if (!open[3]) stack.push(node);
  }
  if (stack.length !== 1 || document.children.length !== 1 || !['testsuites','testsuite'].includes(document.children[0]?.name)) out.errors.push('Incomplete JUnit document');
  const visit = (node) => {
    let totals = { tests:0, fail:0, skipped:0 };
    if (node.name === 'testcase') { totals.tests = 1; if (node.children.some((n) => ['failure','error'].includes(n.name))) totals.fail = 1; else if (node.children.some((n) => n.name === 'skipped')) totals.skipped = 1; }
    else for (const child of node.children) { const sub = visit(child); for (const key of Object.keys(totals)) totals[key] += sub[key]; }
    if (['testsuite','testsuites'].includes(node.name)) {
      for (const key of ['tests','failures','errors','skipped']) if (node.attrs[key] !== undefined && !/^\d+$/.test(node.attrs[key])) out.errors.push(`Invalid JUnit ${key}`);
      for (const [attr,key] of [['tests','tests'],['skipped','skipped']]) if (node.attrs[attr] !== undefined && Number(node.attrs[attr]) !== totals[key]) out.errors.push(`JUnit ${attr} does not match test cases`);
      const declaredFailures = Number(node.attrs.failures ?? 0) + Number(node.attrs.errors ?? 0);
      if ((node.attrs.failures !== undefined || node.attrs.errors !== undefined) && declaredFailures !== totals.fail) out.errors.push('JUnit failures/errors do not match test cases');
      if (!totals.tests && Number(node.attrs.tests) > 0) { totals = { tests:Number(node.attrs.tests), fail:declaredFailures, skipped:Number(node.attrs.skipped ?? 0) }; out.errors.push('JUnit contains counters without test cases'); }
    }
    return totals;
  };
  Object.assign(out, visit(document)); out.pass = Math.max(0, out.tests - out.fail - out.skipped); return out;
}

export function parsePlaywrightJson(value) {
  const out = empty('playwright-json');
  if (!value || typeof value !== 'object' || Array.isArray(value)) { out.errors.push('Playwright report must be an object'); return out; }
  if (value.errors !== undefined && (!Array.isArray(value.errors) || value.errors.length)) out.errors.push('Playwright run contains global errors');
  const walk = (suite) => {
    if (!suite || typeof suite !== 'object' || (suite.specs !== undefined && !Array.isArray(suite.specs)) || (suite.suites !== undefined && !Array.isArray(suite.suites))) { out.errors.push('Invalid Playwright suite'); return; }
    for (const spec of suite.specs ?? []) {
      if (!Array.isArray(spec?.tests) || !spec.tests.length) { out.errors.push('Playwright spec has no test results'); continue; }
      for (const test of spec.tests) {
        out.tests++;
        const results = Array.isArray(test?.results) ? test.results : [], final = results.at(-1), expected = test?.expectedStatus ?? 'passed';
        if (test?.status === 'skipped' || final?.status === 'skipped') out.skipped++;
        else if (!final || !['passed','failed','timedOut','interrupted'].includes(final.status)) { out.fail++; out.errors.push('Playwright test has no completed result'); }
        else if (test.status === 'unexpected' || final.status !== expected) out.fail++;
        else out.pass++;
        if (test?.status === 'flaky' || (results.length > 1 && final?.status === expected && results.some((r) => r.status !== expected))) out.flaky++;
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  if (value.suites === undefined) out.errors.push('Playwright report has no suites array — this may be an aggregate-only or custom reporter output');
  else if (!Array.isArray(value.suites)) out.errors.push('Playwright suites field exists but is not an array (type: ' + typeof value.suites + ')');
  else for (const suite of value.suites) walk(suite);
  if (!out.tests && value.stats) {
    // Retain failed/skipped/flaky counters for diagnostics; aggregate-only reports cannot prove execution.
    const stats = value.stats;
    out.fail = stats.unexpected ?? 0; out.skipped = stats.skipped ?? 0; out.flaky = stats.flaky ?? 0;
    out.pass = (stats.expected ?? 0) + out.flaky; out.tests = out.pass + out.fail + out.skipped;
    out.errors.push('Playwright statistics have no completed test records');
  } else if (value.stats) {
    const stats = value.stats;
    if (!['expected','unexpected','skipped','flaky'].every((k) => count(stats[k])) || stats.expected + stats.unexpected + stats.skipped + stats.flaky !== out.tests || stats.unexpected !== out.fail || stats.skipped !== out.skipped || stats.flaky !== out.flaky) out.errors.push('Playwright statistics disagree with test results');
  }
  return out;
}

export function parseFlutterMachine(text) {
  const out = empty('flutter-machine'), started = new Map(), completed = new Set(); let done = false;
  for (const line of text.split(/\r?\n/).filter((line) => line.trim())) {
    let event; try { event = JSON.parse(line); } catch { out.errors.push('Invalid Flutter machine JSON'); continue; }
    if (done) out.errors.push('Flutter event after completion');
    if (event?.type === 'error') out.errors.push('Flutter test emitted an uncaught error (including errors after testDone)');
    if (event?.type === 'testStart') {
      const id = event.test?.id;
      if (!Number.isInteger(id) || started.has(id)) out.errors.push('Invalid or duplicate Flutter test id'); else started.set(id, event.test);
    }
    if (event?.type === 'testDone') {
      if (!started.has(event.testID) || completed.has(event.testID)) { out.errors.push('Unmatched Flutter test completion'); continue; }
      completed.add(event.testID);
      if (event.hidden === true) { if (event.result !== 'success') out.errors.push('Flutter hidden/loading test failed'); continue; }
      out.tests++;
      if (event.skipped === true) out.skipped++; else if (event.result === 'success') out.pass++; else out.fail++;
    }
    if (event?.type === 'done') { done = true; if (event.success !== true) out.errors.push('Flutter run did not finish successfully'); }
  }
  if (!done || started.size !== completed.size) out.errors.push('Flutter run is incomplete');
  return out;
}

export function parseTestReport(file, format = null) {
  const raw = fs.readFileSync(file, 'utf8'), kind = format ?? (file.endsWith('.xml') ? 'junit' : file.endsWith('.json') ? 'playwright-json' : 'tap');
  if (kind === 'junit') return parseJUnit(raw);
  if (kind === 'playwright-json') return parsePlaywrightJson(JSON.parse(raw));
  if (kind === 'flutter-machine') return parseFlutterMachine(raw);
  if (kind === 'tap') return parseTap(raw);
  throw new Error(`Unsupported test report format: ${kind}`);
}
export function validateAdequacy(summary, policy = {}) {
  const errors = [];
  if (!summary || !['tests','pass','fail','skipped','flaky'].every((key) => count(summary[key])) || summary.pass + summary.fail + summary.skipped !== summary.tests || summary.flaky > summary.tests) return [{ code:'INVALID_TEST_SUMMARY', message:'Test counts must be non-negative integers with consistent accounting' }];
  for (const message of summary.errors ?? []) errors.push({ code:'INVALID_TEST_REPORT', message });
  if (!summary.tests || summary.tests === summary.skipped) errors.push({ code:'ZERO_TESTS', message:'No applicable tests executed' });
  if (summary.fail) errors.push({ code:'TEST_FAILURES', message:`${summary.fail} tests failed` });
  if (policy.allowSkipped !== true && summary.skipped) errors.push({ code:'REQUIRED_SKIPS', message:`${summary.skipped} tests skipped` });
  if (policy.allowFlaky !== true && summary.flaky) errors.push({ code:'FLAKY_TESTS', message:`${summary.flaky} tests passed only after retries` });
  if (policy.minimumTests !== undefined && !count(policy.minimumTests)) errors.push({ code:'INVALID_TEST_POLICY', message:'minimumTests must be a non-negative integer' });
  else if (summary.tests - summary.skipped < (policy.minimumTests ?? 0)) errors.push({ code:'INSUFFICIENT_TEST_COUNT', message:`${summary.tests - summary.skipped} executed < required ${policy.minimumTests}` });
  return errors;
}
