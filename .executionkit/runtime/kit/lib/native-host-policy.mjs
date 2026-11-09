import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const denied=['/etc/gemitron-mobile-disabled','/usr/local/cwp','/usr/local/cwpsrv','/etc/cwp','/.dockerenv','/run/.containerenv'];
const virtual=/virtual|vmware|kvm|qemu|xen|amazon|google compute|digitalocean|openstack|hetzner|bochs|bhyve|parallels/i;
const read=(p)=>{try{return fs.readFileSync(p,'utf8').trim();}catch{return '';}};
const query=(command,args)=>spawnSync(command,args,{encoding:'utf8',timeout:5000,windowsHide:true});
export function nativeHostObservation(){
  let identity='',physical=false,blocked=denied.some(p=>fs.existsSync(p));
  const system={linux:'Linux',win32:'Windows',darwin:'Darwin'}[process.platform]??process.platform;
  if(process.platform==='linux'){
    const parts=['sys_vendor','product_name','product_uuid'].map(n=>read('/sys/class/dmi/id/'+n));identity=parts.join('|');
    const result=query('systemd-detect-virt',[]);
    physical=result.status===1&&String(result.stdout??'').trim()==='none'&&parts.every(Boolean);blocked||=result.status===0;
  }else if(process.platform==='win32'){
    const result=query('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$c=Get-CimInstance Win32_ComputerSystem;$b=Get-CimInstance Win32_BIOS;Write-Output ($c.Manufacturer+'|'+$c.Model+'|'+$b.SerialNumber)"]);
    identity=result.status===0?result.stdout.trim():'';physical=identity.split('|').length===3&&identity.split('|').every(Boolean);
  }else if(process.platform==='darwin'){
    const result=query('ioreg',['-rd1','-c','IOPlatformExpertDevice']);identity=result.status===0?result.stdout.trim():'';
    physical=identity.includes('IOPlatformUUID')&&identity.includes('IOPlatformSerialNumber');
  }
  blocked||=virtual.test(identity);
  return {physical:physical&&!blocked,blocked,fingerprint:createHash('sha256').update(system+'\n'+identity).digest('hex')};
}
export function evaluateNativeHost(observed,policy){
  if(observed.blocked)throw Error('VPS_NATIVE_MOBILE_FORBIDDEN');
  if(!observed.physical)throw Error('PHYSICAL_WORKSTATION_NOT_VERIFIED');
  if(!policy||policy.schema!==1||policy.role!=='physical-workstation'||policy.fingerprint!==observed.fingerprint||Object.keys(policy).sort().join(',')!=='fingerprint,role,schema')throw Error('OWNER_WORKSTATION_ENROLLMENT_REQUIRED');
}
export function readWorkstationPolicy(){
  const file=process.platform==='win32'?path.join(process.env.LOCALAPPDATA??path.join(os.homedir(),'AppData','Local'),'GemiTronAgent','host-policy.json'):path.join(os.homedir(),'.config','gemitron-agent','host-policy.json');
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}
}
export function requireNativeWorkstation({observed=nativeHostObservation(),policy=readWorkstationPolicy()}={}){
  evaluateNativeHost(observed,policy);
  return {observed,policy};
}
export function isNativeMobileCommand(command,args=[]){
  const tokens=[command,...args].map(String);
  return tokens.some((token)=>/^(?:flutter|dart|gradle|gradlew|sdkmanager|avdmanager|emulator|shorebird)(?:\.(?:exe|bat|cmd))?$/i.test(path.win32.basename(token)))
    || tokens.some(token=>/(?:^|[\\/])(?:provision|emulator|runner|provider_runner)\.py$/i.test(token))
    || tokens.some(token=>/^(?:android|mobile):(build|emulator|provision)$|^(?:build|install):(apk|aab|android|emulator)$/i.test(token));
}
export function assertNativeCommandHost(command,args=[]){if(isNativeMobileCommand(command,args))requireNativeWorkstation();}
