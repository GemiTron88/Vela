import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const kitRoot=root;
const cli=path.join(root,'bin','executionkit-cli.mjs');
const esc=(value)=>value.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');

test('v4 CLI help exposes the complete ten-system operator surface',()=>{
  const run=spawnSync(process.execPath,[cli,'help'],{
    cwd:root,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024,windowsHide:true,shell:false
  });
  assert.equal(run.status,0,run.stderr||run.stdout);
  const out=JSON.parse(run.stdout);
  assert.equal(out.schemaVersion,'executionkit-v4-cli/v1');
  assert.equal(out.mcp,'DISABLED');
  assert.equal(out.systems,10);
  const text=out.usage.join('\n');
  for(const required of [
    'executionkit start|status|next',
    'executionkit systems status',
    'executionkit control-plane status|verify-head',
    'executionkit platform status',
    'executionkit activation status|apply',
    'executionkit boundary wave|phase',
    'executionkit product status|reconcile',
    'executionkit todo status|maintain|migrate',
    'executionkit upgrade-revalidation status|plan|run',
    'executionkit agents status|plan|run|collect',
    'executionkit agents delegated',
    'executionkit agents integrate|reconcile|cleanup',
    'executionkit agents result',
    'executionkit state status|rehydrate|checkpoint|amnesia',
    'executionkit knowledge status|refresh|search|impact|providers|context',
    'executionkit knowledge auto',
    'executionkit knowledge usage',
    'executionkit db status|refresh|guard|table|column|model',
    'executionkit content status|discover|validate',
    'executionkit seo status|validate',
    'executionkit docs status|refresh|build|validate|search',
    'executionkit visual status|validate',
    'executionkit audit task|wave|phase|release',
    'executionkit test impact|task|wave|phase|release',
    'executionkit launch status|plan|build|verify|release|deploy|rollback',
    'executionkit reconcile status|task|wave|phase|release',
    'executionkit providers status|doctor',
    'executionkit install|update|upgrade|repair',
    'executionkit doctor',
    'executionkit rollback'
  ])assert.match(text,new RegExp(esc(required)),required);
});

test('v4 CLI source registers every grouped command family advertised by help',()=>{
  const source=fs.readFileSync(cli,'utf8');
  for(const family of [
    'systems','control-plane','platform','activation','boundary','product','todo','visual',
    'state','knowledge','db','content','docs','seo','audit','test','launch','agents','reconcile','providers','upgrade-revalidation'
  ])assert.ok(source.includes("command==='"+family+"'"),family);
  assert.match(source,/\['install','update','upgrade','repair'\]\.includes\(command\)/);
  assert.match(source,/command==='doctor'/);
  assert.match(source,/command==='rollback'/);
});


test('v4 production deployment cannot be invoked through a convenience bypass',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.equal(pkg.scripts['deploy:apply'],'node bin/release-project.mjs . --authorize');
  const lowLevel=fs.readFileSync(path.join(root,'bin','production-deployment.mjs'),'utf8');
  assert.match(lowLevel,/Direct v4 artifact deployment is disabled/);
  assert.match(lowLevel,/executionkit launch deploy \. --authorize/);
});

test('v4 CLI requires explicit activation and exposes exact-HEAD verification',()=>{
  const source=fs.readFileSync(cli,'utf8');
  assert.match(source,/const deep=has\('deep'\)/);
  assert.match(source,/fast:!deep/);
  assert.match(source,/inspectV4Activation\(root\)/);
  assert.match(source,/action==='apply'/);
  assert.match(source,/control-plane verify-head requires --expected/);
  assert.match(source,/verifyV4ExactHead\(root,expected\)/);
});

test('v4 CLI accepts standard top-level help aliases used by automation',()=>{
  for(const alias of ['help','--help','-h']){
    const run=spawnSync(process.execPath,[cli,alias],{cwd:kitRoot,encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    const out=JSON.parse(run.stdout);
    assert.equal(out.status,'OK');
    assert.equal(out.systems,10);
    assert.ok(Array.isArray(out.commands)&&out.commands.includes('db'));
    assert.ok(Array.isArray(out.usage)&&out.usage.length>10);
  }
});

test('v4 CLI accepts standard version aliases',()=>{
  for(const alias of ['version','--version','-V']){
    const run=spawnSync(process.execPath,[cli,alias],{cwd:kitRoot,encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    const out=JSON.parse(run.stdout);
    assert.equal(out.status,'OK');
    assert.match(out.version,/^4\./);
  }
});

test('v4 CLI family and command help short-circuit normal dispatch',()=>{
  for(const argv of [['db','--help'],['db','-h'],['db','help'],['install','--help'],['upgrade','-h']]){
    const run=spawnSync(process.execPath,[cli,...argv],{cwd:kitRoot,encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    const out=JSON.parse(run.stdout);
    assert.equal(out.status,'OK');
    assert.ok(out.usage.length>=1,JSON.stringify(out));
    assert.ok(out.usage.some((line)=>line.includes(argv[0])));
  }
});

test('v4 CLI unknown commands return stable machine-readable discovery error',()=>{
  const run=spawnSync(process.execPath,[cli,'definitely-not-a-command'],{cwd:kitRoot,encoding:'utf8'});
  assert.equal(run.status,2,run.stdout+run.stderr);
  const out=JSON.parse(run.stderr);
  assert.equal(out.status,'CLI_ERROR');
  assert.equal(out.code,'UNKNOWN_COMMAND');
  assert.ok(out.availableCommands.includes('help'));
  assert.ok(out.availableCommands.includes('version'));
});

