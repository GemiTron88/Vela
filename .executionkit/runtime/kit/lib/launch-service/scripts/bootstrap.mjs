import {generateKeyPairSync,randomBytes} from 'node:crypto';
import {mkdir,writeFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {hash,need,slug} from '../src/contracts.mjs';
const [directory,url,...projects]=process.argv.slice(2);
need(directory&&url&&projects.length,'Usage: node scripts/bootstrap.mjs private-directory https://approved-release-host project-id ...');
const origin=new URL(url);need(origin.protocol==='https:'&&origin.pathname==='/'&&!origin.username&&!origin.password&&!origin.search,'HTTPS_ORIGIN_REQUIRED');
const dir=resolve(directory);need(await stat(dir).then(()=>false,()=>true),'REFUSE_OVERWRITE_EXISTING_CONFIGURATION');
projects.forEach(slug);await mkdir(dir,{recursive:true,mode:0o700});
const keys=generateKeyPairSync('ed25519');await writeFile(join(dir,'manifest-ed25519.key'),keys.privateKey.export({format:'pem',type:'pkcs8'}),{mode:0o600});
const credentials={},principals=[],runnerKeyEnv={};let environment='';
for(const project of projects){
 runnerKeyEnv[project]={runner:`RUNNER_${project.toUpperCase().replaceAll('-','_')}_KEY`};
 const runner=randomBytes(32).toString('hex');environment+=`${runnerKeyEnv[project].runner}=${runner}\n`;credentials[project]={runner_id:'runner',runner_key:runner};
 for(const [role,permissions] of Object.entries({registry:['registry','read'],builder:['build','read'],publisher:['release','read'],reviewer:['approve','read'],client:['updates']})){
  const token=randomBytes(32).toString('hex');credentials[project][role+'_token']=token;principals.push({id:`${project}-${role}`,enabled:true,token_sha256:hash(token),projects:[project],permissions});
 }
}
const config={stateDir:join(dir,'state'),publicUrl:origin.origin,port:8088,manifestKeyPath:join(dir,'manifest-ed25519.key'),manifestKeyId:'manifest-v1',maxArtifactBytes:536870912,maxConcurrentUploads:1,maxProjectStorageBytes:4294967296,minimumFreeDiskBytes:2147483648,allowedHosts:['127.0.0.1:8088',origin.host],allowedOrigins:[],principals,runnerKeyEnv};
await writeFile(join(dir,'service.json'),JSON.stringify(config,null,2)+'\n',{mode:0o600});
await writeFile(join(dir,'secrets.env'),environment,{mode:0o600});await writeFile(join(dir,'operator.credentials.json'),JSON.stringify(credentials,null,2)+'\n',{mode:0o600});
const publicKey=keys.publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('base64');
await writeFile(join(dir,'manifest-public.json'),JSON.stringify({key_id:'manifest-v1',public_key:publicKey},null,2)+'\n',{mode:0o644});
console.log(JSON.stringify({status:'LOCAL_CONFIGURATION_CREATED',config:join(dir,'service.json'),public_key:publicKey,apk_signing_keys:'NOT_CREATED',deployment:'NOT_PERFORMED'}));
