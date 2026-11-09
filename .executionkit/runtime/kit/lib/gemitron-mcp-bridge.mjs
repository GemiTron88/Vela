// Interim owner-only MCP compatibility. Never claim remote GemiMCP handshake.
import fs from 'node:fs';
import path from 'node:path';
export function gemitronMcpBridgeStatus(root,{env=process.env}={}){
 const file=path.join(path.resolve(root),'launch.mobile.json');
 let configured=false,projectId=null,mobileUpdateStrategy='SIGNED_APK';
 try{
  const st=fs.lstatSync(file);
  if(st.isFile()&&!st.isSymbolicLink()&&st.size<=16384){
   const cfg=JSON.parse(fs.readFileSync(file,'utf8'));
   configured=cfg.schemaVersion==='executionkit-launch-mobile/v1'&&typeof cfg.projectId==='string';
   if(configured){
    projectId=cfg.projectId;
    if(['SIGNED_APK','SHOREBIRD_OPTIONAL'].includes(cfg.mobileUpdateStrategy))mobileUpdateStrategy=cfg.mobileUpdateStrategy;
   }
  }
 }catch{}
 return {schemaVersion:'executionkit-gemitron-mcp-bridge/v1',status:configured?'CONFIGURED_UNVERIFIED':'PROJECT_MOBILE_CONFIG_REQUIRED',
 scope:'LOCAL_PROJECT_ONLY',transport:'stdio',platform:'GEMITRON_MCP_INTERIM',projectId,authority:'EXECUTIONKIT_LAUNCH_OS_ONLY',
 executionModel:'LOCAL_WORKSTATION_DIRECT',mobileUpdateStrategy,buildAgentRequired:false,shorebirdRequired:false,remoteToLocalBuildDelegation:'DISABLED',remoteGemiMcpConnected:false,
 shorebird:{provider:'OPTIONAL',required:false,tooling:'NOT_PROBED',account:'NOT_VERIFIED',hostOriginPinned:typeof env.EXECUTIONKIT_LAUNCH_MOBILE_ORIGIN==='string'&&env.EXECUTIONKIT_LAUNCH_MOBILE_ORIGIN.startsWith('https://'),
 scopedApiTokenPresent:typeof env.EXECUTIONKIT_LAUNCH_MOBILE_TOKEN==='string'&&env.EXECUTIONKIT_LAUNCH_MOBILE_TOKEN.length>=16,
 providerTokenPresent:Boolean(env.SHOREBIRD_TOKEN)},
 limitations:['GemiMCP repository/service handshake unavailable','Launch OS remains sole publisher','Remote-to-local mobile build delegation is disabled; run local mobile builds directly on the physical workstation','Real provider and device acceptance still required']};
}

