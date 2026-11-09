import {readFile,mkdir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {need,slug} from './contracts.mjs';
need(process.platform !== 'win32', 'WINDOWS_NATIVE_SUPERVISOR_NOT_INSTALLED');
const path=process.argv[2]; need(path,'WORKER_CONFIG_REQUIRED');
const config=JSON.parse(await readFile(path)); slug(config.worker_id);
need(config.require_enrollment === undefined || typeof config.require_enrollment === 'boolean','WORKER_ENROLLMENT_MODE_INVALID');
if(config.require_enrollment === true){
  need(process.env.MOBILE_RELEASE_RUNNER_ID === config.worker_id,'ENROLLED_RUNNER_ID_MISMATCH');
}
const token=process.env.MOBILE_RELEASE_TOKEN; need(token,'WORKER_TOKEN_REQUIRED');
need(/^https:\/\//.test(config.service_url)||/^http:\/\/127\.0\.0\.1:\d+$/.test(config.service_url),'HTTPS_REQUIRED');

if(config.require_enrollment === true){
  const probe=await fetch(config.service_url+'/v1/capabilities',{
    method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{Authorization:'Bearer '+token,Accept:'application/json'}
  });
  need(probe.ok,'ENROLLED_SERVICE_UNAVAILABLE');
  const service=await probe.json();
  need(service.agent_enrollment_enforced === true && service.arbitrary_shell === false,
    'ENROLLED_SERVICE_MODE_NOT_ACTIVE');
}
let stopping=false, child=null;
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{stopping=true;child?.kill('SIGTERM');});
async function api(project,route,body) {
  const response=await fetch(`${config.service_url}/v1/projects/${project}/${route}`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${token}`,'Idempotency-Key':randomUUID(),'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json();need(response.ok,data.error?.code??'SERVICE_ERROR',response.status);return data;
}
let retryFailures=0;
while(!stopping){
  try{
  for(const [project,mapping] of Object.entries(config.projects)){
    if(stopping)break;slug(project);
    const claim=await api(project,'jobs/claim',{worker_id:config.worker_id}); if(!claim.job)continue;
    const generation=claim.lease_generation;
    if(config.require_enrollment === true)need(Number.isSafeInteger(generation)&&generation>0,'ENROLLED_LEASE_REQUIRED');
    const job=claim.job; const evidence=join(resolve(config.evidence_root),project,job.id);await mkdir(evidence,{recursive:true,mode:0o700});
    let leaseLost=false;
    const heartbeat=setInterval(()=>api(project,`jobs/${job.id}`,{worker_id:config.worker_id,state:'RUNNING',...(generation?{lease_generation:generation}:{})}).catch(()=>{leaseLost=true;child?.kill('SIGTERM');}),30000);
    try{
      need(job.kind!=='patch','PATCH_JOB_REQUIRES_EXPLICIT_SHOREBIRD_OPERATOR_PIPELINE');
      const args=[resolve('scripts/runner.py'),'--project',resolve(mapping.runner_config),'--repository',resolve(mapping.repository),'--commit',job.commit,'--job-id',job.id,'--evidence',evidence,'--work-root',resolve(config.work_root)];
      if(generation)args.push('--lease-generation',String(generation));
      if(job.kind==='apk'){need(mapping.signing_approval_dir,'SIGNING_APPROVAL_REQUIRED');args.push('--apk','--signing-approval',join(resolve(mapping.signing_approval_dir),`${job.commit}.json`));}
      const code=await new Promise((done,reject)=>{child=spawn('python3',args,{stdio:['ignore','inherit','inherit'],env:process.env});child.on('error',reject);child.on('close',done);});
      need(code===0 && !leaseLost,'BUILD_FAILED_OR_LEASE_LOST');
      const receipt=JSON.parse(await readFile(join(evidence,'receipt.json')));
      if(job.kind==='apk'){
        const digest=receipt.payload.artifact_sha256;
        const response=await fetch(`${config.service_url}/v1/projects/${project}/artifacts/${digest}`,{method:'PUT',duplex:'half',redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream'},body:createReadStream(join(evidence,`${digest}.apk`)),signal:AbortSignal.timeout(120000)});
        need(response.ok,'ARTIFACT_UPLOAD_REJECTED');
      }
      await api(project,'receipts',receipt); await api(project,`jobs/${job.id}`,{worker_id:config.worker_id,state:'SUCCEEDED',...(generation?{lease_generation:generation}:{})});
    }catch(error){console.error(JSON.stringify({project,job_id:job.id,status:'FAILED',code:error.code??'RUNNER_FAILURE'}));if(!leaseLost)await api(project,`jobs/${job.id}`,{worker_id:config.worker_id,state:'FAILED',...(generation?{lease_generation:generation}:{})}).catch(()=>{});}
    finally{clearInterval(heartbeat);child=null;}
  }
  retryFailures=0;
  } catch(error) {
    if(error?.status === 401 || error?.status === 403) {
      console.error(JSON.stringify({status:'BLOCKED',code:'WORKER_AUTHORIZATION_REVOKED'}));
      stopping=true;
      process.exitCode=1;
    } else {
      retryFailures=Math.min(retryFailures+1,5);
      console.error(JSON.stringify({status:'OFFLINE_RETRY',code:'CONTROL_PLANE_UNREACHABLE',attempt:retryFailures}));
    }
  }
  if(!stopping)await new Promise(r=>setTimeout(r,Math.min(120000,10000*2**retryFailures)));
}
