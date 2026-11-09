#!/usr/bin/env node
import path from 'node:path';import { analyzeImpact } from '../lib/impact-model.mjs';const args=process.argv.slice(2),root=path.resolve(args.find(a=>!a.startsWith('--'))??'.');const i=args.indexOf('--base');try{console.log(JSON.stringify(analyzeImpact(root,{base:i>=0?args[i+1]:'HEAD~1'}),null,2));}catch(e){console.error(`Impact analysis failed: ${e.message}`);process.exit(1);}
