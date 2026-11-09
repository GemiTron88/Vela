#!/usr/bin/env node
import path from 'node:path';
import { configuredAdapter, runCommand, writeRaw } from '../lib/external-adapters.mjs';

const root=path.resolve(process.argv[2]??'.');
const KNOWN_DOMAINS=['health-endpoints','logs','queues','workers','scheduler','database','cache','search','storage','external-integrations'];
try{
  const cfg=configuredAdapter(root,'runtime-health'),checks=[];
  for(const item of cfg.checks??[]){
    const entry=typeof item==='string'?{command:item,name:item,domain:'unspecified'}:item;
    if(!entry?.command)continue;
    const r=runCommand(root,entry.command,[],{shell:true,timeoutMs:Number(entry.timeoutMs??cfg.timeoutMs??120000)});
    checks.push({name:entry.name??entry.command,domain:entry.domain??'unspecified',command:r.command,exitCode:r.exitCode,ok:r.ok,stderr:r.stderr.slice(-2000)});
  }
  const errors=[];
  for(const check of checks) if(!check.ok) errors.push({code:'RUNTIME_HEALTH_CHECK_FAILED',message:`${check.name} failed`,domain:check.domain});
  const coveredDomains=[...new Set(checks.filter(c=>c.ok).map(c=>c.domain).filter(d=>d&&d!=='unspecified'))];
  const requiredDomains=Array.isArray(cfg.requiredDomains)?cfg.requiredDomains:[];
  for(const domain of requiredDomains){
    if(!KNOWN_DOMAINS.includes(domain)) errors.push({code:'RUNTIME_HEALTH_DOMAIN_UNKNOWN',message:`Unknown required runtime health domain: ${domain}`});
    else if(!checks.some(c=>c.domain===domain)) errors.push({code:'RUNTIME_HEALTH_DOMAIN_NOT_CONFIGURED',message:`Required runtime health domain has no configured check: ${domain}`});
    else if(!checks.some(c=>c.domain===domain&&c.ok)) errors.push({code:'RUNTIME_HEALTH_DOMAIN_UNVERIFIED',message:`Required runtime health domain has no passing check: ${domain}`});
  }
  const unverifiedDomains=KNOWN_DOMAINS.filter(d=>!coveredDomains.includes(d));
  const status=errors.length?'FAIL':!checks.length?'NOT_CONFIGURED':'PASS';
  const evidence={schemaVersion:'1.0.0',status,checks,coveredDomains,requiredDomains,unverifiedDomains,errors,observedAt:new Date().toISOString(),limits:'PASS covers only configured checks and explicitly covered domains. Unverified domains are not implied by the aggregate status.'};
  writeRaw(root,'runtime-health.json',evidence);console.log(JSON.stringify(evidence,null,2));process.exit(errors.length?1:0);
}catch(error){console.error(`Runtime health validation failed: ${error.message}`);process.exit(1);}
