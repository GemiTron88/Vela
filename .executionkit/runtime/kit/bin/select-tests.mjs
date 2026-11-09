#!/usr/bin/env node
import path from 'node:path';import { analyzeImpact,selectTests } from '../lib/impact-model.mjs';const root=path.resolve(process.argv[2]??'.');try{const impact=analyzeImpact(root),selection=selectTests(root,impact);console.log(JSON.stringify({impact,selection},null,2));}catch(e){console.error(`Test selection failed: ${e.message}`);process.exit(1);}
