#!/usr/bin/env node
import path from 'node:path';
import { inspectRepositoryProviders } from '../lib/repository-providers.mjs';

const args=process.argv.slice(2);
const root=path.resolve(args.find((arg)=>!arg.startsWith('--')) ?? '.');
const json=args.includes('--json');
if(args.includes('--plan')||args.includes('--apply')){
  const out={schemaVersion:'executionkit-v4-native-providers/v1',status:'REMOVED',mode:'NATIVE_ONLY',message:'External repository provider planning/apply was removed from ExecutionKit v4.'};
  if(json)console.log(JSON.stringify(out,null,2));else console.error(out.message);
  process.exitCode=2;
}else{
  const status=inspectRepositoryProviders(root);
  if(json)console.log(JSON.stringify(status,null,2));
  else{
    console.log('Repository providers: NATIVE_ONLY');
    for(const provider of status.providers)console.log(`- ${provider.id}: ${provider.status} (${provider.version??'builtin'})`);
  }
}
