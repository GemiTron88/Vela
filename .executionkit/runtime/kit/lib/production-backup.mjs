import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';
import { spawn } from 'node:child_process';
import { resolvePortableInvocation, spawnPortableSync } from './portable-process.mjs';

function databaseTargetHash(c){
  if(typeof c.host!=='string'||!c.host||!c.port||typeof c.database!=='string'||typeof c.user!=='string')throw new Error('Unsupported production database target');
  return crypto.createHash('sha256').update(JSON.stringify({host:c.host,port:String(c.port),database:c.database,user:c.user})).digest('hex');
}
export function verifyLaravelProductionRuntime(releaseDir,cfg,backup){
  if(!cfg.requireBackupBeforeActivate)return {status:'NOT_REQUIRED'};
  const php=String.raw`require $argv[1].'/vendor/autoload.php'; $app=require $argv[1].'/bootstrap/app.php'; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); $c=$app['db']->connection()->getConfig(); echo json_encode(['environment'=>$app->environment(),'debug'=>(bool)config('app.debug'),'driver'=>$c['driver']??'','host'=>$c['host']??'','port'=>$c['port']??'','database'=>$c['database']??'','user'=>$c['username']??'']);`;
  const read=spawnPortableSync('php',['-r',php,releaseDir],{cwd:releaseDir,encoding:'utf8',timeout:30000,maxBuffer:65536}).result;
  if(read.error||read.status!==0)throw new Error('Unable to verify resolved production Laravel configuration');
  let c;try{c=JSON.parse(read.stdout);}catch{throw new Error('Resolved Laravel configuration is invalid');}
  if(c.environment!=='production'||c.debug!==false||!['mysql','mariadb'].includes(c.driver)||c.database!==cfg.backupDatabase||databaseTargetHash(c)!==backup.databaseTargetHash)throw new Error('Resolved Laravel environment/database does not match the production backup target');
  return {status:'PASS',database:c.database,environment:c.environment,debug:false};
}

