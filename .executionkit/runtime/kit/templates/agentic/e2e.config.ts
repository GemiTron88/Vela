import fs from 'node:fs';
import { createEvidenceStore } from './postconditions.mjs';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { E2EConfig } from 'e2e';

const manifest=JSON.parse(fs.readFileSync(new URL('../../executionkit.journeys.json',import.meta.url),'utf8'));
const requireEnv=(name:string)=>{const value=process.env[name];if(!value)throw new Error(`${name} is required`);return value;};
const provider=createOpenAICompatible({name:'executionkit-qa',baseURL:requireEnv('EXECUTIONKIT_E2E_MODEL_URL'),apiKey:process.env.EXECUTIONKIT_E2E_MODEL_KEY});
const model=provider(requireEnv('EXECUTIONKIT_E2E_MODEL'));
const targets=await Promise.all(manifest.targets.map(async (t:any)=>{
  const app={identity:manifest.app.identity,environment:manifest.app.environment};
  if(t.platform==='web'){
    const {web}=await import('@e2e-dev/web');
    return {name:t.name,engine:web({viewport:t.viewport??{width:1280,height:800},locale:t.locale}),app:{...app,url:requireEnv('EXECUTIONKIT_E2E_APP_URL')}};
  }
  const {mobile}=await import('@e2e-dev/mobile');
  return {name:t.name,engine:mobile({platform:t.platform,...(t.device?{device:t.device}:{})}),app:{...app,bundleId:requireEnv('EXECUTIONKIT_E2E_BUNDLE_ID')}};
}));

export default {
  targets,tests:'**/*.e2e.ts',workers:1,retries:0,timeout:120000,trace:'on',
  artifacts:{store:createEvidenceStore()},
  cache:{mode:'read-write',dir:'.e2e/cache',strict:false},
  agents:{default:{model,maxModelCalls:12,maxSteps:20,judgmentTimeout:60000,
    context:JSON.stringify({identity:manifest.app.identity,roles:manifest.targets.map((t:any)=>({target:t.name,role:t.role,locale:t.locale}))}),
    system:'Follow the requested user goal using visible navigation. Verify effects. On replay handoff, inspect current state before repeating any uncertain write. Never bypass a missing UI via project tools. Report dead ends and ambiguous controls.'}}
} satisfies E2EConfig;
