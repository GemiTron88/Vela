import {readFile,writeFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
import {canonical,need} from './contracts.mjs';
const [input,output]=process.argv.slice(2);need(input&&output,'Usage: node src/approval-cli.mjs reviewed-payload.json new-signed-approval.json');
const key=process.env.MOBILE_RELEASE_APPROVAL_KEY;need(key?.length>=32,'APPROVER_SECRET_REQUIRED');
const payload=JSON.parse(await readFile(input));const end=Date.parse(payload.expires_at);
need(payload.project&&payload.action&&end>Date.now()&&end<=Date.now()+86400000,'INVALID_APPROVAL_SCOPE_OR_EXPIRY');
await writeFile(output,canonical({payload,signature:createHmac('sha256',key).update(canonical(payload)).digest('hex')})+'\n',{mode:0o600,flag:'wx'});
console.log(JSON.stringify({status:'OPERATOR_APPROVAL_SIGNED',execution:'NOT_PERFORMED'}));
