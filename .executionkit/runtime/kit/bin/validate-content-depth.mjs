#!/usr/bin/env node
import path from 'node:path';import { validateContentDepth } from '../lib/content-model.mjs';const root=path.resolve(process.argv[2]??'.');try{const r=validateContentDepth(root);console.log(JSON.stringify(r,null,2));process.exit(r.status==='FAIL'?1:0);}catch(e){console.error(`Content validation failed: ${e.message}`);process.exit(1);}
