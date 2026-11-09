import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {canonical,hash,need,sha} from './contracts.mjs';
const [workspace,projectFile,output]=process.argv.slice(2);need(output,'Usage: node src/baseline-cli.mjs clean-flutter-workspace project.json baseline.json');
const p=JSON.parse(await readFile(projectFile)),cwd=resolve(workspace);
sha(p.signing_sha256);const git=args=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8'}).trim();
need(git(['status','--porcelain'])==='','DIRTY_BASELINE');
const flutter=JSON.parse(execFileSync('flutter',['--version','--machine'],{cwd,env:{...process.env,CI:'true'},encoding:'utf8'}));
need(flutter.frameworkVersion===p.flutter_version,'FLUTTER_PIN_MISMATCH');
const plugins=JSON.parse(await readFile(join(cwd,'.flutter-plugins-dependencies')));
const graph=(plugins.plugins?.android??[]).map(x=>({name:x.name,native_build:x.native_build,dependencies:x.dependencies??[]})).sort((a,b)=>a.name.localeCompare(b.name));
const lock=await readFile(join(cwd,'pubspec.lock'));
// Lock digest is conservative: Dart dependency changes may need manual review too.
const snapshot={schema:1,verified:true,verification_source:'clean-git+installed-flutter+resolved-plugin-graph+operator-pinned-signing',source_commit:git(['rev-parse','HEAD']),package_id:p.package_id,signing_sha256:p.signing_sha256,flutter_version:flutter.frameworkVersion,engine_revision:flutter.engineRevision,plugin_digest:hash(canonical({graph,lock_sha256:hash(lock)})),observed_at:new Date().toISOString(),binary_compatibility:'REQUIRES_SHOREBIRD_DRY_RUN'};
await writeFile(output,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'COMPATIBILITY_SNAPSHOT_OBSERVED',sha256:hash(canonical(snapshot))}));
