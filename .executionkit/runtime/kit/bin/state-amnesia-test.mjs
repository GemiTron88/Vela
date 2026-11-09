#!/usr/bin/env node
import path from 'node:path';
import { amnesiaTest } from '../lib/state-model.mjs';
const root = path.resolve(process.argv[2] ?? '.');
try { const result=amnesiaTest(root); console.log(JSON.stringify(result,null,2)); process.exit(result.ok ? 0 : 2); }
catch(error){ console.error(`State OS amnesia test failed: ${error.message}`); process.exit(1); }
