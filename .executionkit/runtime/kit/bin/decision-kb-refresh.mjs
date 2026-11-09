#!/usr/bin/env node
import {refreshLocalKnowledge} from '../lib/decision/kb-sync.mjs';
try{console.log(JSON.stringify(await refreshLocalKnowledge(process.argv[2])));}catch{console.log(JSON.stringify({status:'UNAVAILABLE',reason:'KB_REFRESH_UNAVAILABLE'}));process.exitCode=1;}
