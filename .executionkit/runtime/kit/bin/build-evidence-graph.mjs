#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import { buildEvidenceGraph } from '../lib/evidence-model.mjs';
const root=path.resolve(process.argv[2]??'.'); try { const graph=buildEvidenceGraph(root), file=path.join(root,'.executionkit','evidence','graph.json'); fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,`${JSON.stringify(graph,null,2)}\n`); console.log(JSON.stringify(graph,null,2)); } catch(error){console.error(`Evidence graph failed: ${error.message}`);process.exit(1);}
