// Supply an authenticated, read-only test-environment endpoint, or replace
// this probe with the project's real deployment/device identity producer.
const url=process.env.EXECUTIONKIT_E2E_ENVIRONMENT_URL;
if(!url)throw new Error('EXECUTIONKIT_E2E_ENVIRONMENT_URL is required; a configured revision is not runtime proof');
const response=await fetch(url,{signal:AbortSignal.timeout(5000),headers:process.env.EXECUTIONKIT_E2E_ENVIRONMENT_TOKEN?{Authorization:'Bearer '+process.env.EXECUTIONKIT_E2E_ENVIRONMENT_TOKEN}:{}});
if(!response.ok)throw new Error('Environment probe failed: '+response.status);
const observed=await response.json();
if(!observed.identity||!observed.revision||!Array.isArray(observed.targets))throw new Error('Environment lacks real identity/revision/device-role evidence');
console.log(JSON.stringify({runId:process.env.EXECUTIONKIT_E2E_RUN_ID,identity:observed.identity,revision:observed.revision,targets:observed.targets}));
