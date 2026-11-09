import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveProjectPathSafe } from './derived-state.mjs';

const SNAPSHOT_REL='.executionkit/database/schema.json';
const MANIFEST_REL='.executionkit/database/manifest.json';
const AUTHORITY_ROOTS=['database/migrations','database/schema','app/Models','Modules','modules','app/Domain','prisma'];
const SOURCE_ROOTS=['app','database','routes','src','Modules','modules','prisma'];
const SQL_SYSTEM_TABLES=new Set(['sqlite_master','sqlite_schema','sqlite_sequence','sqlite_stat1','sqlite_temp_master','information_schema','migrations']);
const DB_MARKER=/\b(?:DB::|Schema::|[A-Z][A-Za-z0-9_]*::(?:query|where|whereIn|whereNull|whereNotNull|select|orderBy|groupBy|pluck|value|find|findOrFail|create|forceCreate|firstOrCreate|updateOrCreate|insert|upsert)\s*\(|use\s+[^;]+\\Models?\\[^;]+;|SELECT\b[\s\S]{0,500}?\bFROM\b|INSERT\s+INTO\b|UPDATE\s+[`\"']?[A-Za-z_][\w$.`\"']*\s+SET\b|DELETE\s+FROM\b)/;
const CODE_EXT=new Set(['.php','.sql','.ts','.js','.mjs','.cjs','.prisma']);

function rel(root,file){return path.relative(root,file).split(path.sep).join('/');}
function exists(root,p){return fs.existsSync(path.join(root,p));}
function ensureParent(file){fs.mkdirSync(path.dirname(file),{recursive:true});}
function sha(value){return crypto.createHash('sha256').update(value).digest('hex');}
function statSig(file){const s=fs.statSync(file);return {size:s.size,mtimeMs:Math.trunc(s.mtimeMs)};}
function safeRead(file){try{return fs.readFileSync(file,'utf8');}catch{return null;}}
function unique(items){return [...new Set(items)];}
function sortedObject(obj){return Object.fromEntries(Object.entries(obj).sort(([a],[b])=>a.localeCompare(b)));}
function snake(name){return name.replace(/\\/g,'/').split('/').pop().replace(/([a-z0-9])([A-Z])/g,'$1_$2').replace(/[-\s]+/g,'_').toLowerCase();}
function plural(word){if(/[^aeiou]y$/.test(word))return word.slice(0,-1)+'ies';if(/(?:s|x|z|ch|sh)$/.test(word))return word+'es';return word+'s';}
function inferTable(model){return plural(snake(model));}

function walk(root,relRoot,{extensions=null,limit=5000}={}){
  const start=path.join(root,relRoot);if(!fs.existsSync(start))return [];
  const out=[],stack=[start];
  while(stack.length&&out.length<limit){
    const dir=stack.pop();
    let entries=[];try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch{continue;}
    for(const entry of entries){
      const full=path.join(dir,entry.name);
      if(entry.isDirectory()){if(!['vendor','node_modules','.git','.executionkit'].includes(entry.name))stack.push(full);continue;}
      if(!entry.isFile())continue;
      if(extensions&&!extensions.has(path.extname(entry.name).toLowerCase()))continue;
      out.push(full);if(out.length>=limit)throw Error('DATABASE_SCAN_LIMIT_EXCEEDED');
    }
  }
  return out.sort();
}

function authorityRootsState(root){
  return AUTHORITY_ROOTS.map((r)=>{const full=path.join(root,r);if(!fs.existsSync(full))return {path:r,exists:false,mtimeMs:null};const s=fs.statSync(full);return {path:r,exists:true,mtimeMs:Math.trunc(s.mtimeMs)};});
}

function discoverAuthorityFiles(root){
  const schema=walk(root,'database/schema',{extensions:new Set(['.sql','.php'])});
  if(exists(root,'database/schema.sql'))schema.push(path.join(root,'database/schema.sql'));
  const prisma=walk(root,'prisma',{extensions:new Set(['.prisma','.sql'])});
  for(const p of prisma)if(p.endsWith('.prisma')||p.endsWith('.sql'))schema.push(p);
  const migrations=walk(root,'database/migrations',{extensions:new Set(['.php','.sql'])});
  const models=walk(root,'app/Models',{extensions:new Set(['.php'])});
  for(const moduleRoot of ['Modules','modules','app/Domain']){
    for(const file of walk(root,moduleRoot,{extensions:new Set(['.php']),limit:30000})){
      const r=rel(root,file);
      if(/\/(?:Database\/)?Migrations\//i.test('/'+r))migrations.push(file);
      if(/\/Models?\//i.test('/'+r))models.push(file);
    }
  }
  const cleanSchema=unique(schema).sort(),cleanMigrations=unique(migrations).sort((a,b)=>path.basename(a).localeCompare(path.basename(b))||rel(root,a).localeCompare(rel(root,b))),cleanModels=unique(models).sort();
  const ordered=[...cleanSchema,...cleanMigrations,...cleanModels];
  return {schema:cleanSchema,migrations:cleanMigrations,models:cleanModels,ordered,all:[...ordered].sort()};
}
function authorityDirsState(root,files){
  const relDirs=unique(files.map((file)=>rel(root,path.dirname(file)))).sort();
  return relDirs.map((r)=>{const full=path.join(root,r);const stat=fs.statSync(full);return {path:r,mtimeMs:Math.trunc(stat.mtimeMs)};});
}

function authoritySignatures(root,files){return files.map((file)=>({path:rel(root,file),...statSig(file)}));}
function fingerprint(signatures,roots){return sha(JSON.stringify({files:signatures,roots}));}
function snapshotPath(root){return path.join(root,SNAPSHOT_REL);}
function manifestPath(root){return path.join(root,MANIFEST_REL);}
function readJson(file){if(!fs.existsSync(file))return null;try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}}
function loadSnapshot(root){return readJson(snapshotPath(root));}
function loadManifest(root){return readJson(manifestPath(root));}

function addColumn(table,name,type='unknown',extra={}){
  if(!name)return;
  table.columns[name]={name,type,...(table.columns[name]??{}),...extra};
}
function removeColumn(table,name){if(name)delete table.columns[name];}
function tableEntry(tables,name,file){
  if(!tables[name])tables[name]={name,columns:{},sourceFiles:[]};
  if(file&&!tables[name].sourceFiles.includes(file))tables[name].sourceFiles.push(file);
  return tables[name];
}

function phpMethodBody(text,name){
  const re=new RegExp('(?:public\\s+|protected\\s+|private\\s+)?function\\s+'+name+'\\s*\\([^)]*\\)[^{]*\\{','m');
  const match=re.exec(text);if(!match)return null;
  const open=text.indexOf('{',match.index);let depth=0,quote=null,escaped=false;
  for(let i=open;i<text.length;i++){
    const ch=text[i],next=text[i+1];
    if(quote){if(escaped){escaped=false;continue;}if(ch==='\\'){escaped=true;continue;}if(ch===quote)quote=null;continue;}
    if(ch==='/'&&next==='/'){i+=2;while(i<text.length&&text[i]!=='\n')i++;continue;}
    if(ch==='#'){i++;while(i<text.length&&text[i]!=='\n')i++;continue;}
    if(ch==='/'&&next==='*'){i+=2;while(i<text.length&&!(text[i]==='*'&&text[i+1]==='/'))i++;i++;continue;}
    if(ch==="'"||ch==='"' || ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return text.slice(open+1,i);
  }
  return text.slice(open+1);
}
function applyLaravelMigration(tables,text,file,findings=[]){
  text=phpMethodBody(text,'up')??text;
  const ops=[];
  const re=/Schema::(?:connection\s*\([^)]*\)\s*->\s*)?(create|table)\s*\(\s*['"]([^'"]+)['"]/g;
  let m;
  while((m=re.exec(text))){
    const kind=m[1],name=m[2],start=m.index,tail=text.slice(start,start+128000);
    const next=tail.slice(1).search(/Schema::(?:connection\s*\([^)]*\)\s*->\s*)?(?:create|table)\s*\(/);
    const block=next>=0?tail.slice(0,next+1):tail;
    if(kind==='create')tables[name]={name,columns:{},sourceFiles:[file]};
    if(kind==='table'&&!tables[name])findings.push({code:'DB_MIGRATION_TABLE_MISMATCH',severity:'BLOCKER',file,table:name,context:'Schema::table',message:'Migration mutates table '+name+' before it exists in compiled database truth.'});
    const table=tableEntry(tables,name,file);
    if(/\$table->id\s*\(/.test(block)||/\$table->bigIncrements\s*\(\s*['"]id['"]/.test(block))addColumn(table,'id','bigint',{generated:true});
    if(/\$table->uuid\s*\(\s*\)/.test(block))addColumn(table,'uuid','uuid');
    if(/\$table->ulid\s*\(\s*\)/.test(block))addColumn(table,'ulid','ulid');
    if(/\$table->timestamps(?:Tz)?\s*\(/.test(block)){addColumn(table,'created_at','timestamp',{nullable:true});addColumn(table,'updated_at','timestamp',{nullable:true});}
    if(/\$table->softDeletes(?:Tz)?\s*\(/.test(block))addColumn(table,'deleted_at','timestamp',{nullable:true});
    const colRe=/\$table->(string|char|tinyText|text|mediumText|longText|integer|tinyInteger|smallInteger|mediumInteger|bigInteger|unsignedTinyInteger|unsignedSmallInteger|unsignedMediumInteger|unsignedInteger|unsignedBigInteger|decimal|float|double|boolean|date|dateTime|dateTimeTz|timestamp|timestampTz|time|timeTz|year|json|jsonb|uuid|ulid|binary|enum|set|ipAddress|macAddress|geometry|geography|point|lineString|polygon|vector|foreignId|foreignUuid|foreignUlid)\s*\(\s*['\"]([^'\"]+)['\"]/g;
    let c;while((c=colRe.exec(block)))addColumn(table,c[2],c[1]);
    const morphRe=/\$table->(nullable)?(uuid|ulid)?Morphs\s*\(\s*['"]([^'"]+)['"]/gi;while((c=morphRe.exec(block))){addColumn(table,c[3]+'_type','string',{nullable:Boolean(c[1])});addColumn(table,c[3]+'_id',c[2]?.toLowerCase()==='uuid'?'uuid':c[2]?.toLowerCase()==='ulid'?'ulid':'bigint',{nullable:Boolean(c[1])});}
    if(/\$table->rememberToken\s*\(/.test(block))addColumn(table,'remember_token','string',{nullable:true});
    const foreignFor=/\$table->foreignIdFor\s*\(\s*([A-Za-z_\\][A-Za-z0-9_\\]*)::class(?:\s*,\s*['"]([^'"]+)['"])?/g;while((c=foreignFor.exec(block))){const model=c[1].split('\\').pop();addColumn(table,c[2]??snake(model)+'_id','bigint');}
    const renameRe=/->renameColumn\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g;while((c=renameRe.exec(block))){if(!table.columns[c[1]])findings.push({code:'DB_MIGRATION_COLUMN_MISMATCH',severity:'BLOCKER',file,table:name,column:c[1],context:'renameColumn',message:'Migration renames missing column '+name+'.'+c[1]+'.'});const {name:_oldName,...prior}=table.columns[c[1]]??{type:'unknown'};removeColumn(table,c[1]);addColumn(table,c[2],prior.type,prior);}
    const dropRe=/->dropColumn\s*\(\s*(\[[^\]]+\]|['"][^'"]+['"](?:\s*,\s*['"][^'"]+['"])*)\s*\)/g;
    while((c=dropRe.exec(block))){
      for(const colMatch of c[1].matchAll(/['"]([^'"]+)['"]/g)){
        const colName=colMatch[1];
        if(!table.columns[colName])findings.push({code:'DB_MIGRATION_COLUMN_MISMATCH',severity:'BLOCKER',file,table:name,column:colName,context:'dropColumn',message:'Migration drops missing column '+name+'.'+colName+'.'});
        removeColumn(table,colName);
      }
    }
    ops.push({kind,table:name});
  }
  const dropTable=/Schema::drop(IfExists)?\s*\(\s*['"]([^'"]+)['"]\s*\)/g;while((m=dropTable.exec(text))){const name=m[2];if(!m[1]&&!tables[name])findings.push({code:'DB_MIGRATION_TABLE_MISMATCH',severity:'BLOCKER',file,table:name,context:'Schema::drop',message:'Migration drops missing table '+name+'.'});delete tables[name];ops.push({kind:'drop',table:name});}
  return ops;
}

function schemaDumpMigrationNames(text){
  const names=new Set();
  for(const m of String(text??'').matchAll(/\b(\d{4}_\d{2}_\d{2}_\d{6}_[A-Za-z0-9_]+)\b/g))names.add(m[1]);
  return names;
}

function applySqlSchema(tables,text,file){
  const re=/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:(?:[`\"]?[A-Za-z_][\w$]*[`\"]?)\.)?[`\"]?([A-Za-z_][\w$]*)[`\"]?\s*\(([^;]+)\)/gi;let m;
  while((m=re.exec(text))){
    const name=m[1];tables[name]={name,columns:{},sourceFiles:[file]};const table=tables[name],body=m[2];
    for(const raw of body.split(',')){
      const line=raw.trim();if(!line||/^(?:PRIMARY|FOREIGN|UNIQUE|CONSTRAINT|KEY|CHECK)\b/i.test(line))continue;
      const cm=line.match(/^[`"']?([A-Za-z_][\w$]*)[`"']?\s+([A-Za-z]+(?:\([^)]*\))?)/);if(cm)addColumn(table,cm[1],cm[2].toLowerCase());
    }
  }
  const alterRe=/ALTER\s+TABLE\s+(?:ONLY\s+)?(?:[`"]?[A-Za-z_][\w$]*[`"]?\.)?[`"]?([A-Za-z_][\w$]*)[`"]?\s+ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?[`"']?([A-Za-z_][\w$]*)[`"']?\s+([A-Za-z]+(?:\([^)]*\))?)/gi;
  while((m=alterRe.exec(text))){
    const table=tableEntry(tables,m[1],file);
    addColumn(table,m[2],m[3].toLowerCase());
  }
}

function applyPrismaSchema(tables,prismaModels,text,file){
  const modelRe=/\bmodel\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*?)\}/g;let m;
  while((m=modelRe.exec(text))){
    const modelName=m[1],body=m[2];
    const mappedTable=body.match(/@@map\s*\(\s*["']([^"']+)["']\s*\)/)?.[1];
    const tableName=mappedTable??inferTable(modelName);
    const table=tableEntry(tables,tableName,file);
    const cols=[];
    for(const rawLine of body.split(/\r?\n/)){
      const line=rawLine.replace(/\/\/.*$/,'').trim();
      if(!line||line.startsWith('@@')||line.startsWith('//'))continue;
      const fm=line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)([?\[\]]*)(?:\s+(.*))?$/);
      if(!fm)continue;
      const [,fieldName,fieldType,modifiers,rest='']=fm;
      if(modifiers.includes('[]')||/@relation\b/.test(rest))continue;
      const colMap=rest.match(/@map\s*\(\s*["']([^"']+)["']\s*\)/)?.[1];
      const colName=colMap??fieldName;
      addColumn(table,colName,fieldType.toLowerCase(),{nullable:modifiers.includes('?')});
      cols.push(colName);
    }
    prismaModels.push({name:modelName,fqcn:modelName,table:tableName,certainty:mappedTable?'EXPLICIT':'INFERRED_MATCHED',file,declaredColumns:cols,relations:[],virtualAttributes:[]});
  }
}

function parseArrayKeys(body){
  const out=[];const s=String(body??'');let depth=0,i=0;const n=s.length;
  while(i<n){
    const ch=s[i];
    if(ch==='/'&&s[i+1]==='/'){i+=2;while(i<n&&s[i]!=='\n')i++;continue;}
    if(ch==='#'){i++;while(i<n&&s[i]!=='\n')i++;continue;}
    if(ch==='/'&&s[i+1]==='*'){i+=2;while(i<n&&!(s[i]==='*'&&s[i+1]==='/'))i++;i+=2;continue;}
    if(ch==="'"||ch==='"'){
      const quote=ch,start=i+1;i++;
      while(i<n){if(s[i]==='\\'){i+=2;}else if(s[i]===quote){break;}else{i++;}}
      const strVal=s.slice(start,i);i++;
      if(depth===0){
        let j=i;while(j<n&&/\s/.test(s[j]))j++;
        if(s[j]==='='&&s[j+1]==='>'){if(strVal!=='*')out.push(strVal);}
      }
      continue;
    }
    if(ch==='['||ch==='('||ch==='{')depth++;
    else if(ch===']'||ch===')'||ch==='}')if(depth>0)depth--;
    i++;
  }
  return unique(out);
}
function parseModel(text,file,tables){
  const cls=text.match(/class\s+([A-Za-z_][A-Za-z0-9_]*)\b/);if(!cls)return null;
  const name=cls[1],namespace=text.match(/namespace\s+([^;]+);/)?.[1]?.trim()??null,fqcn=namespace?namespace+'\\'+name:name;
  const explicit=text.match(/protected\s+(?:\??string\s+)?\$table\s*=\s*['"]([^'"]+)['"]/);
  const candidate=explicit?.[1]??inferTable(name);
  const certainty=explicit?'EXPLICIT':tables[candidate]?'INFERRED_MATCHED':'INFERRED_UNRESOLVED';
  const refs=[],relations=[],virtualAttributes=[];
  const fillable=text.match(/protected\s+(?:array\s+)?\$fillable\s*=\s*\[([\s\S]*?)\]\s*;/);
  if(fillable)refs.push(...parseArrayKeys(fillable[1].replace(/(['"][^'"]+['"])\s*(?:,|$)/g,'$1 => true,')));
  const casts=text.match(/protected\s+(?:array\s+)?\$casts\s*=\s*\[([\s\S]*?)\]\s*;/);
  if(casts)refs.push(...parseArrayKeys(casts[1]));
  const appends=text.match(/protected\s+(?:array\s+)?\$appends\s*=\s*\[([\s\S]*?)\]\s*;/);
  if(appends)for(const m of appends[1].matchAll(/['"]([^'"]+)['"]/g))virtualAttributes.push(m[1]);
  for(const m of text.matchAll(/function\s+get([A-Z][A-Za-z0-9_]*)Attribute\s*\(/g))virtualAttributes.push(snake(m[1]));
  const fnRe=/(?:public|protected|private)?\s*function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*(?::\s*([^\{]+))?\s*\{([\s\S]{0,2500}?)\}/g;
  for(const fn of text.matchAll(fnRe)){
    const method=fn[1],returnType=String(fn[2]??''),body=String(fn[3]??'');
    if(method==='casts'){const returned=body.match(/return\s*\[([\s\S]*?)\]\s*;/);if(returned)refs.push(...parseArrayKeys(returned[1]));}
    if(/(?:^|\\)Attribute\b/.test(returnType)||/Attribute::make\s*\(/.test(body))virtualAttributes.push(method,snake(method));
    const relation=body.match(/\$this->(belongsTo|hasOne|hasMany|hasOneThrough|hasManyThrough|belongsToMany|morphTo|morphOne|morphMany|morphToMany|morphedByMany)\s*\(/);
    if(relation)relations.push({name:method,type:relation[1]});
  }
  return {name,fqcn,table:candidate,certainty,file,declaredColumns:unique(refs),relations,virtualAttributes:unique(virtualAttributes)};
}

export function refreshDatabaseIntegrity(root,{write=true}={}){
  const started=performance.now();root=path.resolve(root);
  const authority=discoverAuthorityFiles(root);
  const applicable=authority.ordered.length>0||exists(root,'artisan');
  if(!applicable)return {schemaVersion:'executionkit-database-integrity/v1',status:'NOT_APPLICABLE',durationMs:Math.round((performance.now()-started)*100)/100,filesRead:0};
  const schemaTexts=new Map(),dumpAppliedMigrations=new Set();
  for(const file of authority.schema){
    const text=safeRead(file);if(text===null)continue;
    schemaTexts.set(file,text);
    for(const name of schemaDumpMigrationNames(text))dumpAppliedMigrations.add(name);
  }
  const migrationsToApply=authority.schema.length
    ? authority.migrations.filter((file)=>!dumpAppliedMigrations.has(path.basename(file,'.php')))
    : authority.migrations;
  const authorityFiles=[...authority.schema,...migrationsToApply,...authority.models];
  const tables={},modelFiles=[],prismaModels=[],compileFindings=[];let filesRead=0;
  for(const file of authorityFiles){
    const r=rel(root,file),text=schemaTexts.has(file)?schemaTexts.get(file):safeRead(file);if(text===null)continue;filesRead++;
    if(r.endsWith('.prisma'))applyPrismaSchema(tables,prismaModels,text,r);
    else if(r.endsWith('.sql'))applySqlSchema(tables,text,r);
    else if((r.startsWith('database/migrations/')||/\/(?:Database\/)?Migrations\//i.test('/'+r))&&r.endsWith('.php'))applyLaravelMigration(tables,text,r,compileFindings);
    else if((r.startsWith('app/Models/')||/\/Models?\//i.test('/'+r))&&r.endsWith('.php'))modelFiles.push({file:r,text});
  }
  const models={},modelsByFqcn={},ambiguousModelNames={};
  for(const model of prismaModels){
    modelsByFqcn[model.fqcn]=model;
    models[model.name]=model;
  }
  for(const item of modelFiles){
    const model=parseModel(item.text,item.file,tables);if(!model)continue;
    modelsByFqcn[model.fqcn]=model;
    if(!models[model.name])models[model.name]=model;
    else if(models[model.name].fqcn!==model.fqcn){
      ambiguousModelNames[model.name]=unique([models[model.name].fqcn,model.fqcn]);
      delete models[model.name];
    }
  }
  for(const table of Object.values(tables)){table.columns=sortedObject(table.columns);table.sourceFiles.sort();}
  const roots=authorityRootsState(root),dirs=authorityDirsState(root,authority.all),signatures=authoritySignatures(root,authority.all);
  const snapshot={
    schemaVersion:'executionkit-database-integrity/v1',status:compileFindings.length?'INVALID':'CURRENT',mode:'COMPILED_AUTHORITY',framework:exists(root,'artisan')?'laravel':'generic',
    observedAt:new Date().toISOString(),fingerprint:fingerprint(signatures,[...roots,...dirs]),source:{roots,dirs,files:signatures,strategy:{schemaDumpBaseline:authority.schema.length>0,dumpAppliedMigrationCount:dumpAppliedMigrations.size,appliedMigrations:migrationsToApply.map((file)=>rel(root,file))}},
    tables:sortedObject(tables),models:sortedObject(models),modelsByFqcn:sortedObject(modelsByFqcn),ambiguousModelNames:sortedObject(ambiguousModelNames),findings:compileFindings,performance:{filesRead,durationMs:Math.round((performance.now()-started)*100)/100},
    policy:{hotPath:'manifest-metadata-only',rowDataCached:false,rule:'Never guess database structure; unresolved database facts require targeted lookup or explicit project evidence.'}
  };
  if(write){
    const file=snapshotPath(root);ensureParent(file);fs.writeFileSync(file,JSON.stringify(snapshot,null,2)+'\n');
    const schemaStat=statSig(file);
    const manifest={
      schemaVersion:'executionkit-database-integrity-manifest/v1',
      status:snapshot.status,observedAt:snapshot.observedAt,fingerprint:snapshot.fingerprint,
      source:snapshot.source,findings:snapshot.findings??[],
      tableCount:Object.keys(snapshot.tables??{}).length,
      modelCount:Object.keys(snapshot.modelsByFqcn??snapshot.models??{}).length,
      schema:{path:SNAPSHOT_REL,...schemaStat},
      performance:snapshot.performance,
      policy:{hotPath:'manifest-metadata-only',rowDataCached:false}
    };
    fs.writeFileSync(manifestPath(root),JSON.stringify(manifest,null,2)+'\n');
    snapshot.path=SNAPSHOT_REL;snapshot.manifestPath=MANIFEST_REL;
  }
  return snapshot;
}

export function inspectDatabaseIntegrity(root,{fast=true}={}){
  const started=performance.now();root=path.resolve(root);
  const obvious=AUTHORITY_ROOTS.some((r)=>exists(root,r))||exists(root,'artisan');
  if(!obvious)return {schemaVersion:'executionkit-database-integrity-status/v1',status:'NOT_APPLICABLE',applicable:false,cacheHit:true,contentReads:0,durationMs:Math.round((performance.now()-started)*100)/100};
  const snap=loadManifest(root);
  if(!snap){
    const authority=discoverAuthorityFiles(root);
    if(!authority.ordered.length&&!exists(root,'artisan'))return {schemaVersion:'executionkit-database-integrity-status/v1',status:'NOT_APPLICABLE',applicable:false,cacheHit:true,contentReads:0,durationMs:Math.round((performance.now()-started)*100)/100};
    return {schemaVersion:'executionkit-database-integrity-status/v1',status:'MISSING',applicable:true,cacheHit:false,contentReads:0,nextCommand:'executionkit db refresh .',durationMs:Math.round((performance.now()-started)*100)/100};
  }
  if(!fast)return {...refreshDatabaseIntegrity(root,{write:false}),cacheHit:false};
  const schemaFile=path.join(root,snap.schema?.path??SNAPSHOT_REL);
  if(!fs.existsSync(schemaFile))return {schemaVersion:'executionkit-database-integrity-status/v1',status:'STALE',applicable:true,cacheHit:false,contentReads:0,reason:'compiled-schema-missing',nextCommand:'executionkit db refresh .',durationMs:Math.round((performance.now()-started)*100)/100};
  const schemaNow=statSig(schemaFile);
  if(snap.schema&&(schemaNow.size!==snap.schema.size||schemaNow.mtimeMs!==snap.schema.mtimeMs))return {schemaVersion:'executionkit-database-integrity-status/v1',status:'STALE',applicable:true,cacheHit:false,contentReads:0,reason:'compiled-schema-drift',nextCommand:'executionkit db refresh .',durationMs:Math.round((performance.now()-started)*100)/100};
  const priorFiles=snap.source?.files??[],priorRoots=snap.source?.roots??[],priorDirs=snap.source?.dirs??[];
  for(const entry of priorFiles){const full=path.join(root,entry.path);if(!fs.existsSync(full))return {schemaVersion:'executionkit-database-integrity-status/v1',status:'STALE',applicable:true,cacheHit:false,contentReads:0,reason:'authority-file-missing',path:entry.path,nextCommand:'executionkit db refresh .',durationMs:Math.round((performance.now()-started)*100)/100};const now=statSig(full);if(now.size!==entry.size||now.mtimeMs!==entry.mtimeMs)return {schemaVersion:'executionkit-database-integrity-status/v1',status:'STALE',applicable:true,cacheHit:false,contentReads:0,reason:'authority-file-changed',path:entry.path,nextCommand:'executionkit db refresh .',durationMs:Math.round((performance.now()-started)*100)/100};}
  for(const entry of priorRoots){const full=path.join(root,entry.path),present=fs.existsSync(full);if(present!==entry.exists)return {schemaVersion:'executionkit-database-integrity-status/v1',status:'STALE',applicable:true,cacheHit:false,contentReads:0,reason:'authority-root-changed',path:entry.path,nextCommand:'executionkit db refresh .',durationMs:Math.round((performance.now()-started)*100)/100};if(present&&Math.trunc(fs.statSync(full).mtimeMs)!==entry.mtimeMs)return {schemaVersion:'executionkit-database-integrity-status/v1',status:'STALE',applicable:true,cacheHit:false,contentReads:0,reason:'authority-root-changed',path:entry.path,nextCommand:'executionkit db refresh .',durationMs:Math.round((performance.now()-started)*100)/100};}
  for(const entry of priorDirs){const full=path.join(root,entry.path);if(!fs.existsSync(full)||Math.trunc(fs.statSync(full).mtimeMs)!==entry.mtimeMs)return {schemaVersion:'executionkit-database-integrity-status/v1',status:'STALE',applicable:true,cacheHit:false,contentReads:0,reason:'authority-directory-changed',path:entry.path,nextCommand:'executionkit db refresh .',durationMs:Math.round((performance.now()-started)*100)/100};}
  if(snap.status==='INVALID')return {schemaVersion:'executionkit-database-integrity-status/v1',status:'INVALID',applicable:true,cacheHit:true,contentReads:0,findings:snap.findings??[],fingerprint:snap.fingerprint,nextCommand:'executionkit db refresh .',durationMs:Math.round((performance.now()-started)*100)/100};
  return {schemaVersion:'executionkit-database-integrity-status/v1',status:'CURRENT',applicable:true,cacheHit:true,contentReads:0,fingerprint:snap.fingerprint,tableCount:snap.tableCount??null,modelCount:snap.modelCount??null,durationMs:Math.round((performance.now()-started)*100)/100};
}

function sourceFilesAll(root){const out=[];for(const r of SOURCE_ROOTS)out.push(...walk(root,r,{extensions:CODE_EXT,limit:20000}));return unique(out).map((f)=>rel(root,f));}
function normalizeFiles(root,files){
  const out=[];
  for(const raw of (files??[])){
    const f=String(raw).replaceAll('\\','/').replace(/^\.\//,'');
    if(f==='.executionkit'||f.startsWith('.executionkit/')||f.startsWith('node_modules/')||f.startsWith('vendor/'))continue;
    const full=resolveProjectPathSafe(root,f,'Database Guard source');
    if(!fs.existsSync(full))continue;
    const stat=fs.statSync(full);
    if(stat.isDirectory()){
      for(const entry of walk(root,f,{extensions:CODE_EXT,limit:5000}))out.push(rel(root,entry));
    } else if(stat.isFile()&&CODE_EXT.has(path.extname(f).toLowerCase())){
      out.push(f);
    }
  }
  return unique(out);
}
function isSchemaAuthorityPath(file){return file.startsWith('database/migrations/')||file.startsWith('database/schema/')||/\/(?:Database\/)?Migrations\//i.test('/'+file);}
function isModelAuthorityPath(file){return file.startsWith('app/Models/')||/\/Models?\//i.test('/'+file);}
function isDatabaseAuthorityPath(file){return isSchemaAuthorityPath(file)||isModelAuthorityPath(file);}

const MODEL_RUNTIME_PROPERTIES=new Set(['exists','wasRecentlyCreated','incrementing','timestamps','connection','table','primaryKey','keyType','perPage','pivot']);
function escapeRegExp(value){return String(value).replace(/[.*+?^$()|[\]\\{}]/g,'\\$&');}
function parseTableSpec(spec){
  let raw=String(spec??'').trim().replace(/[`"]/g,'');let alias=null;
  const as=raw.match(/^(.+?)\s+as\s+([A-Za-z_][\w$]*)$/i);
  if(as){raw=as[1].trim();alias=as[2];}
  else{const plain=raw.match(/^([^\s]+)\s+([A-Za-z_][\w$]*)$/);if(plain){raw=plain[1];alias=plain[2];}}
  const parts=raw.split('.').filter(Boolean);
  const isSystemQualified=parts.length>=2&&/^(?:information_schema|pg_catalog|performance_schema|sys|mysql)$/i.test(parts[0]);
  const table=isSystemQualified?parts.join('.'):(parts.pop()??raw);
  return {table,alias};
}
function validateTable(findings,snapshot,file,table,context){
  const normalized=parseTableSpec(table).table;
  if(snapshot.tables?.[normalized]||SQL_SYSTEM_TABLES.has(normalized.toLowerCase()))return normalized;
  findings.push({code:'DB_TABLE_MISMATCH',severity:'BLOCKER',file,table:normalized,context,message:'Database table '+normalized+' is not present in canonical database truth.'});
  return normalized;
}
function resolveColumnRef(snapshot,defaultTable,column,aliases=new Map()){
  let raw=String(column??'').trim().replace(/[`"]/g,'');
  raw=raw.split(/\s+as\s+/i)[0].trim();
  if(!raw||raw==='*'||/[()]/.test(raw))return null;
  if(raw.includes('->'))raw=raw.split('->')[0];
  const parts=raw.split('.').filter(Boolean);let table=defaultTable,name=parts.at(-1);
  if(name==='*')return null;
  if(parts.length>=2){const prefix=parts.at(-2);table=aliases.get(prefix)??(snapshot.tables?.[prefix]?prefix:defaultTable);}
  return {table,name};
}
function validateColumn(findings,snapshot,file,table,column,context){
  if(typeof column==='string'&&column.includes('->'))column=column.split('->')[0];
  const t=snapshot.tables?.[table];if(!t)return validateTable(findings,snapshot,file,table,context);
  if(t.columns?.[column])return;
  findings.push({code:'DB_COLUMN_MISMATCH',severity:'BLOCKER',file,table,column,context,candidates:Object.keys(t.columns??{}).filter((x)=>x.includes(column)||column.includes(x)).slice(0,5),message:'Database column '+table+'.'+column+' is not present in canonical database truth.'});
}
function validateColumnRef(findings,snapshot,file,defaultTable,column,context,aliases=new Map()){
  const target=resolveColumnRef(snapshot,defaultTable,column,aliases);if(!target)return;
  validateColumn(findings,snapshot,file,target.table,target.name,context);
}
function modelFromToken(snapshot,token){
  if(snapshot.ambiguousModelNames?.[token])return null;
  return snapshot.models?.[token]??snapshot.modelsByFqcn?.[token]??null;
}
function importedModelAliases(snapshot,text){
  const aliases=new Map();
  for(const use of text.matchAll(/\buse\s+([^;]+);/g)){
    const raw=use[1].trim();if(raw.includes('{'))continue;
    const m=raw.match(/^([^\s]+)(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?$/i);if(!m)continue;
    const fqcn=m[1].replace(/^\\/,'');
    const model=snapshot.modelsByFqcn?.[fqcn];if(!model)continue;
    aliases.set(m[2]??model.name,model);
  }
  return aliases;
}
function modelAttributeAllowed(snapshot,model,attribute){
  if(!model||model.certainty==='INFERRED_UNRESOLVED')return true;
  if(snapshot.tables?.[model.table]?.columns?.[attribute])return true;
  if((model.virtualAttributes??[]).includes(attribute))return true;
  if((model.relations??[]).some((r)=>r.name===attribute))return true;
  if(MODEL_RUNTIME_PROPERTIES.has(attribute))return true;
  return false;
}
function validateModelAttribute(findings,snapshot,file,model,attribute,context){
  if(modelAttributeAllowed(snapshot,model,attribute))return;
  findings.push({code:'DB_MODEL_ATTRIBUTE_MISMATCH',severity:'BLOCKER',file,model:model.fqcn??model.name,table:model.table,column:attribute,context,candidates:Object.keys(snapshot.tables?.[model.table]?.columns??{}).filter((x)=>x.includes(attribute)||attribute.includes(x)).slice(0,5),message:'Model attribute '+model.name+'.'+attribute+' is not present in current database/model truth.'});
}
function dedupeFindings(findings){
  const seen=new Set(),out=[];for(const item of findings){const key=[item.code,item.file,item.table,item.column,item.model,item.relation,item.context].join('|');if(seen.has(key))continue;seen.add(key);out.push(item);}return out;
}

function validatePhpFile(snapshot,file,text){
  const findings=[];

  for(const tm of text.matchAll(/DB::table\s*\(\s*['"]([^'"]+)['"]\s*\)([\s\S]{0,4000}?)(?:;|\n\s*\n|$)/g)){
    const base=parseTableSpec(tm[1]),table=validateTable(findings,snapshot,file,base.table,'DB::table'),chain=tm[2],aliases=new Map();
    aliases.set(table,table);if(base.alias)aliases.set(base.alias,table);
    for(const jm of chain.matchAll(/->(?:join|leftJoin|rightJoin|crossJoin)\s*\(\s*['"]([^'"]+)['"]/g)){
      const joined=parseTableSpec(jm[1]),jt=validateTable(findings,snapshot,file,joined.table,'query-builder-join');aliases.set(jt,jt);if(joined.alias)aliases.set(joined.alias,jt);
    }
    for(const cm of chain.matchAll(/->(?:where|orWhere|whereIn|whereNotIn|whereNull|whereNotNull|whereColumn|orderBy|groupBy|having|pluck|value)\s*\(\s*['"]([^'"]+)['"]/g))validateColumnRef(findings,snapshot,file,table,cm[1],'query-builder',aliases);
    for(const sm of chain.matchAll(/->(?:select|addSelect)\s*\(([^)]*)\)/g))for(const c of sm[1].matchAll(/['"]([^'"]+)['"]/g))validateColumnRef(findings,snapshot,file,table,c[1],'query-builder-select',aliases);
    for(const wm of chain.matchAll(/->(?:insert|insertOrIgnore|insertGetId|update|updateOrInsert|upsert)\s*\(\s*\[([\s\S]{0,2500}?)\]\s*(?:,|\))/g))for(const key of parseArrayKeys(wm[1]))validateColumn(findings,snapshot,file,table,key,'query-builder-write');
  }

  for(const mm of text.matchAll(/\b([A-Z][A-Za-z0-9_]*)::(?:query\(\)\s*->)?(?:where|whereIn|whereNotIn|whereNull|whereNotNull|whereColumn|orderBy|groupBy|pluck|value)\s*\(\s*['"]([^'"]+)['"]/g)){
    const model=modelFromToken(snapshot,mm[1]);if(!model||model.certainty==='INFERRED_UNRESOLVED')continue;validateColumnRef(findings,snapshot,file,model.table,mm[2],'eloquent:'+mm[1]);
  }
  for(const sm of text.matchAll(/\b([A-Z][A-Za-z0-9_]*)::(?:query\(\)\s*->)?(?:select|addSelect)\s*\(([^)]*)\)/g)){
    const model=modelFromToken(snapshot,sm[1]);if(!model||model.certainty==='INFERRED_UNRESOLVED')continue;
    for(const c of sm[2].matchAll(/['"]([^'"]+)['"]/g))validateColumnRef(findings,snapshot,file,model.table,c[1],'eloquent-select:'+sm[1]);
  }
  for(const wm of text.matchAll(/\b([A-Z][A-Za-z0-9_]*)::(?:query\(\)\s*->)?(?:create|forceCreate|firstOrCreate|updateOrCreate|insert|upsert)\s*\(\s*\[([\s\S]{0,3000}?)\]\s*(?:,|\))/g)){
    const model=modelFromToken(snapshot,wm[1]);if(!model||model.certainty==='INFERRED_UNRESOLVED')continue;
    for(const key of parseArrayKeys(wm[2]))validateColumn(findings,snapshot,file,model.table,key,'eloquent-write:'+wm[1]);
  }
  for(const wm of text.matchAll(/\b([A-Z][A-Za-z0-9_]*)::[^;]{0,3000}?->(?:update|fill|forceFill)\s*\(\s*\[([\s\S]{0,2500}?)\]\s*\)/g)){
    const model=modelFromToken(snapshot,wm[1]);if(!model||model.certainty==='INFERRED_UNRESOLVED')continue;
    for(const key of parseArrayKeys(wm[2]))validateColumn(findings,snapshot,file,model.table,key,'eloquent-chained-write:'+wm[1]);
  }

  const imported=importedModelAliases(snapshot,text),variables=new Map();
  function addVariable(name,model){if(!model)return;if(!variables.has(name))variables.set(name,new Set());variables.get(name).add(model);}
  for(const m of text.matchAll(/(?:[\s,(])([A-Za-z0-9_\\|?]+)\s+\$([A-Za-z_][A-Za-z0-9_]*)/g)){
    for(let t of m[1].split('|')){
      t=t.replace(/^\?/,'').trim();
      const token=t.split('\\').pop();
      const model=imported.get(token)??modelFromToken(snapshot,token);
      if(model)addVariable(m[2],model);
    }
  }
  for(const assign of text.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Z][A-Za-z0-9_]*)::(?:find|findOrFail|first|firstOrFail|query|where|create)\b/g)){
    const model=imported.get(assign[2])??modelFromToken(snapshot,assign[2]);if(model)addVariable(assign[1],model);
  }
  for(const [variable,modelsSet] of variables){
    const models=Array.from(modelsSet);
    const assignRe=new RegExp('\\$'+escapeRegExp(variable)+'->([A-Za-z_][A-Za-z0-9_]*)\\s*=(?![=>])','g');
    for(const m of text.matchAll(assignRe)){
      const attr=m[1];
      if(!models.some((model)=>modelAttributeAllowed(snapshot,model,attr))){
        validateModelAttribute(findings,snapshot,file,models[0],attr,'model-attribute-assignment');
      }
    }
    const arrayRe=new RegExp('\\$'+escapeRegExp(variable)+'->(?:update|fill|forceFill)\\s*\\(\\s*\\[([\\s\\S]{0,2500}?)\\]\\s*\\)','g');
    for(const m of text.matchAll(arrayRe)){
      for(const key of parseArrayKeys(m[1])){
        const baseKey=key.includes('->')?key.split('->')[0]:key;
        if(!models.some((model)=>snapshot.tables?.[model.table]?.columns?.[baseKey])){
          validateColumn(findings,snapshot,file,models[0].table,baseKey,'model-instance-write');
        }
      }
    }
  }

  const ownModel=(snapshot.modelsByFqcn?Object.values(snapshot.modelsByFqcn):Object.values(snapshot.models??{})).find((m)=>m.file===file);
  if(ownModel&&ownModel.certainty!=='INFERRED_UNRESOLVED')for(const c of ownModel.declaredColumns??[])validateColumn(findings,snapshot,file,ownModel.table,c,'model-declared-column');

  for(const strMatch of text.matchAll(/['"`]([\s\S]*?)['"`]/g)){
    const sql=strMatch[1];
    if(!/\b(?:SELECT\b[\s\S]+?\bFROM|INSERT\s+INTO|UPDATE\s+[`"A-Za-z_].+?\bSET|DELETE\s+FROM)\b/.test(sql))continue;
    for(const del of sql.matchAll(/\bDELETE\s+FROM\s+([`"A-Za-z_][\w$.`"]*)/gi))validateTable(findings,snapshot,file,parseTableSpec(del[1]).table,'raw-sql');
    for(const sel of sql.matchAll(/\bSELECT\s+([\s\S]{1,1200}?)\s+FROM\s+([`"A-Za-z_][\w$.`"]*)/g)){
      const table=parseTableSpec(sel[2]).table;
      validateTable(findings,snapshot,file,table,'raw-sql-select');
      if(!snapshot.tables?.[table])continue;
      for(const part of sel[1].split(',')){const token=part.trim();if(/^[`"A-Za-z_][\w$.`"]*(?:\s+AS\s+[A-Za-z_][\w$]*)?$/i.test(token))validateColumnRef(findings,snapshot,file,table,token,'raw-sql-select');}
    }
    for(const ins of sql.matchAll(/\bINSERT\s+INTO\s+([`"A-Za-z_][\w$.`"]*)\s*\(([^)]*)\)/gi)){
      const table=parseTableSpec(ins[1]).table;
      validateTable(findings,snapshot,file,table,'raw-sql-insert');
      if(!snapshot.tables?.[table])continue;
      for(const col of ins[2].split(',').map((x)=>x.trim().replace(/[`"]/g,'')).filter(Boolean))validateColumn(findings,snapshot,file,table,col,'raw-sql-insert');
    }
    for(const upd of sql.matchAll(/\bUPDATE\s+([`"A-Za-z_][\w$.`"]*)\s+SET\s+([\s\S]{1,1200}?)(?:\bWHERE\b|;|$)/gi)){
      const table=parseTableSpec(upd[1]).table;
      validateTable(findings,snapshot,file,table,'raw-sql-update');
      if(!snapshot.tables?.[table])continue;
      for(const m of upd[2].matchAll(/(?:^|,)\s*[`"]?([A-Za-z_][\w$]*)[`"]?\s*=/g))validateColumn(findings,snapshot,file,table,m[1],'raw-sql-update');
    }
  }
  return dedupeFindings(findings);
}

export function guardDatabaseReferences(root,{files=null,mode='changed',all=false,autoRefresh=true}={}){
  if(all)mode='all';
  const started=performance.now();root=path.resolve(root);
  if(files===null&&mode==='changed'){
    const outputs=[['diff','--name-only','-z','HEAD'],['ls-files','--others','--exclude-standard','-z']].map(args=>spawnSync('git',args,{cwd:root,encoding:'utf8',timeout:15000,maxBuffer:8*1024*1024,windowsHide:true,shell:false}));
    if(outputs.some(result=>result.error||result.status!==0))return {schemaVersion:'executionkit-database-guard/v1',status:'BLOCKED',ok:false,reason:'CHANGED_FILES_UNAVAILABLE',nextCommand:'executionkit db guard . --all',findings:[]};
    files=[...new Set(outputs.flatMap(result=>result.stdout.split('\0').filter(Boolean)))];
    if(!files.length){
      const prev=spawnSync('git',['diff','--name-only','-z','HEAD~1','HEAD'],{cwd:root,encoding:'utf8',timeout:15000,maxBuffer:8*1024*1024,windowsHide:true,shell:false});
      if(!prev.error&&prev.status===0)files=[...new Set(prev.stdout.split('\0').filter(Boolean))];
    }
    files=files.filter(f=>{const norm=String(f).replaceAll('\\','/').replace(/^\.\//,'');return SOURCE_ROOTS.some(r=>norm===r||norm.startsWith(r+'/'));});
  }
  const selected=normalizeFiles(root,files??(mode==='all'?sourceFilesAll(root):[]));
  let contentReads=0;const relevant=[];
  for(const file of selected){const text=safeRead(path.join(root,file));if(text===null)continue;contentReads++;if(DB_MARKER.test(text)||isDatabaseAuthorityPath(file))relevant.push({file,text});}
  if(!relevant.length)return {schemaVersion:'executionkit-database-guard/v1',status:'NOT_APPLICABLE',ok:true,findings:[],performance:{filesScanned:selected.length,contentReads,durationMs:Math.round((performance.now()-started)*100)/100,fastExit:true}};
  let status=inspectDatabaseIntegrity(root,{fast:true});
  if(['MISSING','STALE'].includes(status.status)&&autoRefresh){refreshDatabaseIntegrity(root,{write:true});status=inspectDatabaseIntegrity(root,{fast:true});}
  if(status.status==='NOT_APPLICABLE'&&!relevant.some(item=>SOURCE_ROOTS.some(r=>item.file===r||item.file.startsWith(r+'/'))||/\.(?:php|sql|prisma)$/i.test(item.file)))return {schemaVersion:'executionkit-database-guard/v1',status:'NOT_APPLICABLE',ok:true,databaseStatus:status,findings:[],performance:{filesScanned:selected.length,contentReads,durationMs:Math.round((performance.now()-started)*100)/100,fastExit:true}};
  if(status.status!=='CURRENT')return {schemaVersion:'executionkit-database-guard/v1',status:'BLOCKED',ok:false,reason:'DATABASE_TRUTH_UNAVAILABLE',databaseStatus:status,nextCommand:'executionkit db refresh .',findings:[],performance:{filesScanned:selected.length,contentReads,durationMs:Math.round((performance.now()-started)*100)/100}};
  const snapshot=loadSnapshot(root),findings=[];
  for(const item of relevant){if(isSchemaAuthorityPath(item.file))continue;findings.push(...validatePhpFile(snapshot,item.file,item.text));}
  return {schemaVersion:'executionkit-database-guard/v1',status:findings.length?'FAIL':'PASS',ok:findings.length===0,findings,databaseFingerprint:snapshot.fingerprint,performance:{filesScanned:selected.length,relevantFiles:relevant.length,contentReads,durationMs:Math.round((performance.now()-started)*100)/100}};
}

export function resolveDatabaseTruth(root,{table=null,column=null,model=null}={}){
  root=path.resolve(root);let status=inspectDatabaseIntegrity(root,{fast:true});if(['MISSING','STALE'].includes(status.status)){refreshDatabaseIntegrity(root,{write:true});status=inspectDatabaseIntegrity(root,{fast:true});}
  if(status.status!=='CURRENT')return {schemaVersion:'executionkit-database-resolve/v1',status:'BLOCKED',databaseStatus:status};
  const snapshot=loadSnapshot(root);
  if(model){
    const direct=snapshot.modelsByFqcn?.[model]??snapshot.models?.[model];
    if(direct)return {schemaVersion:'executionkit-database-resolve/v1',status:'FOUND',kind:'model',value:direct};
    const ambiguous=snapshot.ambiguousModelNames?.[model];
    if(ambiguous)return {schemaVersion:'executionkit-database-resolve/v1',status:'AMBIGUOUS',kind:'model',model,candidates:ambiguous};
    return {schemaVersion:'executionkit-database-resolve/v1',status:'NOT_FOUND',kind:'model',model};
  }
  if(table){const t=snapshot.tables?.[table];if(!t)return {schemaVersion:'executionkit-database-resolve/v1',status:'NOT_FOUND',kind:'table',table,candidates:Object.keys(snapshot.tables??{}).filter((x)=>x.includes(table)||table.includes(x)).slice(0,10)};if(column){const c=t.columns?.[column];return c?{schemaVersion:'executionkit-database-resolve/v1',status:'FOUND',kind:'column',table,column,value:c}:{schemaVersion:'executionkit-database-resolve/v1',status:'NOT_FOUND',kind:'column',table,column,candidates:Object.keys(t.columns??{}).filter((x)=>x.includes(column)||column.includes(x)).slice(0,10)};}return {schemaVersion:'executionkit-database-resolve/v1',status:'FOUND',kind:'table',value:t};}
  return {schemaVersion:'executionkit-database-resolve/v1',status:'FOUND',kind:'summary',tables:Object.keys(snapshot.tables??{}),models:snapshot.models??{},fingerprint:snapshot.fingerprint};
}
