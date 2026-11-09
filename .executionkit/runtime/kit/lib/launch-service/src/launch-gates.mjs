import {createPublicKey,verify} from 'node:crypto';
import {canonical,fields,need,slug,sha,commit} from './contracts.mjs';

export function verifyLaunchGate(signed,project,repository,keys,now=Date.now()) {
  fields(signed,['key_id','payload','signature']);slug(signed.key_id);
  const p=signed.payload;
  fields(p,['schema','id','project','repository','commit','candidate_id','artifact_sha256','issued_at','expires_at','gates']);
  need(p.schema==='executionkit-mobile-release-gate/v1'&&p.project===project&&p.repository===repository,'LAUNCH_GATE_SCOPE_MISMATCH',403);
  need(typeof p.id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(p.id)&&typeof p.candidate_id==='string'&&p.candidate_id.length>0&&p.candidate_id.length<=200,'LAUNCH_GATE_ID_INVALID');
  commit(p.commit);sha(p.artifact_sha256);fields(p.gates,['test','audit','visual','providers']);
  for(const [name,g] of Object.entries(p.gates)) {
    fields(g,['status','evidence_sha256']);sha(g.evidence_sha256);
    need(['PASS','FAIL',...(['visual','providers'].includes(name)?['NOT_APPLICABLE']:[])].includes(g.status),'LAUNCH_GATE_STATUS_INVALID');
  }
  const issued=Date.parse(p.issued_at),expires=Date.parse(p.expires_at);
  need(Number.isFinite(issued)&&Number.isFinite(expires)&&issued<=now+300000&&expires>issued&&expires-issued<=86400000+60000,'LAUNCH_GATE_TIME_INVALID');
  const pem=keys?.[project]?.[signed.key_id];need(pem,'LAUNCH_GATE_KEY_UNKNOWN',403);
  let valid=false;
  try {
    const key=createPublicKey(pem);
    valid=key.asymmetricKeyType==='ed25519'&&typeof signed.signature==='string'&&/^[a-f0-9]{128}$/.test(signed.signature)
      &&verify(null,Buffer.from(canonical(p)),key,Buffer.from(signed.signature,'hex'));
  } catch {}
  need(valid,'LAUNCH_GATE_SIGNATURE_INVALID',401);
  return {...p,status:expires<=now?'EXPIRED':Object.values(p.gates).some(g=>g.status==='FAIL')?'FAIL':'PASS'};
}

