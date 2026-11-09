#!/usr/bin/env node
import path from 'node:path';
import { memoryEnvelope } from '../lib/state-model.mjs';
const root = path.resolve(process.argv[2] ?? '.');
try { console.log(JSON.stringify(memoryEnvelope(root),null,2)); }
catch(error){ console.error(`State OS memory envelope failed: ${error.message}`); process.exit(1); }
