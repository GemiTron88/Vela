// External Services & Provider Readiness Gate. Local, deterministic and network-free.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolveProjectPathSafe,resolveDerivedPath} from './derived-state.mjs';

export const PROVIDER_STATUSES=Object.freeze(['NOT_DISCOVERED','NOT_CONFIGURED','CONFIGURED_UNVERIFIED','SANDBOX_VERIFIED','PRODUCTION_VERIFIED','OWNER_DEFERRED','BLOCKED','NOT_APPLICABLE']);
export const INVENTORY_PATH='executionkit.providers.json';
const HEX=/^[a-f0-9]{64}$/,ID=/^[a-z0-9][a-z0-9._:-]{0,99}$/;
const MAX_AGE_MS=86400000,MAX_BYTES=32*1024*1024;
const EXCLUDED=/(^|\/)(?:\.git|\.executionkit|node_modules|vendor|build|dist|coverage|tests?|docs|reports|\.dart_tool|\.gradle|Pods)(\/|$)/i;
const SECRET_PATH=/(?:^|\/)(?:\.env(?!\.(?:example|sample)$)|credentials[^/]*|service.account[^/]*|secrets[^/]*|id_rsa|id_ed25519)(?:$|\/)|\.(?:pem|key|p12|pfx|jks|keystore)$/i;
const SOURCE=/\.(?:php|dart|[cm]?js|jsx|tsx?|json|ya?ml|toml|mod|xml|gradle|kt|swift|py|go|rb|cs|rs|vue|svelte|sh|ps1)$|(?:^|\/)(?:\.env\.(?:example|sample)|requirements[^/]*\.txt)$/;
const RULES=Object.freeze([
  ['whatsapp','waui',/Waui|WAUI_/i],
  ['whatsapp','meta',/MetaWhatsApp|WHATSAPP_PHONE_NUMBER_ID|graph\.facebook\.com/i],
  ['sms','sms',/SmsOtpDeliveryProvider|SMS_(?:API|BASE_URL|SENDER)|twilio|vonage/i],
  ['push','fcm',/FcmPushProvider|FIREBASE_CREDENTIALS|firebase_messaging|FirebaseMessaging/i],
  ['email','mail',/MAIL_MAILER|MAIL_HOST|LaravelMailEmail|nodemailer|@aws-sdk\/client-ses/i],
  ['maps','google-maps',/GoogleMapProvider|GOOGLE_MAPS_|maps\.googleapis\.com/i],
  ['maps','tiles',/tile\.openstreetmap|basemaps\.cartocdn|MAP_TILE_|SELF_HOSTED.*TILE/i],
  ['maps','routing',/FallbackDirectionsProvider|OSRM_|ROUTER_BASE_URL|NOMINATIM|FallbackGeocoder/i],
  ['payments','paytabs',/PayTabs|PAYTABS_/i],
  ['payments','stripe',/stripe\/stripe|api\.stripe\.com|STRIPE_SECRET/i],
  ['erp','abc',/abc_integration|AuthenticateAbcRequest|ABC_INTEGRATION_ENABLED/i],
  ['malware','clamav',/ClamAv|CLAMAV_|clamd/i],
  ['storage','s3',/AWS_BUCKET|@aws-sdk\/client-s3|league\/flysystem-aws-s3/i],
  ['backup','google-drive',/GoogleDriveBackupTarget|GOOGLE_DRIVE_/i],
  ['attestation','native-integrity',/AppIntegrityService|app_integrity_service|play_integrity|app_attest/i],
  ['identity','oidc',/OIDC_ISSUER|AUTH0_DOMAIN|openid-client/i],
  ['search','external-search',/MEILISEARCH_HOST|ALGOLIA_APP_ID|ELASTICSEARCH_HOST/i],
  ['external','http',/https?:\/\/|\b(?:Http::|fetch\s*\(|axios\.|Dio\s*\(|GuzzleHttp|requests\.|httpx\.|urllib\.|http\.Get|reqwest::|Net::HTTP|HttpClient)/i],
]);
export function canonical(value){
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export const providerDigest=value=>crypto.createHash('sha256').update(typeof value==='string'?value:canonical(value)).digest('hex');
function requireThat(ok,code){if(!ok)throw Error(code);}
function object(value,keys,code){requireThat(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>keys.includes(k)),code);}
function ids(value,{empty=true}={}){return Array.isArray(value)&&(empty||value.length>0)&&value.length<=500&&new Set(value).size===value.length&&value.every(v=>typeof v==='string'&&ID.test(v));}
function readJson(root,rel,max=1024*1024){const f=resolveProjectPathSafe(root,rel,'provider document',{mustExist:true,file:true});requireThat(fs.statSync(f).size<=max,'PROVIDER_DOCUMENT_TOO_LARGE');return JSON.parse(fs.readFileSync(f,'utf8'));}
function git(root,args,maxBuffer=4*1024*1024){const r=spawnSync('git',args,{cwd:root,encoding:'utf8',timeout:10000,maxBuffer,shell:false,windowsHide:true});requireThat(r.status===0,'PROVIDER_SOURCE_UNAVAILABLE');return r.stdout;}
export function providerSourcePath(rel){return !EXCLUDED.test(rel)&&!SECRET_PATH.test(rel)&&SOURCE.test(rel)&&rel!==INVENTORY_PATH&&rel!=='package-lock.json'&&!rel.endsWith('/pubspec.lock');}
export function discoverExternalServices(root,{cache=false}={}){
  const listed=git(root,['ls-files','-z','--cached','--others','--exclude-standard']).split('\0').filter(Boolean);
  requireThat(listed.length<=60000,'PROVIDER_DISCOVERY_FILE_LIMIT');
  const files=[...new Set(listed.filter(providerSourcePath))].sort();
  requireThat(files.length<=12000,'PROVIDER_DISCOVERY_SOURCE_LIMIT');
  const sources=[],findings=[],environmentNames=new Set(),bodies=[];let bytes=0;
  for(const rel of files){
    const file=resolveProjectPathSafe(root,rel,'provider discovery source',{mustExist:true,file:true}),stat=fs.statSync(file);
    requireThat(stat.size<=2*1024*1024,'PROVIDER_DISCOVERY_FILE_TOO_LARGE');bytes+=stat.size;requireThat(bytes<=MAX_BYTES,'PROVIDER_DISCOVERY_BYTE_LIMIT');
    const body=fs.readFileSync(file,'utf8');requireThat(!body.includes('\0'),'PROVIDER_DISCOVERY_BINARY');
    sources.push({path:rel,sha256:providerDigest(body)});
    bodies.push({rel,body});
  }
  const sourceDigest=providerDigest(sources);
  let cacheFile=null;if(cache){cacheFile=resolveDerivedPath(root,'.executionkit/providers/discovery.json','provider discovery cache',{createParents:true});
    if(fs.existsSync(cacheFile)){const old=readJson(root,'.executionkit/providers/discovery.json',4*1024*1024);if(old.schemaVersion==='executionkit-provider-discovery/v1'&&old.sourceDigest===sourceDigest&&old.complete===true)return old;}
  }
  for(const {rel,body} of bodies){
    const cleanedForExternal=body.replace(/https?:\/\/(?:www\.w3\.org|schemas\.android\.com|schemas\.openxmlformats\.org|ns\.adobe\.com)\/[^\s"'<>)]*/gi,'');
    const matched=RULES.filter(([category, ,pattern])=>(category!=='external'||!(/\.(?:json|xml|ya?ml)$/.test(rel)))&&pattern.test(rel+'\n'+(category==='external'?cleanedForExternal:body)));
    // Generic HTTP is a coverage finding only when a named driver did not explain the file.
    for(const [category,driver] of matched.filter(x=>x[0]!=='external'||matched.length===1))findings.push({key:category+':'+driver,path:rel,stage:'DECLARED'});
    for(const m of body.matchAll(/\b(?:WAUI|WHATSAPP|SMS|FIREBASE|FCM|MAIL|GOOGLE_MAPS|PAYTABS|ABC|CLAMAV|AWS|S3|MEILISEARCH|ALGOLIA|OIDC|AUTH0)_[A-Z0-9_]+\b/g))environmentNames.add(m[0]);
  }
  const result={schemaVersion:'executionkit-provider-discovery/v1',sourceDigest,complete:true,files:files.length,bytes,findings,environmentNames:[...environmentNames].sort()};
  if(cacheFile)fs.writeFileSync(cacheFile,JSON.stringify(result)+'\n',{mode:0o600});
  return result;
}
export function validateProviderInventory(value){
  object(value,['schemaVersion','sourceDigest','providers'],'PROVIDER_INVENTORY_SCHEMA');
  requireThat(value.schemaVersion==='executionkit-providers/v1'&&(value.sourceDigest===null||HEX.test(value.sourceDigest??''))&&Array.isArray(value.providers)&&value.providers.length<=200,'PROVIDER_INVENTORY_SCHEMA');
  const seen=new Set();
  for(const p of value.providers){
    object(p,['id','category','driver','implementation','capability','features','journeys','environments','requirement','condition','releaseScope','enabled','discoveryKeys','credentialNames','approvalRoles','callbackRequired','deliveryRequired','owner','nextAction'],'PROVIDER_SCHEMA');
    requireThat(ID.test(p.id??'')&&!seen.has(p.id)&&ID.test(p.category??'')&&ID.test(p.driver??'')&&['external','mock','stub','disabled','incomplete','internal'].includes(p.implementation),'PROVIDER_ID_OR_IMPLEMENTATION');seen.add(p.id);
    for(const k of ['capability','owner','nextAction'])requireThat(typeof p[k]==='string'&&p[k].length>0&&p[k].length<=300&&!/[\u0000-\u001f]/.test(p[k]),'PROVIDER_DESCRIPTION');
    for(const k of ['features','journeys','discoveryKeys','approvalRoles'])requireThat(ids(p[k]),'PROVIDER_LIST');
    requireThat(p.features.length>0&&p.journeys.length>0,'PROVIDER_DEPENDENCIES_REQUIRED');
    requireThat(p.approvalRoles.every(r=>['owner','vendor'].includes(r)),'PROVIDER_APPROVAL_ROLE');
    requireThat(Array.isArray(p.credentialNames)&&p.credentialNames.length<=100&&p.credentialNames.every(n=>/^[A-Z][A-Z0-9_]{1,99}$/.test(n)),'PROVIDER_CREDENTIAL_NAMES_ONLY');
    requireThat(Array.isArray(p.environments)&&p.environments.length>0&&p.environments.every(e=>['development','staging','production'].includes(e)),'PROVIDER_ENVIRONMENT');
    requireThat(['required','optional','conditional'].includes(p.requirement)&&['release','features'].includes(p.releaseScope)&&typeof p.enabled==='boolean'&&typeof p.callbackRequired==='boolean'&&typeof p.deliveryRequired==='boolean','PROVIDER_POLICY');
    requireThat(p.requirement!=='conditional'||ID.test(p.condition??''),'PROVIDER_CONDITION');
  }
  return value;
}
const CONTEXT=['sourceDigest','inventoryDigest','commit','candidateId','artifactSha256','environment','targetId'];
function sameContext(actual,expected){return CONTEXT.every(k=>actual?.[k]===expected[k]);}
export function providerContext(inventory,{commit,candidateId,artifactSha256=null,environment='production',targetId='production'}={}){
  requireThat(/^[a-f0-9]{40}$/.test(commit??'')&&typeof candidateId==='string'&&ID.test(candidateId)&&(artifactSha256===null||HEX.test(artifactSha256))&&['development','staging','production'].includes(environment)&&ID.test(targetId),'PROVIDER_RELEASE_CONTEXT_REQUIRED');
  return {sourceDigest:inventory.sourceDigest,inventoryDigest:providerDigest(inventory),commit,candidateId,artifactSha256,environment,targetId};
}
function payloadSchema(p){
  object(p,['schemaVersion','kind','providerId','driver','context','checkedAt','expiresAt','receiptSha256','accountSha256','mode','checks','disabledFeatures','conditions','approved'],'PROVIDER_EVIDENCE_FIELDS');
  requireThat(p.schemaVersion==='executionkit-provider-proof/v1'&&['verification','owner','vendor','deferral','coverage'].includes(p.kind)&&ID.test(p.providerId??''),'PROVIDER_EVIDENCE_SCHEMA');
  object(p.context,CONTEXT,'PROVIDER_EVIDENCE_CONTEXT');
  requireThat(HEX.test(p.receiptSha256??''),'PROVIDER_RECEIPT_HASH_REQUIRED');
  if(p.kind==='verification')requireThat(ID.test(p.driver??''),'PROVIDER_OBSERVED_DRIVER_REQUIRED');
  if(p.accountSha256!==undefined)requireThat(HEX.test(p.accountSha256),'PROVIDER_ACCOUNT_HASH_REQUIRED');
  if(p.mode!==undefined)requireThat(['external','internal','sandbox','disabled'].includes(p.mode),'PROVIDER_EVIDENCE_MODE');
  if(p.disabledFeatures!==undefined)requireThat(ids(p.disabledFeatures),'PROVIDER_DISABLED_FEATURES');
  if(p.approved!==undefined)requireThat(typeof p.approved==='boolean','PROVIDER_APPROVAL');
  if(p.conditions!==undefined){object(p.conditions,Object.keys(p.conditions),'PROVIDER_CONDITIONS');requireThat(Object.entries(p.conditions).every(([k,v])=>ID.test(k)&&typeof v==='boolean'),'PROVIDER_CONDITIONS');}
  if(p.checks!==undefined){object(p.checks,['configuration','credentials','account','connectivity','delivery','callback','endToEnd','tests','restrictions'],'PROVIDER_CHECK_FIELDS');requireThat(Object.values(p.checks).every(v=>typeof v==='boolean'),'PROVIDER_CHECK_VALUES');}
}
export function verifyProviderProof(envelope,{context,keys=[],now=Date.now()}={}){
  object(envelope,['keyId','payload','signature'],'PROVIDER_SIGNED_ENVELOPE_REQUIRED');payloadSchema(envelope.payload);
  const p=envelope.payload,key=keys.find(k=>k.id===envelope.keyId),role=['verification','coverage'].includes(p.kind)?'verifier':p.kind==='deferral'?'owner':p.kind;
  requireThat(key&&Array.isArray(key.roles)&&key.roles.includes(role),'PROVIDER_TRUSTED_ROLE_REQUIRED');
  requireThat(typeof envelope.signature==='string'&&envelope.signature.length<256&&crypto.verify(null,Buffer.from('executionkit-provider-proof/v1\n'+canonical(p)),key.publicKey,Buffer.from(envelope.signature,'base64')),'PROVIDER_SIGNATURE_INVALID');
  requireThat(sameContext(p.context,context),'PROVIDER_EVIDENCE_CONTEXT_MISMATCH');
  const checked=Date.parse(p.checkedAt),expires=Date.parse(p.expiresAt);
  requireThat(Number.isFinite(checked)&&Number.isFinite(expires)&&checked<=now&&expires>now&&expires>checked&&expires-checked<=MAX_AGE_MS&&now-checked<=MAX_AGE_MS,'PROVIDER_EVIDENCE_EXPIRED');
  return p;
}
function trustedKeys(root){
  const file=process.env.EXECUTIONKIT_PROVIDER_TRUST_FILE;
  if(!file)return [];
  requireThat(path.isAbsolute(file),'PROVIDER_TRUST_PATH_ABSOLUTE');
  const real=fs.realpathSync(file),relative=path.relative(fs.realpathSync(root),real);
  requireThat(relative.startsWith('..'+path.sep)||path.isAbsolute(relative),'PROVIDER_TRUST_MUST_BE_HOST_CONTROLLED');
  requireThat(fs.statSync(real).size<=65536,'PROVIDER_TRUST_TOO_LARGE');
  const value=JSON.parse(fs.readFileSync(real,'utf8'));object(value,['schemaVersion','keys'],'PROVIDER_TRUST_SCHEMA');
  requireThat(value.schemaVersion==='executionkit-provider-trust/v1'&&Array.isArray(value.keys)&&value.keys.length<=100,'PROVIDER_TRUST_SCHEMA');
  for(const key of value.keys){object(key,['id','roles','publicKey'],'PROVIDER_TRUST_KEY');requireThat(ID.test(key.id??'')&&Array.isArray(key.roles)&&key.roles.every(r=>['verifier','owner','vendor'].includes(r))&&crypto.createPublicKey(key.publicKey).asymmetricKeyType==='ed25519','PROVIDER_TRUST_KEY');}
  return value.keys;
}
export function evaluateProviderReadiness(inventory,{discovery,context,evidence=[],keys=[],now=Date.now()}={}){
  validateProviderInventory(inventory);const errors=[],proofErrors=[],proofs=[];
  requireThat(context?.inventoryDigest===providerDigest(inventory)&&context.sourceDigest===inventory.sourceDigest,'PROVIDER_INVENTORY_CONTEXT_MISMATCH');
  if(!discovery?.complete||discovery.sourceDigest!==inventory.sourceDigest)errors.push('PROVIDER_DISCOVERY_STALE');
  const uncovered=(discovery?.findings??[]).filter(f=>!inventory.providers.some(p=>p.discoveryKeys.includes(f.key)));
  if(uncovered.length)errors.push('PROVIDER_DISCOVERY_UNMAPPED');
  for(const e of evidence){try{proofs.push(verifyProviderProof(e,{context,keys,now}));}catch(error){proofErrors.push(error.message);}}
  // A signed, independent coverage review prevents an empty/edited project manifest
  // from certifying absence, downgrading required dependencies or hiding a feature.
  const latest=(items,kind)=>items.filter(p=>p.kind===kind).sort((a,b)=>Date.parse(b.checkedAt)-Date.parse(a.checkedAt)||(a.approved===false?-1:b.approved===false?1:0))[0];
  const coverageStatement=latest(proofs.filter(p=>p.providerId==='inventory'),'coverage');
  const coverage=coverageStatement?.approved===true?coverageStatement:null;
  if(!coverage)errors.push('PROVIDER_INVENTORY_REVIEW_REQUIRED');
  for(const p of proofs){if(p.kind==='verification'&&proofs.some(q=>q!==p&&q.kind===p.kind&&q.providerId===p.providerId&&q.checkedAt===p.checkedAt&&canonical(q)!==canonical(p)))proofErrors.push('PROVIDER_EVIDENCE_CONFLICT');}
  if(proofErrors.length)errors.push('PROVIDER_EVIDENCE_INVALID');
  const rows=[];let blockers=0,deferrals=0,signoffs=0,invalid=errors.length;
  for(const p of inventory.providers){
    const own=proofs.filter(e=>e.providerId===p.id),v=own.filter(e=>e.kind==='verification').sort((a,b)=>Date.parse(b.checkedAt)-Date.parse(a.checkedAt))[0];
    const missingApprovals=p.approvalRoles.filter(role=>latest(own,role)?.approved!==true);
    let required=p.requirement==='required';
    if(p.requirement==='conditional'){
      if(typeof coverage?.conditions?.[p.condition]!=='boolean'){errors.push('PROVIDER_CONDITION_UNVERIFIED');invalid++;required=true;}
      else required=coverage.conditions[p.condition];
    }
    const applies=p.environments.includes(context.environment),c=v?.checks??{};
    const disabled=v?.mode==='disabled'&&c.restrictions===true&&p.features.every(f=>v.disabledFeatures?.includes(f));
    const deferred=applies&&!p.enabled&&p.releaseScope==='features'&&disabled&&latest(own,'deferral')?.approved===true&&p.features.every(f=>latest(own,'deferral').disabledFeatures?.includes(f));
    const checksComplete=p.enabled&&v?.driver===p.driver&&p.implementation==='external'&&['external','sandbox'].includes(v?.mode)&&HEX.test(v.accountSha256??'')&&c.configuration===true&&c.credentials===true&&c.account===true&&c.connectivity===true&&c.tests===true&&c.endToEnd===true&&(!p.deliveryRequired||c.delivery===true)&&(!p.callbackRequired||c.callback===true);
    let status='NOT_DISCOVERED',blocked=false;
    if(!applies)status='NOT_APPLICABLE';
    else if(deferred){status='OWNER_DEFERRED';deferrals++;}
    else if(!required&&!p.enabled&&disabled)status='NOT_APPLICABLE';
    else if(checksComplete&&missingApprovals.length===0&&v?.mode==='external')status=context.environment==='production'?'PRODUCTION_VERIFIED':'SANDBOX_VERIFIED';
    else{
      status=!p.enabled||['mock','stub','disabled','incomplete','internal'].includes(p.implementation)?'BLOCKED':!c.configuration||!c.credentials?'NOT_CONFIGURED':v?.mode==='sandbox'&&checksComplete?'SANDBOX_VERIFIED':'CONFIGURED_UNVERIFIED';
      blocked=required||p.enabled||(!p.enabled&&!disabled);
      if(blocked){blockers++;if(checksComplete&&v?.mode==='external'&&missingApprovals.length)signoffs++;}
    }
    rows.push({id:p.id,status,blocked,requirement:p.requirement,releaseScope:p.releaseScope,configuration:c.configuration===true?'PRESENT':'UNVERIFIED',credentials:c.credentials===true?'PRESENT':'UNVERIFIED',connectivity:c.connectivity===true?'VERIFIED':'UNVERIFIED',endToEnd:c.endToEnd===true?'VERIFIED':'UNVERIFIED',missingApprovals,evidenceStages:{DECLARED:true,IMPLEMENTED:Boolean(coverage)&&p.implementation==='external',CONFIGURED:c.configuration===true,TESTED:c.tests===true,VERIFIED_EXTERNAL:checksComplete===true&&v?.mode==='external',OWNER_APPROVED:latest(own,'owner')?.approved===true},lastSuccessfulCheck:status==='PRODUCTION_VERIFIED'?v.checkedAt:null,features:p.features,journeys:p.journeys,owner:p.owner,nextAction:p.nextAction});
  }
  const ok=invalid===0&&blockers===0;
  const verdict=!ok?(blockers>0&&blockers===signoffs&&invalid===0?'EXTERNAL_SIGNOFF_PENDING':'EXTERNAL_PROVIDER_BLOCKED'):deferrals?'PARTIAL_LAUNCH_APPROVED':'OPERATIONAL_READY';
  return {schemaVersion:'executionkit-provider-gate/v1',status:ok?'PASS':'FAIL',ok,authority:'LAUNCH_OS',verdict,context,errors:[...new Set(errors)],proofErrors:[...new Set(proofErrors)],uncovered,providers:rows,unavailableFeatures:[...new Set(rows.filter(p=>(context.environment==='production'?p.status!=='PRODUCTION_VERIFIED':!['PRODUCTION_VERIFIED','SANDBOX_VERIFIED'].includes(p.status))).flatMap(p=>p.features))],signals:{providerInventoryInvalid:invalid>0,criticalProviderUnreadyCount:blockers,providerEvidenceInvalidCount:proofErrors.length,providerSignoffPendingCount:signoffs,providerDeferredCount:deferrals}};
}
// Derive one target/artifact context for Decision, release, deploy and status.
// A caller cannot replace the configured target by a convenient display label.
export function resolveProviderTargetContext(root,{candidate=null,environment='production'}={}){
  let config={};if(fs.existsSync(path.join(root,'execution.config.json')))config=readJson(root,'execution.config.json');
  const deployment=config.deployment??{};
  let mobile={};if(fs.existsSync(path.join(root,'launch.mobile.json')))mobile=readJson(root,'launch.mobile.json');
  const mobileOrigin=['@host','@local'].includes(mobile.serviceOrigin)?process.env.EXECUTIONKIT_LAUNCH_MOBILE_ORIGIN??null:mobile.serviceOrigin??null;
  if(mobile.serviceOrigin==='@host')requireThat(typeof mobileOrigin==='string'&&mobileOrigin.startsWith('https://'),'PROVIDER_MOBILE_TARGET_REQUIRED');
  const targetId='target-'+providerDigest({environment,target:deployment.target??null,origin:deployment.healthUrl??null,mobileProject:mobile.projectId??null,mobileOrigin});
  let artifactSha256=candidate?.artifactSha256??null;
  if(!artifactSha256&&candidate?.commit){
    const rel=(deployment.artifactRoot??'.executionkit/deployment')+'/artifacts';
    const dir=resolveDerivedPath(root,rel,'provider artifact context');
    if(fs.existsSync(dir)){
      const entries=fs.readdirSync(dir);requireThat(entries.length<=32,'PROVIDER_ARTIFACT_CONTEXT_LIMIT');
      const matches=[];
      for(const entry of entries){
        if(!/^[a-f0-9]{12}-[a-f0-9]{12}$/.test(entry))continue;
        const manifest=readJson(root,rel+'/'+entry+'/manifest.json',16*1024*1024);
        if(manifest.repository?.head===candidate.commit&&Array.isArray(manifest.files))matches.push(providerDigest(manifest.files));
      }
      requireThat(new Set(matches).size<=1,'PROVIDER_ARTIFACT_CONTEXT_AMBIGUOUS');artifactSha256=matches[0]??null;
    }
  }
  return {commit:candidate?.commit,candidateId:candidate?.candidateId,artifactSha256,environment,targetId};
}
export function inspectProviderReadiness(root,{candidate=null,environment='production',targetId=null,boundary='release'}={}){
  try{
    const discovery=discoverExternalServices(root);
    requireThat(fs.existsSync(path.join(root,INVENTORY_PATH)),'PROVIDER_INVENTORY_MISSING');
    const inventory=validateProviderInventory(readJson(root,INVENTORY_PATH));
    requireThat(HEX.test(inventory.sourceDigest??''),'PROVIDER_DISCOVERY_REQUIRED');
    const resolved=resolveProviderTargetContext(root,{candidate,environment});
    requireThat(targetId===null||targetId===resolved.targetId,'PROVIDER_TARGET_MISMATCH');
    const context=providerContext(inventory,resolved);
    const evidencePath='.executionkit/providers/'+providerDigest(context)+'.json';
    const evidenceFile=resolveDerivedPath(root,evidencePath,'provider evidence');
    const evidence=fs.existsSync(evidenceFile)?readJson(root,evidencePath):[];
    requireThat(Array.isArray(evidence)&&evidence.length<=1000,'PROVIDER_EVIDENCE_LIST');
    return {...evaluateProviderReadiness(inventory,{discovery,context,evidence,keys:trustedKeys(root)}),boundary,discovery:{sourceDigest:discovery.sourceDigest,files:discovery.files,bytes:discovery.bytes},evidenceSource:evidencePath};
  }catch(error){return {schemaVersion:'executionkit-provider-gate/v1',status:'FAIL',ok:false,verdict:'EXTERNAL_PROVIDER_BLOCKED',boundary,errors:[/^PROVIDER_[A-Z_]+$/.test(error.message)?error.message:'PROVIDER_INSPECTION_FAILED'],providers:[],signals:{providerInventoryInvalid:true,criticalProviderUnreadyCount:0,providerEvidenceInvalidCount:1,providerSignoffPendingCount:0,providerDeferredCount:0}};}
}
export function assertProviderBoundary(root,options={}){const result=inspectProviderReadiness(root,options);if(!result.ok)throw Error('EXTERNAL_PROVIDER_BLOCKED: '+result.errors.join(','));return result;}
