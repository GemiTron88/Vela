#!/usr/bin/env node
import path from 'node:path'; import { validateCandidate } from '../lib/evidence-model.mjs';
const root = path.resolve(process.argv[2] ?? '.'); try { const result = validateCandidate(root); console.log(JSON.stringify(result, null, 2)); process.exit(result.errors.length ? 1 : 0); }
catch (error) { console.error(`Candidate validation failed: ${error.message}`); process.exit(1); }