export async function prepareProductionBackup(root,cfg,head,{authorized=false}={}){
  if(!authorized)throw new Error('Production backup requires explicit authorization');
  if(!cfg.requireBackupBeforeActivate||!cfg.backupDatabase||!path.isAbsolute(cfg.backupReceiptPath??''))throw new Error('Production backup policy is unconfigured');
  const runtime=path.resolve(root,cfg.sourceRoot??'.'),envFile=cfg.sharedLinks?.find(item=>item.releasePath==='.env')?.target;
  if(!envFile||!path.isAbsolute(envFile)||!fs.lstatSync(envFile).isFile()||fs.lstatSync(envFile).isSymbolicLink())throw new Error('Production shared environment must be a real file');
  const php=String.raw`require $argv[1].'/vendor/autoload.php'; $e=Dotenv\Dotenv::createArrayBacked(dirname($argv[2]),basename($argv[2]))->load(); $c=['driver'=>!empty($e['DB_CONNECTION'])?$e['DB_CONNECTION']:'mysql','host'=>!empty($e['DB_HOST'])?$e['DB_HOST']:'127.0.0.1','port'=>!empty($e['DB_PORT'])?$e['DB_PORT']:'3306','database'=>$e['DB_DATABASE']??'','user'=>$e['DB_USERNAME']??'','password'=>$e['DB_PASSWORD']??'']; if(!empty($e['DB_URL'])){$u=parse_url($e['DB_URL']);$c=['driver'=>$u['scheme']??'','host'=>$u['host']??'','port'=>$u['port']??3306,'database'=>rawurldecode(ltrim($u['path']??'','/')),'user'=>rawurldecode($u['user']??''),'password'=>rawurldecode($u['pass']??'')];} echo json_encode($c);`;
  const read=spawnPortableSync('php',['-r',php,runtime,envFile],{cwd:runtime,encoding:'utf8',timeout:30000,maxBuffer:65536}).result;
  if(read.error||read.status!==0)throw new Error('Unable to read production DB settings through the installed PHP dotenv runtime');
  let credentials;try{credentials=JSON.parse(read.stdout);}catch{throw new Error('Production DB settings are invalid');}
  if(!['mysql','mariadb'].includes(credentials.driver)||credentials.database!==cfg.backupDatabase||!/^[A-Za-z0-9_-]+$/.test(credentials.database)||!credentials.user)throw new Error('Production database identity mismatch');
  const folder=path.dirname(cfg.backupReceiptPath);fs.mkdirSync(folder,{recursive:true,mode:0o700});
  if(fs.realpathSync(folder)!==path.resolve(folder))throw new Error('Backup folder may not traverse symlinks');
  const file=path.join(folder,`${cfg.backupDatabase}-${head.slice(0,12)}-${Date.now()}.sql.gz`),temporary=file+'.tmp';
  const invocation=resolvePortableInvocation('mysqldump',['--single-transaction','--no-tablespaces','--quick','--routines','--triggers','--events',`--host=${credentials.host}`,`--port=${credentials.port}`,`--user=${credentials.user}`,'--databases',credentials.database]);
  const child=spawn(invocation.command,invocation.args,{cwd:runtime,shell:false,stdio:['ignore','pipe','pipe'],env:{...process.env,MYSQL_PWD:credentials.password}});
  // Consume stderr without exposing credentials or database contents in receipts.
  child.stderr.resume();
  const completion=new Promise((resolve,reject)=>{child.once('error',()=>reject(new Error('Production mysqldump is unavailable')));child.once('close',code=>code===0?resolve():reject(new Error('Production mysqldump failed')));});
  const timeout=setTimeout(()=>child.kill(),1200000);
  try{
    await Promise.all([completion,pipeline(child.stdout,zlib.createGzip(),fs.createWriteStream(temporary,{flags:'wx',mode:0o600}))]);
    fs.renameSync(temporary,file);
    const hash=crypto.createHash('sha256');await pipeline(fs.createReadStream(file),new Writable({write(chunk,_encoding,callback){hash.update(chunk);callback();}}));
    const receipt={schemaVersion:'executionkit-backup-receipt/v1',status:'PASS',head,database:credentials.database,databaseTargetHash:databaseTargetHash(credentials),createdAt:new Date().toISOString(),file,sha256:hash.digest('hex')};
    const tempReceipt=cfg.backupReceiptPath+`.tmp-${process.pid}`;fs.writeFileSync(tempReceipt,JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
    const verified=await verifyProductionBackup({...cfg,backupReceiptPath:tempReceipt},{repository:{head}});
    fs.renameSync(tempReceipt,cfg.backupReceiptPath);return {...verified,receiptPath:cfg.backupReceiptPath};
  }catch(error){child.kill();if(fs.existsSync(temporary))fs.unlinkSync(temporary);throw error;}
  finally{clearTimeout(timeout);}
}

export async function verifyProductionBackup(cfg,manifest){
  if(cfg.requireBackupBeforeActivate!==true)return {status:'NOT_REQUIRED'};
  const receiptFile=cfg.backupReceiptPath;
  if(typeof receiptFile!=='string'||!path.isAbsolute(receiptFile))throw new Error('A production backup receipt path is required before activation');
  const stat=fs.lstatSync(receiptFile,{throwIfNoEntry:false});
  if(!stat?.isFile()||stat.isSymbolicLink()||stat.size>65536)throw new Error('Production backup receipt is absent or unsafe');
  const receipt=JSON.parse(fs.readFileSync(receiptFile,'utf8'));
  if(receipt.schemaVersion!=='executionkit-backup-receipt/v1'||receipt.status!=='PASS'||receipt.head!==manifest.repository.head||receipt.database!==cfg.backupDatabase||!cfg.backupDatabase)throw new Error('Production backup receipt does not match the exact candidate/database');
  const age=Date.now()-Date.parse(receipt.createdAt);
  if(!Number.isFinite(age)||age<0||age>3600000)throw new Error('Production backup receipt must be fresh within one hour');
  if(typeof receipt.file!=='string'||!path.isAbsolute(receipt.file)||path.dirname(receipt.file)!==path.dirname(receiptFile)||!receipt.file.endsWith('.sql.gz'))throw new Error('Backup dump must be a sibling SQL gzip file');
  const dumpStat=fs.lstatSync(receipt.file);
  if(!dumpStat.isFile()||dumpStat.isSymbolicLink()||dumpStat.size===0||fs.realpathSync(receipt.file)!==path.resolve(receipt.file))throw new Error('Production backup dump is unsafe or empty');
  const hash=crypto.createHash('sha256');
  await pipeline(fs.createReadStream(receipt.file),new Writable({write(chunk,_encoding,callback){hash.update(chunk);callback();}}));
  if(hash.digest('hex')!==receipt.sha256)throw new Error('Production backup checksum mismatch');
  let bytes=0;
  await pipeline(fs.createReadStream(receipt.file),zlib.createGunzip(),new Writable({write(chunk,_encoding,callback){bytes+=chunk.length;callback();}}));
  if(bytes===0)throw new Error('Production backup contains no SQL bytes');
  return {status:'PASS',database:receipt.database,databaseTargetHash:receipt.databaseTargetHash??null,createdAt:receipt.createdAt,head:receipt.head,receiptPath:receiptFile,bytes:dumpStat.size,sqlBytes:bytes};
}
