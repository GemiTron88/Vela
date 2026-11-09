#!/usr/bin/env node
import path from 'node:path';import { discoverContent } from '../lib/content-model.mjs';const root=path.resolve(process.argv[2]??'.');try{console.log(JSON.stringify(discoverContent(root),null,2));}catch(e){console.error(`Content discovery failed: ${e.message}`);process.exit(1);}
