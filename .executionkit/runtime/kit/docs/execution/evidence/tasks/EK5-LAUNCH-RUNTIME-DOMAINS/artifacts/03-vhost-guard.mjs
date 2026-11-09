import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnBoundedSync} from './bounded-process.mjs';
import {resolveProjectPathSafe} from './derived-state.mjs';

const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const absolute=value=>typeof value==='string'&&path.isAbsolute(value)&&!/[\r\n\0]/.test(value);
function read(file){if(!absolute(file)||!fs.statSync(file).isFile()||fs.statSync(file).size>1048576)throw Error('VHOST_CONFIG_FILE_INVALID');return fs.readFileSync(file,'utf8');}
function tokens(text){
  const out=[];let word='',quote=null;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quote){if(c==='\\'&&i+1<text.length&&text[i+1]===quote)word+=text[++i];else if(c===quote)quote=null;else word+=c;continue;}
    if(c==='"'||c==="'"){quote=c;continue;}
    if(c==='#'){while(i<text.length&&text[i]!=='\n')i++;}
    if(/[\s;{}]/.test(c)||c==='#'){if(word){out.push(word);word='';}if(/[;{}]/.test(c))out.push(c);}else word+=c;
  }
  if(quote)throw Error('VHOST_UNSUPPORTED_QUOTE');if(word)out.push(word);return out;
}
function directives(list,{top=false}={}){
  const out=[];let row=[],depth=0;
  for(const token of list){if(token==='{'){depth++;row=[];}else if(token==='}'){depth--;row=[];}else if(token===';'){if(!top||depth===0)out.push(row);row=[];}else row.push(token);}
  return out;
}
function nginxBlocks(text){
  const list=tokens(text),out=[];
  for(let i=0;i<list.length;i++)if(list[i]==='server'&&list[i+1]==='{'){
    let end=i+2,depth=1;for(;end<list.length&&depth;end++){if(list[end]==='{')depth++;if(list[end]==='}')depth--;}
    if(depth)throw Error('VHOST_UNBALANCED_CONFIG');out.push(list.slice(i+2,end-1));i=end-1;
  }
  return out;
}
function expandIncludes(list,files,base,seen=new Set()){
  let output=[...list];
  for(const row of directives(list))if(row[0]==='include'){
    if(row.length!==2||seen.size>=64)throw Error('VHOST_INCLUDE_UNVERIFIABLE');
    const include=(absolute(row[1])?row[1]:path.resolve(base,row[1])).replaceAll('\\','/');
    const re=new RegExp('^'+include.split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$');
    const matches=[...files.keys()].filter(file=>re.test(file.replaceAll('\\','/')));if(!matches.length)throw Error('VHOST_INCLUDE_UNVERIFIABLE');
    for(const file of matches){if(seen.has(file))throw Error('VHOST_INCLUDE_CYCLE');const next=new Set(seen);next.add(file);output.push(...expandIncludes(tokens(files.get(file)),files,base,next));}
  }
  return output;
}
function normalizedDomain(value){if(typeof value!=='string'||! /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/i.test(value)||value.includes('..'))throw Error('VHOST_DOMAIN_INVALID');return value.toLowerCase();}

export function vhostPolicyFingerprint(deployment){return sha(JSON.stringify({policy:deployment.vhost,currentLink:deployment.target?.currentLink,publicLink:deployment.target?.publicLink,attestationUrl:deployment.attestationUrl}));}

export function inspectVhostGuard(root,{config=null,run=spawnBoundedSync}={}){
  const loaded=config??JSON.parse(fs.readFileSync(resolveProjectPathSafe(root,'execution.config.json','vhost project config',{file:true}),'utf8'));
  const deployment=loaded.deployment??{},policy=deployment.vhost;
  const source=deployment.sourceRoot&&deployment.sourceRoot!=='.'?resolveProjectPathSafe(root,deployment.sourceRoot,'vhost application source'):path.resolve(root);
  const laravel=fs.existsSync(path.join(source,'artisan'))&&fs.existsSync(path.join(source,'composer.json'));
  const required=(policy?.enabled!==false)&&(Boolean(policy)||/^[45]\./.test(String(loaded.standardVersion))&&laravel&&deployment.enabled!==false&&deployment.target?.type==='local-release-root');
  if(!required)return {schemaVersion:'executionkit-vhost-guard/v1',status:'NOT_APPLICABLE',ok:true,required:false,scope:'CONFIGURED_DISK',findings:[]};
  const findings=[],checks=[];const fail=(code,extra={})=>findings.push({code,severity:'HIGH',...extra});
  try{
    if(!policy||policy.enabled===false)throw Error('VHOST_POLICY_REQUIRED');
    if(!absolute(deployment.target?.currentLink))throw Error('VHOST_CURRENT_LINK_REQUIRED');
    const expectedRoot=path.join(deployment.target.currentLink,'public'),alias=deployment.target.publicLink;
    const rootMatches=value=>{
      if(!absolute(value))return false;
      if(path.resolve(value)===expectedRoot)return true;
      if(alias&&path.resolve(value)===path.resolve(alias)){
        const stat=fs.lstatSync(alias);return stat.isSymbolicLink()&&path.resolve(path.dirname(alias),fs.readlinkSync(alias))===expectedRoot;
      }
      return false;
    };
    if(!Array.isArray(policy.domains)||!policy.domains.length||policy.domains.length>30)throw Error('VHOST_DOMAINS_REQUIRED');
    const domains=[...new Set(policy.domains.map(normalizedDomain))];
    if(!Array.isArray(policy.engines)||!policy.engines.length||policy.engines.length>3)throw Error('VHOST_ENGINES_REQUIRED');
    const deadline=Date.now()+15000,seen=new Set(),engineRoots=new Map(),proxyChecks=[];
    const observe=(engine,args)=>{
      const binary=engine.binary??(engine.type==='apache'?'httpd':'nginx');
      if(!(engine.type==='apache'?/^(?:httpd|apachectl|apache2|apache2ctl)(?:\.exe)?$/i:/^nginx(?:\.exe)?$/i).test(path.basename(binary)))throw Error('VHOST_BINARY_INVALID');
      const remaining=deadline-Date.now();if(remaining<=0)throw Error('VHOST_PROBE_TIMEOUT');
      const value=run(binary,args,{cwd:root,timeoutMs:remaining,maxBuffer:2*1024*1024});
      if(value.error||value.status!==0)throw Error(value.timedOut?'VHOST_PROBE_TIMEOUT':'VHOST_NATIVE_CONFIG_UNVERIFIED');
      return String(value.stdout??'')+'\n'+String(value.stderr??'');
    };
    const accept=(engine,domain,port,roots,redirect=false,proxy=false)=>{
      if(roots.some(value=>!rootMatches(value)))fail('VHOST_DOCUMENT_ROOT_DRIFT',{engine:engine.type,domain,port,expectedRoot,observedRoots:roots});
      if(!roots.length&&!redirect&&!proxy)fail('VHOST_DOCUMENT_ROOT_UNVERIFIABLE',{engine:engine.type,domain,port});
      if(roots.length&&roots.every(rootMatches))engineRoots.set(engine.type+':'+domain+':'+port,true);
      checks.push({engine:engine.type,domain,port,status:roots.some(value=>!rootMatches(value))||!roots.length&&!redirect&&!proxy?'FAIL':'PASS',mode:redirect?'HTTPS_REDIRECT':proxy?'DECLARED_PROXY':'DOCUMENT_ROOT'});
      seen.add(domain+':'+port);
    };
    for(const engine of policy.engines){
      if(!['apache','nginx'].includes(engine.type))throw Error('VHOST_ENGINE_UNSUPPORTED');
      const ports=engine.ports??[80,443];if(!Array.isArray(ports)||!ports.length||ports.some(p=>!Number.isInteger(p)||p<1||p>65535))throw Error('VHOST_PORTS_INVALID');
      if(engine.type==='nginx'){
        const dump=observe(engine,['-T']),files=new Map();
        for(const match of dump.matchAll(/^# configuration file ((?:\/|[A-Za-z]:[\\/])[^\n]+):\s*\n([\s\S]*?)(?=^# configuration file |$(?![\s\S]))/gm))files.set(match[1],match[2]);
        if(!files.size)throw Error('VHOST_NGINX_DUMP_UNVERIFIABLE');const base=path.dirname(files.keys().next().value);
        for(const [file,body] of files)for(const block of nginxBlocks(body)){
          const top=directives(block,{top:true}),names=top.filter(r=>r[0]==='server_name').flatMap(r=>r.slice(1).map(s=>s.toLowerCase()));
          const listeners=top.filter(r=>r[0]==='listen').map(r=>Number(r[1]?.match(/(?:^|:)(\d+)$/)?.[1]));
          for(const domain of domains.filter(d=>names.includes(d)))for(const port of ports.filter(p=>listeners.includes(p))){
            const expanded=expandIncludes(block,files,base),all=directives(expanded);
            const roots=all.filter(r=>['root','alias'].includes(r[0])).map(r=>r.length===2?r[1]:'');
            const redirect=port===80&&top.some(r=>r[0]==='return'&&['301','302','307','308'].includes(r[1])&&/^https:\/\/(?:\$host|\$server_name|[a-z0-9.-]+)(?:\$request_uri|\/)/i.test(r[2]??'')&&(r[2].startsWith('https://$host')||r[2].startsWith('https://$server_name')||r[2].startsWith('https://'+domain+'/')));
            const passes=all.filter(r=>r[0]==='proxy_pass');
            const proxy=typeof engine.upstream==='string'&&passes.length>0&&passes.every(r=>r.length===2&&r[1]===engine.upstream)&&all.some(r=>r[0]==='proxy_set_header'&&r[1].toLowerCase()==='host'&&['$host','$http_host',domain].includes(r[2]));
            if(passes.length&&!proxy)fail('VHOST_PROXY_ROUTING_UNVERIFIABLE',{domain,port});
            if(all.some(r=>r[0]==='fastcgi_param'&&r[1]==='SCRIPT_FILENAME'&&!['$document_root$fastcgi_script_name','$realpath_root$fastcgi_script_name'].includes(r[2])))fail('VHOST_SCRIPT_ROOT_UNVERIFIABLE',{domain,port});
            if(proxy&&!roots.length&&!redirect)proxyChecks.push({engine,domain,port});
            accept(engine,domain,port,roots,redirect,proxy);checks.at(-1).configHash=sha(file+'\n'+JSON.stringify(expanded));
          }
        }
      }else{
        const included=observe(engine,['-t','-D','DUMP_INCLUDES']),dump=observe(engine,['-S']);
        const includedPaths=new Set([...included.matchAll(/^\s*\([^\n)]*\)\s+((?:\/|[A-Za-z]:[\\/])[^\n]+)$/gm)].map(m=>path.resolve(m[1].trim())));
        if(!includedPaths.size)throw Error('VHOST_APACHE_INCLUDES_UNVERIFIABLE');
        const entries=[];let last=null;
        for(const line of dump.split('\n')){
          const m=line.match(/(?:port\s+(\d+)\s+namevhost|[^\s]+:(\d+))\s+(\S+)\s+\(((?:\/|[A-Za-z]:[\\/]).*):(\d+)\)/);
          if(m){last={port:Number(m[1]??m[2]),names:[m[3].toLowerCase()],file:path.resolve(m[4]),line:Number(m[5])};entries.push(last);}
          else if(last&&/^\s+alias\s+(\S+)/.test(line))last.names.push(line.trim().split(/\s+/)[1].toLowerCase());
        }
        const cache=new Map();
        for(const entry of entries.filter(e=>ports.includes(e.port)&&domains.some(d=>e.names.includes(d)))){
          if(!includedPaths.has(entry.file))throw Error('VHOST_APACHE_INACTIVE_FILE');
          if(!cache.has(entry.file))cache.set(entry.file,read(entry.file));const body=cache.get(entry.file);
          const match=[...body.matchAll(/<VirtualHost\b[^>]*>([\s\S]*?)<\/VirtualHost\s*>/gi)].find(m=>body.slice(0,m.index).split('\n').length===entry.line);
          if(!match)throw Error('VHOST_APACHE_BLOCK_UNVERIFIABLE');
          if(/^\s*Include(?:Optional)?\b/im.test(match[1]))throw Error('VHOST_APACHE_NESTED_INCLUDE_UNVERIFIABLE');
          if(/^\s*(?:Alias(?:Match)?|ScriptAlias(?:Match)?|ProxyPass(?:Match)?)\b/im.test(match[1]))throw Error('VHOST_APACHE_ROUTING_UNVERIFIABLE');
          const blockNames=[...match[1].matchAll(/^\s*Server(?:Name|Alias)\s+([^\n]+)/gim)].flatMap(m=>tokens(m[1].trim()).map(v=>v.toLowerCase()));
          if(domains.some(d=>entry.names.includes(d)&&!blockNames.includes(d)))throw Error('VHOST_APACHE_DOMAIN_UNVERIFIABLE');
          const roots=[...match[1].matchAll(/^\s*DocumentRoot\s+([^\n]+)$/gim)].map(m=>tokens(m[1].trim())[0]);
          for(const domain of domains.filter(d=>entry.names.includes(d))){
            accept(engine,domain,entry.port,roots);checks.at(-1).configHash=sha(entry.file+'\n'+body);
          }
        }
      }
      for(const domain of domains)for(const port of ports)if(!checks.some(c=>c.engine===engine.type&&c.domain===domain&&c.port===port))fail('VHOST_DOMAIN_PORT_MISSING',{engine:engine.type,domain,port});
    }
    for(const engine of policy.engines)for(const domain of domains)for(const port of engine.ports??[80,443])if(checks.filter(c=>c.engine===engine.type&&c.domain===domain&&c.port===port).length>1)fail('VHOST_AMBIGUOUS_DOMAIN_SELECTION',{engine:engine.type,domain,port});
    for(const domain of domains)for(const port of [80,443])if(!seen.has(domain+':'+port))fail('VHOST_HTTP_HTTPS_COVERAGE_REQUIRED',{domain,port});
    for(const {engine,domain,port} of proxyChecks){const url=new URL(engine.upstream);if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!engineRoots.get('apache:'+domain+':'+Number(url.port||80)))fail('VHOST_PROXY_BACKEND_UNVERIFIED',{domain,port});}
    const cwp=policy.panel==='cwp'||(policy.panel!==false&&['/usr/local/cwpsrv','/usr/local/cwp'].some(p=>fs.existsSync(p)));
    if(cwp){
      if(!Array.isArray(policy.cwpBindings)||!policy.cwpBindings.length)throw Error('VHOST_CWP_BINDINGS_REQUIRED');
      for(const domain of domains){
        const binding=policy.cwpBindings.find(b=>b.domain===domain);if(!binding)throw Error('VHOST_CWP_DOMAIN_SELECTION_REQUIRED');
        const raw=read(binding.selectionFile);let selection;
        try{selection=JSON.parse(raw);}catch{selection={};for(const line of raw.split('\n').filter(l=>l.trim()&&!/^\s*[#;]/.test(l))){const m=line.match(/^\s*([A-Za-z0-9_.-]+)\s*=\s*['"]?([^'"\r\n]*?)['"]?\s*$/);if(!m||Object.hasOwn(selection,m[1]))throw Error('VHOST_CWP_SELECTION_FORMAT_UNVERIFIABLE');selection[m[1]]=m[2];}}
        for(const engine of policy.engines){
          const template=binding.templates?.find(t=>t.engine===engine.type);
          if(!template||typeof template.selectionKey!=='string'||! /^[a-z0-9_.-]+$/i.test(template.selectionKey)||! /^[a-z0-9_-]+$/i.test(template.name??'')||/^default$/i.test(template.name)||selection[template.selectionKey]!==template.name)throw Error('VHOST_CWP_CUSTOM_TEMPLATE_NOT_SELECTED');
          for(const [kind,extension] of [['http','.tpl'],['https','.stpl']]){
            if(path.basename(template[kind]?.path??'')!==template.name+extension||! /^[a-f0-9]{64}$/.test(template[kind]?.sha256??''))throw Error('VHOST_CWP_TEMPLATE_PAIR_REQUIRED');
            if(sha(read(template[kind].path))!==template[kind].sha256)throw Error('VHOST_CWP_TEMPLATE_DRIFT');
          }
        }
        checks.push({domain,engine:'cwp',status:'PASS',selectionHash:sha(raw)});
      }
    }
  }catch(error){fail(error.message.startsWith('VHOST_')?error.message:'VHOST_TRUTH_UNAVAILABLE');}
  return {schemaVersion:'executionkit-vhost-guard/v1',status:findings.length?'BLOCKED':'PASS',ok:findings.length===0,required,scope:'CONFIGURED_DISK',runtimeAttestation:'REQUIRED_AT_ACTIVATION',policyFingerprint:vhostPolicyFingerprint(deployment),checks,findings,fingerprint:sha(JSON.stringify(checks)),nextCommand:findings.length?'executionkit launch host-plan .':null};
}
