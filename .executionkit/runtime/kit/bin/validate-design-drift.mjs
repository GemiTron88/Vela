#!/usr/bin/env node
import path from 'node:path';import { designDrift } from '../lib/component-model.mjs';const root=path.resolve(process.argv[2]??'.');try{const r=designDrift(root);console.log(JSON.stringify(r,null,2));process.exit(r.status==='FAIL'?1:0);}catch(e){console.error(`Design drift validation failed: ${e.message}`);process.exit(1);}
