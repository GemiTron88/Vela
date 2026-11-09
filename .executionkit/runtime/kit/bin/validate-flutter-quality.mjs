#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { configuredAdapter, executable, runCommand, writeRaw } from '../lib/external-adapters.mjs';
import { parseFlutterMachine, validateAdequacy } from '../lib/test-evidence.mjs';

const root = path.resolve(process.argv[2] ?? '.');
const requiredKeys = { integration:'requireIntegration', golden:'requireGolden', semantics:'requireSemantics', profileBuild:'requireProfileBuild', device:'requireDevice' };
function optionalGate(cfg, key, label, errors) {
  const commandKey = `${key}Command`, requireKey = requiredKeys[key];
  const command = cfg[commandKey], required = cfg[requireKey] === true;
  if (!command) { if (required) errors.push({code:`FLUTTER_${key.replace(/[A-Z]/g,(m)=>`_${m}`).toUpperCase()}_NOT_CONFIGURED`,message:`${label} is required but ${commandKey} is not configured`}); return { status:'NOT_VERIFIED', required, command:null, exitCode:null }; }
  const result = runCommand(root, command, [], { shell:true, timeoutMs:Number(cfg[`${key}TimeoutMs`] ?? cfg.timeoutMs ?? 1800000) });
  if (!result.ok) errors.push({code:`FLUTTER_${key.replace(/[A-Z]/g,(m)=>`_${m}`).toUpperCase()}_FAILED`,message:`${label} failed with exit ${result.exitCode}`});
  return { status:result.ok?'PASS':'FAIL', required, command:result.command, exitCode:result.exitCode };
}

try {
  if(!fs.existsSync(path.join(root,'pubspec.yaml'))){console.log(JSON.stringify({status:'NOT_APPLICABLE',tool:'flutter'},null,2));process.exit(0);}
  if(!executable('flutter',root)){console.log(JSON.stringify({status:'NOT_AVAILABLE',tool:'flutter'},null,2));process.exit(2);}
  const cfg=configuredAdapter(root,'flutter'), errors=[];
  const analyze=runCommand(root,'flutter',['analyze',...(cfg.analyzeArgs??[])],{timeoutMs:Number(cfg.timeoutMs??1800000)});
  const test=runCommand(root,'flutter',['test','--machine',...(cfg.testArgs??[])],{timeoutMs:Number(cfg.timeoutMs??1800000)});
  const summary=parseFlutterMachine(test.stdout);
  const testErrors=validateAdequacy(summary,{allowSkipped:cfg.allowSkipped===true,minimumTests:cfg.minimumTests??1});
  errors.push(...testErrors);
  if(!analyze.ok) errors.push({code:'FLUTTER_ANALYZE_FAILED',message:(analyze.stderr||analyze.stdout).slice(-2000)});
  if(!test.ok) errors.push({code:'FLUTTER_TEST_FAILED',message:(test.stderr||test.stdout).slice(-2000)});
  if(!summary.tests) errors.push({code:'FLUTTER_ZERO_TESTS',message:'flutter test executed zero tests'});
  if(summary.fail) errors.push({code:'FLUTTER_TEST_FAILURES',message:`${summary.fail} Flutter tests failed`});
  if(summary.skipped&&!cfg.allowSkipped) errors.push({code:'FLUTTER_REQUIRED_SKIPS',message:`${summary.skipped} Flutter tests skipped`});

  const dimensions = {
    analyze:{status:analyze.ok?'PASS':'FAIL',exitCode:analyze.exitCode},
    unitWidgetTests:{status:test.ok&&!testErrors.length?'PASS':'FAIL',...summary,exitCode:test.exitCode},
    integration:optionalGate(cfg,'integration','Flutter integration test',errors),
    goldens:optionalGate(cfg,'golden','Flutter golden/visual test',errors),
    semantics:optionalGate(cfg,'semantics','Flutter semantics/accessibility test',errors),
    profileBuild:optionalGate(cfg,'profileBuild','Flutter profile/release build validation',errors),
    device:optionalGate(cfg,'device','Flutter real-device/emulator validation',errors),
  };
  const verifiedDimensions=Object.entries(dimensions).filter(([,v])=>v.status==='PASS').map(([k])=>k);
  const notVerifiedDimensions=Object.entries(dimensions).filter(([,v])=>v.status==='NOT_VERIFIED').map(([k])=>k);
  const evidence={schemaVersion:'1.0.0',status:errors.length?'FAIL':'PASS',tool:'flutter',dimensions,verifiedDimensions,notVerifiedDimensions,errors,observedAt:new Date().toISOString(),limits:'PASS means all configured/required Flutter gates passed. Dimensions listed as NOT_VERIFIED were not executed and are not implied by the aggregate status.'};
  writeRaw(root,'flutter-quality.json',evidence);console.log(JSON.stringify(evidence,null,2));process.exit(errors.length?1:0);
}catch(error){console.error(`Flutter quality validation failed: ${error.message}`);process.exit(1);}
