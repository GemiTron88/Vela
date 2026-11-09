#!/usr/bin/env node
import path from 'node:path';
import { rehydrateState } from '../lib/state-model.mjs';
import { emitSystemEvent } from '../lib/telemetry-events.mjs';
const root = path.resolve(process.argv[2] ?? '.');
try {
  const result = rehydrateState(root);
  await emitSystemEvent(root, 'state.rehydrated', {
    status: result.status,
    safeToResume: result.safeToResume,
    driftFields: (result.drift || []).map((item) => item.field),
    taskId: result.live?.lifecycle?.task?.id ?? null,
    action: result.live?.lifecycle?.action ?? null,
  }, { source: 'state-os' });
  console.log(JSON.stringify(result,null,2));
  process.exit(result.safeToResume ? 0 : 2);
}
catch(error){
  await emitSystemEvent(root, 'state.rehydrate_failed', { errorCode: error.code ?? null, message: error.message }, { source: 'state-os' });
  console.error(`State OS rehydration failed: ${error.message}`); process.exit(1);
}
