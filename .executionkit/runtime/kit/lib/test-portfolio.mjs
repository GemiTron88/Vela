import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

// Read-only inventory. Identical files are REVIEW candidates, not permission to delete coverage.
const LIMIT_FILES=6000, LIMIT_FILE_BYTES=256*1024, LIMIT_TOTAL_BYTES=64*1024*1024;
const MAX_NEW_FILES_REVIEW=8;
const IGNORED=new Set(['.git','.executionkit','node_modules','vendor','build','dist','.dart_tool','coverage','generated','fixtures','samples','examples']);
const ASSERTION_RE=/\b(?:assert|expect|should|verify|must|check|throws|rejects|resolves|assertEquals|assertTrue|assertFalse|assertNotNull|XCTAssert)\b/i;
function testSource(rel){
  const name=path.posix.basename(rel);
  const underTest=/(^|\/)(tests?|specs?|integration_test|__tests__)\//i.test(rel);
  return /(?:[._-](?:test|spec)\.[cm]?[jt]sx?|(?:Test|_test)\.php|_test\.dart|\.e2e\.(?:ts|mts)|^test_[^/]+\.py$|_test\.(?:py|go|rs)$|_(?:spec|test)\.rb$)$/i.test(name) ||
    (underTest&&/\.php$/i.test(name)&&!/^(?:TestCase|Pest|CreatesApplication|bootstrap|helpers?)\.php$/i.test(name));
}
function safeRel(root,rel){
  if(!rel||path.posix.isAbsolute(rel)||rel.split('/').some(part=>!part||part==='..'||IGNORED.has(part)))return false;
  const full=path.resolve(root,...rel.split('/'));
  return full.startsWith(root+path.sep);
}
function git(root,args){
  const result=spawnSync('git',['-C',root,...args],{encoding:null,timeout:15000,maxBuffer:8*1024*1024,windowsHide:true});
  if(result.error||result.status!==0)throw Error('TEST_PORTFOLIO_GIT_UNAVAILABLE');
  return result.stdout;
}
function list(root,args){return git(root,args).toString('utf8').split('\0').filter(Boolean).map(x=>x.replaceAll('\\','/'));}
const fingerprint=body=>crypto.createHash('sha256').update(body.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').split('\n').map(line=>line.trimEnd()).join('\n').trim()).digest('hex');
export function inspectTestPortfolio(root,{base='HEAD~1'}={}){
  root=path.resolve(root);
  if(typeof base!=='string'||!base||base.startsWith('-')||/[\r\n\0]/.test(base))return {schemaVersion:'executionkit-test-portfolio/v1',status:'BLOCKED',reason:'TEST_PORTFOLIO_BASE_INVALID'};
  try{
    const entries=[...new Set(list(root,['ls-files','-z','--cached','--others','--exclude-standard','--']))].filter(x=>safeRel(root,x)&&testSource(x)).sort();
    const added=new Set(list(root,['ls-files','-z','--others','--exclude-standard','--']).filter(x=>testSource(x)));
    // Fresh repositories have no HEAD~1. Inspect untracked files without
    // manufacturing a bad inventory verdict in that common first-commit case.
    let diffBase=base;
    if(base==='HEAD~1'){
      try{git(root,['rev-parse','--verify','HEAD~1']);}
      catch{diffBase='HEAD';}
    }
    const baseDiff=git(root,['diff','--name-only','--diff-filter=A','-z',diffBase,'--']).toString('utf8').split('\0').filter(Boolean);
    for(const rel of baseDiff)if(testSource(rel))added.add(rel);
    const pending=git(root,['diff','--name-only','--diff-filter=A','--cached','-z','--']).toString('utf8').split('\0').filter(Boolean);
    for(const rel of pending)if(testSource(rel))added.add(rel);
    if(entries.length>LIMIT_FILES)return {schemaVersion:'executionkit-test-portfolio/v1',status:'REVIEW_REQUIRED',reason:'TEST_PORTFOLIO_INVENTORY_LIMIT',testFiles:entries.length,limit:LIMIT_FILES,noAutomaticDeletion:true};
    const groups=new Map(),skipped=[],allTitles=new Map(),trivialTestPaths=[];
    let bytes=0;
    for(const rel of entries){
      const full=path.join(root,...rel.split('/'));let stat;
      try{stat=fs.lstatSync(full);}catch{skipped.push(rel);continue;}
      if(!stat.isFile()||stat.size>LIMIT_FILE_BYTES||bytes+stat.size>LIMIT_TOTAL_BYTES){skipped.push(rel);continue;}
      bytes+=stat.size;
      const source=fs.readFileSync(full,'utf8'),sha=fingerprint(source);
      if(!ASSERTION_RE.test(source))trivialTestPaths.push(rel);
      if(!groups.has(sha))groups.set(sha,[]);
      groups.get(sha).push(rel);
      // Equal titles are advisory only: separate parent suites or fixtures can be legitimate.
      for(const match of source.matchAll(/\b(?:test|it)\s*\(\s*(['"`])([^'"`\r\n]{4,120})\1/g)){
        const title=match[2].trim().toLowerCase();
        if(!allTitles.has(title))allTitles.set(title,new Set());
        allTitles.get(title).add(rel);
      }
    }
    const duplicates=[...groups.entries()].filter(([,v])=>v.length>1).map(([sha,paths])=>({sha256:sha,paths})).sort((a,b)=>b.paths.length-a.paths.length);
    const repeatedTitles=[...allTitles.entries()].filter(([,paths])=>paths.size>1).sort((a,b)=>b[1].size-a[1].size);
    const newTestFiles=entries.filter(x=>added.has(x));
    const newDuplicates=duplicates.filter(group=>group.paths.some(x=>added.has(x)));
    const review=duplicates.length>0||newTestFiles.length>MAX_NEW_FILES_REVIEW||skipped.length>0;
    return {
      schemaVersion:'executionkit-test-portfolio/v1',status:review?'REVIEW_REQUIRED':'PASS',
      inspectedFiles:entries.length-skipped.length,testFiles:entries.length,newTestFiles:newTestFiles.length,
      newTestPaths:newTestFiles.slice(0,12),duplicateGroups:duplicates.length,duplicateCandidates:duplicates.slice(0,12),
      newDuplicateGroups:newDuplicates.length,repeatedTitleGroups:repeatedTitles.length,
      repeatedTitleExamples:repeatedTitles.slice(0,8).map(([title,paths])=>({title,files:paths.size})),
      trivialTestCount:trivialTestPaths.length,trivialTestPaths:trivialTestPaths.slice(0,12),
      uninspectedFiles:skipped.length,scanBytes:bytes,noAutomaticDeletion:true,
      reason:skipped.length?'TEST_PORTFOLIO_SCAN_INCOMPLETE':newDuplicates.length?'NEW_DUPLICATE_TEST_SOURCE_REVIEW':newTestFiles.length>MAX_NEW_FILES_REVIEW?'TEST_PROLIFERATION_REVIEW_REQUIRED':duplicates.length?'EXISTING_DUPLICATE_TEST_SOURCE_REVIEW':null,
      nextAction:review?'Review risk/critical-journey coverage; consolidate redundant tests manually and rerun focused tests before removing any file.':'Preserve existing coverage; use risk-scoped tests and curated Agentic E2E journeys.'
    };
  }catch(error){return {schemaVersion:'executionkit-test-portfolio/v1',status:'BLOCKED',reason:error.message,noAutomaticDeletion:true};}
}
