#!/usr/bin/env node
import path from 'node:path';
import { buildV4ExecutionEnvelope, validateV4Envelope } from '../lib/v4-kernel.mjs';
import { inspectVisualOS } from '../lib/visual-os.mjs';

const args=process.argv.slice(2);
const command=args[0]&&!args[0].startsWith('--')?args.shift():'start';
const root=path.resolve(args.find((a)=>!a.startsWith('--'))??'.');
const value=(name,fallback=null)=>{const eq=args.find((x)=>x.startsWith(`--${name}=`));if(eq)return eq.slice(name.length+3);const i=args.indexOf(`--${name}`);return i>=0?(args[i+1]??fallback):fallback;};
const boundary=value('boundary','task');
try {
  let result;
  if(['start','status','next'].includes(command)) {
    result=buildV4ExecutionEnvelope(root,{host:value('host','antigravity'),boost:args.includes('--boost'),boundary});
    const validation=validateV4Envelope(result);
    result={...result,envelopeValidation:validation};
    if(validation.status!=='PASS') process.exitCode=1;
    else if(result.blocked) process.exitCode=2;
  } else if(command==='visual') {
    result=inspectVisualOS(root,{boundary});
    if(result.status==='FAIL') process.exitCode=1;
    else if(result.status==='REVIEW_REQUIRED') process.exitCode=2;
  } else if(command==='help') {
    result={usage:'node bin/v4-kernel.mjs start|status|next|visual [project] [--host antigravity] [--boost] [--boundary task|phase|release]',mcp:'DISABLED',systems:11};
  } else throw new Error(`Unknown v4 kernel command: ${command}`);
  console.log(JSON.stringify(result,null,2));
} catch(error) {
  console.error(JSON.stringify({status:'FAIL',error:error.message}));
  process.exit(1);
}
