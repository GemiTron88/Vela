#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const baselinePath = path.join(root, 'tests/test-baseline.json');
let baseline;
try { baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')); }
catch (error) { console.error(`Test baseline invalid: ${error.message}`); process.exit(1); }

let version;
try { version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim(); }
catch (error) { console.error(`VERSION invalid: ${error.message}`); process.exit(1); }

if (
  baseline.schemaVersion !== '1.0.0' ||
  baseline.releaseVersion !== version ||
  !Number.isInteger(baseline.minimumRuntimeTests) ||
  baseline.minimumRuntimeTests < 1 ||
  !Array.isArray(baseline.requiredFiles)
) {
  console.error(`Test baseline invalid: expected schemaVersion 1.0.0, releaseVersion ${version}, positive minimumRuntimeTests and requiredFiles array`);
  process.exit(1);
}
for (const rel of baseline.requiredFiles) {
  if (typeof rel !== 'string' || !rel.startsWith('tests/') || !fs.existsSync(path.join(root, rel))) {
    console.error(`Required regression file missing: ${rel}`);
    process.exit(1);
  }
}

const childEnv = { ...process.env };
delete childEnv.NODE_TEST_CONTEXT;
function regressionFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Regression source must not be a symlink: ${file}`);
    return entry.isDirectory() ? regressionFiles(file) : entry.isFile() && entry.name.endsWith('.test.mjs') ? [file] : [];
  }).sort();
}
const files = regressionFiles(path.join(root, 'tests'));
if (!files.length || baseline.requiredFiles.some((rel) => !files.includes(path.join(root, rel)))) {
  console.error('Regression discovery failed: every required test must be selected from tests/**/*.test.mjs');
  process.exit(1);
}
// During implementation run npm test -- --target tests/name.test.mjs.
// Bare npm test remains a deliberate full-suite phase/release command.
const cliArgs=process.argv.slice(2),requested=[];
let filterPattern=null;
for(let i=0;i<cliArgs.length;i++){
  const arg=cliArgs[i];
  if(arg==='--full-output')continue;
  if(arg==='--target'||arg.startsWith('--target=')){
    const value=arg==='--target'?cliArgs[++i]:arg.slice('--target='.length);
    if(!value||value.startsWith('--')){console.error('--target requires a tests/**/*.test.mjs path');process.exit(2);}
    requested.push(...value.split(/[;,]/).map(x=>x.trim()).filter(Boolean));
  }else if(arg==='--filter'||arg.startsWith('--filter=')){
    const value=arg==='--filter'?cliArgs[++i]:arg.slice('--filter='.length);
    if(!value||value.startsWith('--')){console.error('--filter requires a test name pattern');process.exit(2);}
    filterPattern=value;
  }else{console.error('Unknown test option: '+arg);process.exit(2);}
}
const selected=[];
for(const raw of requested){
  const rel=raw.replace(/\\/g,'/');
  if(!/^tests\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.test\.mjs$/.test(rel)||rel.split('/').includes('..')){
    console.error('Invalid targeted regression path: '+raw);process.exit(2);
  }
  const file=path.join(root,...rel.split('/'));
  if(!files.includes(file)){console.error('Targeted regression not found: '+raw);process.exit(2);}
  if(!selected.includes(file))selected.push(file);
}
const testFiles=selected.length?selected:files;
// Every run owns its scratch tree. Nested test fixtures inherit it, including failures.
function removeOwnedScratch(dir){
  if(fs.lstatSync(dir).isSymbolicLink()||fs.realpathSync(dir)!==path.join(fs.realpathSync(os.tmpdir()),path.basename(dir)))throw new Error('Scratch ownership changed');
  const unseal=current=>{
    try{
      fs.chmodSync(current,fs.statSync(current).mode|0o700);
      for(const entry of fs.readdirSync(current,{withFileTypes:true}))if(entry.isDirectory()&&!entry.isSymbolicLink())unseal(path.join(current,entry.name));
    }catch{}
  };
  unseal(dir);
  fs.rmSync(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'executionkit-regression-'));
Object.assign(childEnv, { TMPDIR: scratch, TEMP: scratch, TMP: scratch });
let result;
let cleanupError=null;
try {
  result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...(filterPattern?[`--test-name-pattern=${filterPattern}`]:[]), ...testFiles], {
    cwd: root,
    env: childEnv,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
} finally {
  try { removeOwnedScratch(scratch); }
  catch(error) { cleanupError=error; }
}
const fullOutput = process.argv.includes('--full-output') || process.env.EXECUTIONKIT_TEST_OUTPUT === 'full';
if (fullOutput) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
} else {
  const tap = String(result.stdout ?? '');
  // Keep failures with their diagnostics; omit thousands of passing-case lines.
  const failures = [...tap.matchAll(/^not ok[^\n]*\n(?:[ \t]+[^\n]*\n)*/gm)].map(match => match[0]);
  if (failures.length) {
    process.stdout.write(failures.map(value=>value.split('\n')[0].slice(0,200)).join('\n').slice(0,4000)+'\n');
    process.stdout.write(failures.slice(0,6).map(value=>value.slice(0,1200)).join(''));
  }
  else if (result.status !== 0) process.stdout.write(tap.slice(-4000));
  const summary = tap.split(/\r?\n/).filter(line => /^# (?:tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)\b/.test(line));
  if (summary.length) process.stdout.write(summary.join('\n') + '\n');
  if (result.stderr) process.stderr.write(String(result.stderr).slice(-1600));
}
if (result.error) { console.error(`Test runner failed: ${result.error.message}`); process.exit(1); }
if(cleanupError)console.error(`Test scratch cleanup failed: ${cleanupError.code ?? 'ERROR'}; owned path: ${scratch}`);
if (result.status !== 0) process.exit(result.status ?? 1);
if(cleanupError)process.exit(1);

const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
// Skipped/todo tests are discovered cases, not executed regression evidence.
const passed = [...output.matchAll(/^#\s*pass\s+(\d+)\s*$/gmi)].map((m) => Number(m[1]));
const count = passed.length ? passed.at(-1) : NaN;
if (!Number.isInteger(count)) {
  console.error('Regression floor FAIL: could not determine passed runtime test count from TAP output');
  process.exit(1);
}
if(selected.length||filterPattern){
  console.log(`Targeted regression PASS: ${count} passed across ${selected.length||testFiles.length} file(s); full-suite floor deferred to phase/release.`);
  process.exit(0);
}
if (count < baseline.minimumRuntimeTests) {
  console.error(`Regression floor FAIL: ${count} tests passed, minimum is ${baseline.minimumRuntimeTests}; skipped/todo tests do not count`);
  process.exit(1);
}
console.log(`Regression floor PASS: ${count} passed runtime tests >= ${baseline.minimumRuntimeTests} for ${version}; required files: ${baseline.requiredFiles.length}`);
