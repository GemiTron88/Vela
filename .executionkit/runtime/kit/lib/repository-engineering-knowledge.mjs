import crypto from 'node:crypto';

const sha=(value)=>crypto.createHash('sha256').update(value).digest('hex');
const uniq=(items)=>[...new Set(items)];
const posix=(value)=>String(value).replaceAll('\\','/');
const top=(p)=>p.includes('/')?p.split('/')[0]:'(root)';
const second=(p)=>p.split('/').slice(0,2).join('/');
const fileByPath=(pack,p)=>pack.files.find((f)=>f.path===p)??null;
const refs=(items,max=null)=>{const all=uniq(items.filter(Boolean)).sort();return max==null?all:all.slice(0,max);};
const section=(kind,title,items,sourceRefs,notes=[])=>({
  kind,title,items,sourceRefs:refs(sourceRefs),notes,
  fingerprint:sha(JSON.stringify({kind,items,sourceRefs:refs(sourceRefs),notes})),
});

function parseJsonFile(pack,p){
  const file=fileByPath(pack,p); if(!file)return null;
  try{return JSON.parse(file.content);}catch{return null;}
}
function languageCounts(pack){
  const m=new Map(); for(const f of pack.files){const k=f.language||'unknown';m.set(k,(m.get(k)??0)+1);}
  return [...m.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([language,count])=>({language,count}));
}
function rootManifests(pack){
  const names=['package.json','composer.json','pubspec.yaml','Cargo.toml','go.mod','pyproject.toml','requirements.txt','pom.xml','build.gradle','settings.gradle','Gemfile'];
  return names.filter((p)=>fileByPath(pack,p));
}
function frameworkSignals(pack){
  const out=[];
  const packageJson=parseJsonFile(pack,'package.json');
  const nodeDeps={...(packageJson?.dependencies??{}),...(packageJson?.devDependencies??{})};
  const nodeMap={next:'Next.js',react:'React',vue:'Vue',svelte:'Svelte',express:'Express',fastify:'Fastify',nestjs:'NestJS','@nestjs/core':'NestJS',laravel:'Laravel'};
  for(const [dep,label] of Object.entries(nodeMap)) if(nodeDeps[dep]) out.push({label,source:'package.json',evidence:dep});
  const composer=parseJsonFile(pack,'composer.json');
  const phpDeps={...(composer?.require??{}),...(composer?.['require-dev']??{})};
  if(phpDeps['laravel/framework'])out.push({label:'Laravel',source:'composer.json',evidence:'laravel/framework'});
  if(phpDeps['livewire/livewire'])out.push({label:'Livewire',source:'composer.json',evidence:'livewire/livewire'});
  if(phpDeps['symfony/framework-bundle'])out.push({label:'Symfony',source:'composer.json',evidence:'symfony/framework-bundle'});
  const pub=fileByPath(pack,'pubspec.yaml')?.content??'';
  if(/^\s*flutter\s*:/m.test(pub))out.push({label:'Flutter',source:'pubspec.yaml',evidence:'flutter'});
  const cargo=fileByPath(pack,'Cargo.toml')?.content??'';
  for(const [dep,label] of [['actix-web','Actix Web'],['axum','Axum'],['tokio','Tokio'],['tauri','Tauri']]) if(new RegExp(`(^|\\n)\\s*${dep.replace('-','\\-')}\\s*=`,'m').test(cargo))out.push({label,source:'Cargo.toml',evidence:dep});
  return out;
}
function containerCandidates(pack){
  const groups=new Map();
  for(const f of pack.files){
    const root=top(f.path); if(root==='(root)')continue;
    if(!groups.has(root))groups.set(root,[]);
    groups.get(root).push(f.path);
  }
  const important=/^(apps?|packages?|src|app|server|backend|frontend|web|api|mobile|desktop|lib|services?|modules?|crates|cmd|internal)$/i;
  return [...groups.entries()].filter(([name,files])=>important.test(name)||files.length>=5).sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0])).slice(0,40).map(([name,files])=>({
    name,path:name,fileCount:files.length,languages:uniq(files.map((p)=>fileByPath(pack,p)?.language).filter(Boolean)).sort(),
    confidence:important.test(name)?'HIGH':'MEDIUM',classification:'structural-candidate',
  }));
}
function componentCandidates(pack){
  const groups=new Map();
  const roots=new Set(['src','app','lib','modules','packages','apps','services','crates','internal']);
  for(const f of pack.files){
    const parts=f.path.split('/'); if(parts.length<2||!roots.has(parts[0]))continue;
    const key=second(f.path); if(!groups.has(key))groups.set(key,[]); groups.get(key).push(f.path);
  }
  return [...groups.entries()].filter(([,files])=>files.length>=1).sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0])).slice(0,80).map(([pathName,files])=>({
    name:pathName.split('/').at(-1),path:pathName,fileCount:files.length,
    languages:uniq(files.map((p)=>fileByPath(pack,p)?.language).filter(Boolean)).sort(),
    confidence:'MEDIUM',classification:'structural-candidate',
  }));
}
function domainCandidates(pack){
  const patterns=/(^|\/)(domains?|features?|bounded-contexts?|modules?|services?)\/([^/]+)/i;
  const directRoots=new Set(['app','src','lib']);
  const generic=new Set(['http','console','providers','models','services','utils','common','shared','core','config','tests','test']);
  const map=new Map();
  for(const f of pack.files){
    const m=f.path.match(patterns);
    let key=null;
    if(m)key=`${m[2]}/${m[3]}`;
    else {
      const parts=f.path.split('/');
      if(parts.length>=3&&directRoots.has(parts[0])&&!generic.has(parts[1].toLowerCase())) key=`${parts[0]}/${parts[1]}`;
    }
    if(!key)continue; if(!map.has(key))map.set(key,[]);map.get(key).push(f.path);
  }
  return [...map.entries()].filter(([,files])=>files.length>=2).sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0])).slice(0,80).map(([pathName,files])=>({
    name:pathName.split('/').at(-1),path:pathName,fileCount:files.length,
    confidence:/domains?|features?|bounded-contexts?/i.test(pathName)?'HIGH':'LOW',
    classification:'domain-candidate',
  }));
}
function classifyPaths(pack,re){
  return pack.files.map((f)=>f.path).filter((p)=>re.test(p)).sort();
}
function workflowCandidates(pack){
  const groups=[
    ['routes',/(^|\/)(routes?|routing)(\/|\.|$)/i],
    ['controllers',/(^|\/)(controllers?|handlers?)(\/|$)/i],
    ['commands',/(^|\/)(commands?|console)(\/|$)/i],
    ['jobs-queues',/(^|\/)(jobs?|queues?|workers?)(\/|$)/i],
    ['events-listeners',/(^|\/)(events?|listeners?|subscribers?)(\/|$)/i],
    ['use-cases',/(^|\/)(usecases?|use-cases?|actions?)(\/|$)/i],
    ['workflows',/(^|\/)(workflows?|pipelines?)(\/|$)/i],
  ];
  return groups.map(([kind,re])=>({kind,paths:classifyPaths(pack,re)})).filter((x)=>x.paths.length).map((x)=>({...x,confidence:'MEDIUM',classification:'workflow-surface-candidate'}));
}
function interfaceCandidates(pack){
  const groups=[
    ['http-routing',/(^|\/)(routes?|controllers?|handlers?|endpoints?)(\/|\.|$)/i],
    ['openapi',/(openapi|swagger).*(\.ya?ml|\.json)$/i],
    ['graphql',/(graphql|schema\.graphql|\.graphqls?$)/i],
    ['cli',/(^|\/)(bin|cli|commands?|console)(\/|$)/i],
    ['websocket',/(websocket|websockets|reverb|socket|channels?)(\/|\.|$)/i],
    ['rpc',/(grpc|protobuf|proto)(\/|\.|$)/i],
  ];
  return groups.map(([kind,re])=>({kind,paths:classifyPaths(pack,re)})).filter((x)=>x.paths.length).map((x)=>({...x,confidence:'MEDIUM'}));
}
function dataCandidates(pack){
  const groups=[
    ['migrations',/(^|\/)(migrations?|database\/migrations)(\/|$)/i],
    ['sql-schema',/(schema.*\.sql$|\.sql$)/i],
    ['orm-models',/(^|\/)(models?|entities?)(\/|$)/i],
    ['prisma',/(^|\/)schema\.prisma$/i],
    ['database-config',/(^|\/)(database|db)(\.|\/|$)/i],
  ];
  return groups.map(([kind,re])=>({kind,paths:classifyPaths(pack,re)})).filter((x)=>x.paths.length).map((x)=>({...x,confidence:x.kind==='migrations'||x.kind==='sql-schema'?'HIGH':'MEDIUM'}));
}
function dependencyIntegrations(pack){
  const items=[],sources=[];
  const pkg=parseJsonFile(pack,'package.json');
  if(pkg){sources.push('package.json');for(const [name,version] of Object.entries(pkg.dependencies??{}))items.push({ecosystem:'npm',name,version:String(version)});}
  const composer=parseJsonFile(pack,'composer.json');
  if(composer){sources.push('composer.json');for(const [name,version] of Object.entries(composer.require??{}))if(name!=='php')items.push({ecosystem:'composer',name,version:String(version)});}
  const pub=fileByPath(pack,'pubspec.yaml');
  if(pub){sources.push('pubspec.yaml');const lines=pub.content.split(/\r?\n/);let inDeps=false;for(const line of lines){if(/^dependencies:\s*$/.test(line)){inDeps=true;continue;}if(inDeps&&/^\S/.test(line))break;const m=line.match(/^\s{2}([A-Za-z0-9_\-]+):\s*(.*)$/);if(inDeps&&m&&m[1]!=='flutter')items.push({ecosystem:'pub',name:m[1],version:m[2]||'unspecified'});}}
  const cargo=fileByPath(pack,'Cargo.toml');
  if(cargo){sources.push('Cargo.toml');let deps=false;for(const line of cargo.content.split(/\r?\n/)){if(/^\[dependencies\]/.test(line)){deps=true;continue;}if(deps&&/^\[/.test(line))break;const m=line.match(/^\s*([A-Za-z0-9_\-]+)\s*=\s*(.+)$/);if(deps&&m)items.push({ecosystem:'cargo',name:m[1],version:m[2].trim().slice(0,120)});}}
  return {items:items.sort((a,b)=>a.ecosystem.localeCompare(b.ecosystem)||a.name.localeCompare(b.name)).slice(0,300),sources};
}
function testTopology(pack){
  const paths=classifyPaths(pack,/(^|\/)(tests?|specs?|__tests__)(\/|$)|\.(test|spec)\.[^.]+$/i);
  const categories={unit:0,integration:0,e2e:0,visual:0,other:0};
  for(const p of paths){if(/unit/i.test(p))categories.unit++;else if(/integration|feature/i.test(p))categories.integration++;else if(/e2e|playwright|cypress/i.test(p))categories.e2e++;else if(/visual|screenshot/i.test(p))categories.visual++;else categories.other++;}
  return {count:paths.length,categories,paths:paths.slice(0,120)};
}
function deploymentTopology(pack){
  const paths=pack.files.map((f)=>f.path).filter((p)=>/(^|\/)(Dockerfile|docker-compose\.ya?ml|compose\.ya?ml|\.github\/workflows\/|k8s\/|kubernetes\/|helm\/|terraform\/|infra\/|nginx|Caddyfile|Procfile)/i.test(p)).sort();
  return {paths:paths.slice(0,120),signals:uniq(paths.map((p)=>p.includes('.github/workflows/')?'ci-workflow':/Dockerfile|compose/i.test(p)?'container':/k8s|kubernetes|helm/i.test(p)?'kubernetes':/terraform|infra/i.test(p)?'infrastructure':'deployment-config')).sort()};
}
function sourceScopes(pack){return uniq(pack.files.map((f)=>f.path.includes('/')?top(f.path):f.path)).sort();}

export function buildEngineeringKnowledge(pack,{maxSourceRefsPerSection=80}={}){
  if(!pack?.repository||!Array.isArray(pack.files))throw new Error('A source pack is required');
  if(!Number.isInteger(maxSourceRefsPerSection)||maxSourceRefsPerSection<10||maxSourceRefsPerSection>500)throw new Error('maxSourceRefsPerSection must be 10..500');
  const manifests=rootManifests(pack),frameworks=frameworkSignals(pack),containers=containerCandidates(pack),components=componentCandidates(pack),domains=domainCandidates(pack),workflows=workflowCandidates(pack),interfaces=interfaceCandidates(pack),data=dataCandidates(pack),integrations=dependencyIntegrations(pack),tests=testTopology(pack),deployment=deploymentTopology(pack);
  const allPaths=pack.files.map((f)=>f.path);
  const sections={
    systemContext:section('system-context','System Context',[{repositoryKey:pack.repository.key,branch:pack.repository.branch??null,languages:languageCounts(pack).slice(0,12),frameworks,manifests}],refs([...manifests,...frameworks.map((x)=>x.source)]),['Deterministic inventory; runtime responsibilities require source/runtime verification.']),
    containers:section('containers','Container Candidates',containers,containers.flatMap((x)=>allPaths.filter((p)=>p===x.path||p.startsWith(`${x.path}/`))),['C4-like structural candidates inferred from repository layout, not deployment proof.']),
    components:section('components','Component Candidates',components,components.flatMap((x)=>allPaths.filter((p)=>p===x.path||p.startsWith(`${x.path}/`))),['Component boundaries are path-derived candidates.']),
    domains:section('domains','Domain Candidates',domains,domains.flatMap((x)=>allPaths.filter((p)=>p===x.path||p.startsWith(`${x.path}/`))),['Domain candidates require product/domain confirmation before becoming a glossary authority.']),
    workflows:section('workflows','Workflow Surface Candidates',workflows,workflows.flatMap((x)=>x.paths),['These are workflow-related surfaces, not fabricated end-to-end call chains. Use a proven-current relationship graph/live source to establish actual flow.']),
    interfaces:section('interfaces','Interface Candidates',interfaces,interfaces.flatMap((x)=>x.paths),['Interfaces are detected from paths/configuration and require live-source verification for exact contracts.']),
    data:section('data','Data & Persistence Candidates',data,data.flatMap((x)=>x.paths),['Migration/schema evidence has higher confidence than generic model/config paths.']),
    integrations:section('integrations','Dependency & Integration Inventory',integrations.items,integrations.sources,['Manifest dependencies are inventory evidence, not proof that a dependency is exercised at runtime.']),
    tests:section('tests','Test Topology',[tests],tests.paths,['Test file presence does not prove current passing evidence.']),
    deployment:section('deployment','Deployment Topology',[deployment],deployment.paths,['Deployment files are topology signals; Launch OS retains deployment/release authority.']),
  };
  for(const s of Object.values(sections)){
    const allSourceRefs=[...s.sourceRefs];
    const sourceEvidence=allSourceRefs.map((p)=>({path:p,sha256:fileByPath(pack,p)?.sha256??null}));
    s.fingerprint=sha(JSON.stringify({kind:s.kind,items:s.items,sourceEvidence,notes:s.notes}));
    s.sourceRefs=allSourceRefs.slice(0,maxSourceRefsPerSection);
  }
  const generatedAt=new Date().toISOString();
  const bodyFingerprint=sha(JSON.stringify(Object.fromEntries(Object.entries(sections).map(([k,v])=>[k,v.fingerprint]))));
  return {
    schemaVersion:'1.0.0',artifactId:'repository-engineering-knowledge',artifactType:'engineering-knowledge',
    ownershipClass:'GENERATED_PORTABLE',evidenceKind:'GENERATED_HUMAN_DOC',
    repository:{key:pack.repository.key,isGit:pack.repository.isGit,baselineSha:pack.repository.baselineSha,branch:pack.repository.branch,dirty:pack.repository.dirty},
    provider:{id:'native-engineering-knowledge',version:'1.0.0'},generatedAt,sourceScopes:sourceScopes(pack),
    inputFingerprints:[{kind:'source-pack-working-tree',value:pack.repository.workingTreeFingerprint},{kind:'section-map',value:bodyFingerprint}],
    metrics:{fileCount:pack.files.length,sectionCount:Object.keys(sections).length,sourceRefCount:Object.values(sections).reduce((n,s)=>n+s.sourceRefs.length,0)},
    trust:{state:'VERIFY',measuredAt:generatedAt,reasons:['generated_structural_knowledge_requires_freshness_measurement']},portable:true,sections,
  };
}

export function renderEngineeringKnowledgeMarkdown(artifact){
  if(!artifact?.sections)throw new Error('Engineering knowledge artifact is required');
  const docs={};
  const renderItems=(items)=>items.length?items.map((item)=>`- ${typeof item==='string'?item:JSON.stringify(item)}`).join('\n'):'- None detected';
  for(const [key,s] of Object.entries(artifact.sections)){
    docs[`${key}.md`]=[
      `# ${s.title}`,'',
      '> Generated, source-grounded engineering knowledge. Derived evidence only; live source and canonical ExecutionKit authorities win on conflict.','',
      `Baseline: ${artifact.repository?.baselineSha??'unavailable'}`,'',
      '## Findings','',renderItems(s.items),'',
      '## Source references','',...(s.sourceRefs.length?s.sourceRefs.map((p)=>`- \`${p}\``):['- None']),'',
      '## Notes','',...(s.notes.length?s.notes.map((n)=>`- ${n}`):['- None']),'',
    ].join('\n');
  }
  return docs;
}

export const engineeringKnowledgeSectionKeys=Object.freeze(['systemContext','containers','components','domains','workflows','interfaces','data','integrations','tests','deployment']);
