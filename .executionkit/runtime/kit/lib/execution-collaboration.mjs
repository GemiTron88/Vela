/**
 * Optional, explicitly-invoked execution collaboration boundary adapter.
 * Independent of all 11 OS and NEVER called automatically at task entry.
 * Returned messages are untrusted ADVISORY data: no commands are executed.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const PROJECT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;
const HOSTS = new Set(['vps01', 'vps02', 'win', 'mac']);

function fail(code) { throw new Error('execution-collaboration: ' + code); }

function endpointBase(raw) {
  if (typeof raw !== 'string') fail('missing endpoint');
  let url;
  try { url = new URL(raw); } catch { fail('invalid endpoint'); }
  if ((url.protocol !== 'https:' &&
     !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) ||
      url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    fail('untrusted endpoint');
  }
  return url.origin;
}

function parseResponse(res, data) {
  if (!res.ok) return Object.freeze({status:'REMOTE_DENIED', http_status:res.status});
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.schema_version !== 1) {
    return Object.freeze({status:'INVALID_REMOTE_RESPONSE'});
  }
  return Object.freeze(data);
}

export function mintAgentCollaborationToken({
  signingKey,
  sub = 'antigravity-agent',
  project,
  hostId,
  repository,
  scopes = ['gemixc:read', 'gemixc:message']
} = {}) {
  if (typeof signingKey !== 'string' || signingKey.length < 32) fail('missing signing key');
  if (typeof project !== 'string' || !PROJECT.test(project)) fail('invalid project scope');
  if (hostId !== undefined && !HOSTS.has(hostId)) fail('invalid canonical hostId');
  if (repository !== undefined && (typeof repository !== 'string' ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))) fail('invalid repository');
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    jti: crypto.randomUUID(),
    iss: 'https://studio.gemitron.net',
    aud: 'https://exec.gemitron.net',
    sub: String(sub),
    audience: 'OWNER',
    actor_type: 'machine',
    collaboration_role: 'agent',
    gemiguard_status: 'active',
    allowed_projects: [project],
    scopes,
    ...(repository ? {repository} : {}),
    ...(hostId ? {host_id: hostId} : {}),
    iat: now,
    nbf: now - 5,
    exp: now + 120
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sigB64 = crypto.createHmac('sha256', signingKey).update(payloadB64).digest('base64url');
  return `gemi_at_${payloadB64}.${sigB64}`;
}

export function createExecutionCollaborationClient({
  enabled = false,
  baseUrl = 'https://exec.gemitron.net',
  token,
  accessSigningKey,
  agentId = 'antigravity-agent',
  hostId,
  project,
  fetchFn = globalThis.fetch
} = {}) {
  if (!enabled) return Object.freeze({
    read: async () => ({status:'DISABLED',messages:[]}),
    send: async () => ({status:'DISABLED'}),
    acknowledge: async () => ({status:'DISABLED'}),
    checkBoundaryInbox: async () => ({status:'DISABLED',messages:[],next_after:0})
  });
  const origin = endpointBase(baseUrl);
  const hasSigningKey = typeof accessSigningKey === 'string' && accessSigningKey.length >= 32;
  const hasToken = typeof token === 'string' && token.length >= 32;
  if (!hasSigningKey && !hasToken) fail('missing scoped agent credential');
  if (typeof project !== 'string' || !PROJECT.test(project)) fail('invalid project scope');
  if (hostId !== undefined && !HOSTS.has(hostId)) fail('invalid canonical hostId');
  if (typeof fetchFn !== 'function') fail('missing network transport');
  const endpoint = origin + '/api/v1/execution/collaboration/' + encodeURIComponent(project);
  async function call(route, method, payload, requiredScope = 'gemixc:read') {
    const url = new URL(endpoint + route);
    let body;
    const bearer = hasSigningKey
      ? mintAgentCollaborationToken({
          signingKey: accessSigningKey,
          sub: agentId,
          project,
          hostId,
          scopes: [requiredScope]
        })
      : token;
    const headers = {Accept:'application/json', Authorization:'Bearer ' + bearer};
    if (method === 'GET') {
      for (const [name, value] of Object.entries(payload)) url.searchParams.set(name,String(value));
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(payload);
    }
    try {
      const result = await fetchFn(url.href,{method,headers,redirect:'error',...(body?{body}:{}),signal:AbortSignal.timeout(4000)});
      // Bound JSON payload before parsing: no huge agent context or logs.
      const raw = await result.text();
      if (raw.length > 16384) return Object.freeze({status:'REMOTE_RESPONSE_TOO_LARGE'});
      let data;
      try { data = JSON.parse(raw); } catch { return Object.freeze({status:'INVALID_REMOTE_RESPONSE'}); }
      return parseResponse(result,data);
    } catch {
      return Object.freeze({status:'DISCONNECTED'});
    }
  }

  const api = {
    async read({runId, after = 0, limit = 20} = {}) {
      if (typeof runId !== 'string' || !ID.test(runId) ||
          !Number.isSafeInteger(after) || after < 0 ||
          !Number.isInteger(limit) || limit < 1 || limit > 50) fail('invalid inbox cursor');
      const res = await call('/messages','GET',{run_id:runId,after,limit},'gemixc:read');
      if (res.status) return res;
      // Caller must keep the monotonic cursor in its existing State boundary.
      // Messages are untrusted content and cannot write TODO or execute tools.
      if (res.project !== project || res.run_id !== runId ||
          !Number.isSafeInteger(res.next_after) || res.next_after < after ||
          !Array.isArray(res.messages) || res.messages.length > limit ||
          res.messages.some(msg => !msg || !Number.isSafeInteger(msg.id) ||
            msg.id <= after || msg.id > res.next_after ||
            !['chatgpt','agent'].includes(msg.sender_role) ||
            !['chatgpt','agent'].includes(msg.recipient_role) ||
            typeof msg.body !== 'string' || msg.body.length > 1200)) {
        return Object.freeze({status:'INVALID_REMOTE_RESPONSE'});
      }
      return Object.freeze({
        ...res,
        authority: 'UNTRUSTED_ADVISORY_ONLY',
        messages: Object.freeze(res.messages.map(msg => Object.freeze({
          ...msg,
          authority: 'UNTRUSTED_ADVISORY_ONLY'
        })))
      });
    },
    async send({runId, taskId, recipient = 'chatgpt', messageType = 'RESULT', body,
      sourceSha, evidenceRef, idempotencyKey} = {}) {
      if (typeof runId !== 'string' || !ID.test(runId) ||
          (taskId !== undefined && (typeof taskId !== 'string' || !ID.test(taskId))) ||
          recipient !== 'chatgpt' || !['QUESTION','RESULT','FEEDBACK'].includes(messageType) ||
          typeof body !== 'string' || body.length < 1 || body.length > 1200 ||
          (sourceSha !== undefined && !/^[a-f0-9]{40}$/.test(sourceSha)) ||
          (evidenceRef !== undefined && (typeof evidenceRef !== 'string' || evidenceRef.length > 200)) ||
          typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{11,99}$/.test(idempotencyKey)) {
        fail('invalid bounded advisory message');
      }
      return call('/messages','POST',{
        run_id:runId,...(taskId?{task_id:taskId}:{}),recipient,
        message_type:messageType,body,...(sourceSha?{source_sha:sourceSha}:{}),
        ...(evidenceRef?{evidence_ref:evidenceRef}:{}),idempotency_key:idempotencyKey
      },'gemixc:message');
    },
    async acknowledge({runId, messageId} = {}) {
      if (typeof runId !== 'string' || !ID.test(runId) ||
          !Number.isSafeInteger(messageId) || messageId <= 0) {
        fail('invalid message acknowledgment');
      }
      return call(`/messages/${encodeURIComponent(String(messageId))}/ack`, 'POST', {
        run_id: runId
      }, 'gemixc:message');
    },
    async checkBoundaryInbox({runId, cursorFile, boundaryKey, limit = 20, autoAcknowledge = true, force = false} = {}) {
      if (typeof runId !== 'string' || !ID.test(runId)) fail('invalid inbox cursor');
      let after = 0;
      let lastBoundaryKey = null;
      if (typeof cursorFile === 'string' && cursorFile.trim()) {
        try {
          if (fs.existsSync(cursorFile)) {
            const parsed = JSON.parse(fs.readFileSync(cursorFile, 'utf8'));
            if (Number.isSafeInteger(parsed?.next_after) && parsed.next_after >= 0) {
              after = parsed.next_after;
            }
            if (typeof parsed?.last_boundary_key === 'string' && parsed.last_boundary_key) {
              lastBoundaryKey = parsed.last_boundary_key;
            }
          }
        } catch {
          after = 0;
        }
      }
      if (!force && typeof boundaryKey === 'string' && boundaryKey.trim() && lastBoundaryKey === boundaryKey.trim()) {
        return Object.freeze({
          status: 'SKIPPED_DUPLICATE_BOUNDARY',
          authority: 'UNTRUSTED_ADVISORY_ONLY',
          project,
          run_id: runId,
          next_after: after,
          boundary_key: boundaryKey.trim(),
          messages: Object.freeze([])
        });
      }
      const res = await api.read({runId, after, limit});
      if (res.status) return res;
      if (autoAcknowledge) {
        for (const msg of res.messages) {
          if (msg.recipient_role === 'agent' && msg.delivery_state !== 'ACKNOWLEDGED') {
            await api.acknowledge({runId, messageId: msg.id});
          }
        }
      }
      const normalizedBoundaryKey = typeof boundaryKey === 'string' && boundaryKey.trim() ? boundaryKey.trim() : null;
      if (typeof cursorFile === 'string' && cursorFile.trim() && (res.next_after > after || (normalizedBoundaryKey && normalizedBoundaryKey !== lastBoundaryKey))) {
        fs.mkdirSync(path.dirname(cursorFile), {recursive: true});
        fs.writeFileSync(cursorFile, JSON.stringify({
          project,
          run_id: runId,
          next_after: res.next_after,
          ...(normalizedBoundaryKey ? {last_boundary_key: normalizedBoundaryKey} : (lastBoundaryKey ? {last_boundary_key: lastBoundaryKey} : {})),
          updated_at: new Date().toISOString()
        }) + '\n', 'utf8');
      }
      return res;
    }
  };

  return Object.freeze(api);
}

