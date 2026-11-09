import {need,commit,slug,hash,canonical} from './contracts.mjs';
const project=slug(process.env.RELEASE_PROJECT), source=commit(process.env.RELEASE_COMMIT);
const kind=process.env.RELEASE_KIND??'verify';need(['verify','apk'].includes(kind),'PATCH_USES_SIGNED_PROVIDER_PIPELINE');
const base=process.env.MOBILE_RELEASE_URL;need(base?.startsWith('https://'),'HTTPS_REQUIRED');
const body={commit:source,kind};
const response=await fetch(`${base}/v1/projects/${project}/jobs`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${process.env.MOBILE_RELEASE_TOKEN}`,'Content-Type':'application/json','Idempotency-Key':hash(canonical({project,...body}))},body:JSON.stringify(body)});
need(response.ok,'BUILD_SUBMISSION_REJECTED');console.log(JSON.stringify(await response.json()));
