#!/usr/bin/env node
import path from 'node:path';
import { writeStateCheckpoint } from '../lib/state-model.mjs';
import { emitSystemEvent } from '../lib/telemetry-events.mjs';
const args = process.argv.slice(2);
const valueOptions = new Set(['--reason','--note','--next-safe-action','--context-health','--working-file','--evidence']);
let rootArg = '.';
for (let i=0;i<args.length;i++) { const arg=args[i]; if (valueOptions.has(arg)) { i++; continue; } if (!arg.startsWith('--')) { rootArg=arg; break; } }
const root = path.resolve(rootArg);
function values(name) { const out=[]; for(let i=0;i<args.length;i++) if(args[i]===`--${name}` && args[i+1] && !args[i+1].startsWith('--')) out.push(args[++i]); return out; }
function value(name, fallback=null) { return values(name)[0] ?? fallback; }
try {
  const result = writeStateCheckpoint(root, {
    reason: value('reason','manual'), note: value('note'), nextSafeAction: value('next-safe-action'), contextHealth: value('context-health','UNKNOWN'),
    workingFiles: values('working-file'), evidenceRefs: values('evidence'),
  });
  await emitSystemEvent(root, 'state.checkpointed', {
    status: result.status,
    reason: result.snapshot?.reason ?? value('reason','manual'),
    capturedAt: result.snapshot?.capturedAt ?? null,
    taskId: result.snapshot?.lifecycle?.task?.id ?? null,
    action: result.snapshot?.lifecycle?.action ?? null,
    runtimeStatus: result.snapshot?.runtime?.status ?? null,
    evidenceRefCount: result.snapshot?.evidenceRefs?.length ?? 0,
  }, { source: 'state-os' });
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(`State OS checkpoint failed: ${error.message}`); process.exit(1); }
