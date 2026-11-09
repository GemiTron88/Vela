import {DatabaseSync,backup} from 'node:sqlite';
import {stat} from 'node:fs/promises';
import {need} from './contracts.mjs';
const [source,destination]=process.argv.slice(2);need(source&&destination&&source!==destination,'Usage: node src/backup-cli.mjs state/release.db fresh-backup.db');
need(await stat(destination).then(()=>false,()=>true),'BACKUP_DESTINATION_EXISTS');
const db=new DatabaseSync(source,{readOnly:true});
try{await backup(db,destination);console.log(JSON.stringify({status:'SQLITE_BACKUP_COMPLETE',artifacts:'COPY_IMMUTABLE_ARTIFACT_DIRECTORY_AND_SECRET_KEYS_SEPARATELY'}));}finally{db.close();}
