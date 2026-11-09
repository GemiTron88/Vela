import {readFile,mkdir,writeFile,open} from 'node:fs/promises';
import {join} from 'node:path';
import {createHmac} from 'node:crypto';
import {patchPipeline,shorebirdCommand,providerRun,signedApproval,verifiedQuality} from './shorebird.mjs';
import {need,canonical,hash} from './contracts.mjs';
const [action,projectFile,inputFile]=process.argv.slice(2);
if(['patch','release','promote','rollback'].includes(action)){
  const {execFileSync}=await import('node:child_process');
  const {fileURLToPath}=await import('node:url');
  execFileSync(process.env.MOBILE_PYTHON_EXECUTABLE??(process.platform==='win32'?'python':'python3'),[fileURLToPath(new URL('../scripts/host_policy.py',import.meta.url))],{stdio:['ignore','pipe','pipe'],timeout:20000,windowsHide:true});
}
need(projectFile && inputFile,'Usage: node src/provider-cli.mjs patch|release|promote|rollback|history|usage project.json input.json');
const p=JSON.parse(await readFile(projectFile)),input=JSON.parse(await readFile(inputFile));
await mkdir(input.evidence_dir,{recursive:true,mode:0o700});
let result;
const run=(args,cwd,log)=>providerRun(args,cwd,log,3600000,p.signing_env??[]);
// A provider may publish before a socket/process failure. Never repeat blindly.
let marker;
if(['patch','release','promote','rollback'].includes(action)) {
  const identity=hash(canonical({project:p.id,action,commit:input.commit??null,release:input.release_version,patch:input.patch_number??null,track:input.track??null}));
  need(input.operation_state_dir,'PROTECTED_OPERATION_STATE_DIRECTORY_REQUIRED');
  await mkdir(input.operation_state_dir,{recursive:true,mode:0o700});
  marker=await open(join(input.operation_state_dir,identity+'.json'),'wx',0o600).catch(()=>{throw Error('PROVIDER_OPERATION_ALREADY_STARTED; read back official history before operator recovery');});
  await marker.writeFile(canonical({project:p.id,action,status:'STARTED_UNKNOWN_UNTIL_READBACK',at:new Date().toISOString()}));await marker.sync();await marker.close();
}
if(action==='patch')result=await patchPipeline(p,input,run);
else if(action==='usage'){
  need(process.env.SHOREBIRD_TOKEN,'SHOREBIRD_TOKEN_REQUIRED');
  need(/^[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/.test(p.shorebird_app_id??''),'SHOREBIRD_APP_NOT_REGISTERED');
  const url=`https://api.shorebird.dev/api/v1/apps/${p.shorebird_app_id}/metrics/patch-installs`;
  const response=await fetch(url,{headers:{Authorization:`Bearer ${process.env.SHOREBIRD_TOKEN}`},redirect:'error',signal:AbortSignal.timeout(30000)});
  need(response.ok,'SHOREBIRD_USAGE_UNAVAILABLE');
  result={project:p.id,status:'OBSERVED',source:url,observed_at:new Date().toISOString(),patch_installs:await response.json(),billing_remaining:'UNKNOWN'};
}else{
  if(['release','promote','rollback'].includes(action)){
    need(process.env.MOBILE_RELEASE_APPROVAL_KEY?.length>=32,'APPROVAL_KEY_REQUIRED');
    const approval=await signedApproval(input.approval_path,process.env.MOBILE_RELEASE_APPROVAL_KEY,{project:p.id,action:`shorebird.${action}`,release_version:input.release_version,...(action==='release'?{commit:input.commit}:{patch_number:input.patch_number}),...(action==='promote'?{track:input.track}:{})});
    if(action==='release') {
      need(approval.billing_reviewed===true && approval.automatic_overages_allowed===false && approval.account_evidence_sha256,'BILLING_REVIEW_REQUIRED');
      need(p.signing_sha256,'SIGNING_CONTINUITY_UNKNOWN');
      await verifiedQuality(p,input,['analyze','unit','widget','apk_build','apk_signature']);
    }
    if(action==='promote'){
      const receipt=JSON.parse(await readFile(input.device_receipt_path));
      await signedApproval(input.device_receipt_path,process.env.MOBILE_RELEASE_DEVICE_EVIDENCE_KEY,{project:p.id,action:'patch.device-validation',release_version:input.release_version,patch_number:input.patch_number,status:'PASS'});
      need(receipt.payload.gates?.includes('restart_applies_patch'),'PATCH_DEVICE_EVIDENCE_REQUIRED');
    }
  }
  result=await run(shorebirdCommand(action,p,input),input.workspace,join(input.evidence_dir,`shorebird-${action}.log`));
}
const event={schema:1,project:p.id,action,observed_at:new Date().toISOString(),result};
await writeFile(join(input.evidence_dir,`provider-${action}-${Date.now()}.json`),canonical(event)+'\n',{mode:0o600});
if(process.env.MOBILE_RELEASE_RUNNER_KEY?.length>=32){
  const payload={project:p.id,runner_id:process.env.MOBILE_RELEASE_RUNNER_ID??'runner',action,provider_app_id:p.shorebird_app_id,finished_at:event.observed_at,exit_code:0,evidence_sha256:hash(canonical(event)),confidence:'OBSERVED',...(input.commit?{commit:input.commit}:{}),...(input.release_version?{release_version:input.release_version}:{}),...(input.patch_number?{patch_number:input.patch_number}:{}),...(input.track?{track:input.track}:{})};
  await writeFile(join(input.evidence_dir,'provider-receipt.json'),canonical({payload,signature:createHmac('sha256',process.env.MOBILE_RELEASE_RUNNER_KEY).update(canonical(payload)).digest('hex')})+'\n',{mode:0o600});
}
console.log(JSON.stringify({status:'COMMAND_SUCCEEDED',action,receipt_sha256:hash(canonical(event)),production_acceptance:'REQUIRES_READBACK_AND_DEVICE_EVIDENCE'}));
