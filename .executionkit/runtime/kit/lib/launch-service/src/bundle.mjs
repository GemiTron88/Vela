import {stat} from 'node:fs/promises';
import {checksum, runSdkTool} from './apk.mjs';
import {need,integer,sha} from './contracts.mjs';
export async function inspectBundle(path,tools={}) {
  need(tools.bundletool && tools.jarsigner && tools.keytool,'BUNDLE_VERIFIER_REQUIRED');
  const signed=await runSdkTool(tools.jarsigner,['-verify','-verbose','-certs',path]);
  need(/jar verified\./.test(signed)&&!/(unsigned entries|not signed|SignatureException)/i.test(signed),'AAB_SIGNATURE_INVALID');
  const certs=await runSdkTool(tools.keytool,['-printcert','-jarfile',path]);
  const values=[...certs.matchAll(/SHA256:\s*([A-Fa-f0-9:]+)/g)].map(m=>m[1].replaceAll(':','').toLowerCase());
  need(values.length===1&&!/CN=Android Debug/i.test(certs),'AAB_SIGNER_SET_OR_DEBUG');
  const query=async xpath=>(await runSdkTool(tools.java??'java',['-jar',tools.bundletool,'dump','manifest','--bundle='+path,'--xpath='+xpath])).trim();
  const [package_id,code,version,min]=await Promise.all(['/manifest/@package','/manifest/@android:versionCode','/manifest/@android:versionName','/manifest/uses-sdk/@android:minSdkVersion'].map(query));
  need(/^[A-Za-z][\w]*(?:\.[A-Za-z][\w]*)+$/.test(package_id),'INVALID_PACKAGE_ID');
  return {package_id,version_code:integer(Number(code)),version,minimum_android_sdk:integer(Number(min)),signing_sha256:sha(values[0]),debug_signed:false,sha256:await checksum(path),size:(await stat(path)).size,verification:'VERIFIED',format:'aab',verifier:'jarsigner+keytool+bundletool'};
}
