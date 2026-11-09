import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {canonical, hash, need, uuid} from './contracts.mjs';
export class Store {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
    this.db.exec(readFileSync(new URL('../migrations/001.sql', import.meta.url), 'utf8'));
    this.db.exec(readFileSync(new URL('../migrations/002.sql', import.meta.url), 'utf8'));
    this.db.exec(readFileSync(new URL('../migrations/003.sql', import.meta.url), 'utf8'));
    this.db.exec(readFileSync(new URL('../migrations/004.sql', import.meta.url), 'utf8'));
    this.db.exec(readFileSync(new URL('../migrations/005.sql', import.meta.url), 'utf8'));
    this.db.exec(readFileSync(new URL('../migrations/006.sql', import.meta.url), 'utf8'));
  }
  one(sql, ...args) { return this.db.prepare(sql).get(...args); }
  all(sql, ...args) { return this.db.prepare(sql).all(...args); }
  run(sql, ...args) { return this.db.prepare(sql).run(...args); }
  tx(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  event(actor, project, action, data, correlationId) {
    const previous_hash = this.one('SELECT event_hash FROM journal ORDER BY sequence DESC LIMIT 1')?.event_hash ?? '0'.repeat(64);
    const item = {timestamp: new Date().toISOString(), actor, project, action, correlation_id: correlationId, previous_hash, data};
    this.run('INSERT INTO journal(timestamp,actor,project,action,correlation_id,previous_hash,event_hash,data) VALUES(?,?,?,?,?,?,?,?)', item.timestamp, actor, project, action, correlationId, previous_hash, hash(canonical(item)), canonical(data));
  }
  operation(actor, project, key, action, body, fn) {
    need(typeof key === 'string' && /^[A-Za-z0-9_.:-]{8,128}$/.test(key), 'IDEMPOTENCY_KEY_REQUIRED');
    const digest = hash(canonical({action, body}));
    return this.tx(() => {
      const old = this.one('SELECT * FROM operations WHERE actor=? AND project=? AND key=?', actor, project, key);
      if (old) { need(old.digest === digest, 'IDEMPOTENCY_CONFLICT', 409); return JSON.parse(old.result); }
      const result = fn();
      this.event(actor, project, action, {idempotency_key:key,result}, uuid());
      this.run('INSERT INTO operations VALUES(?,?,?,?,?)', actor, project, key, digest, canonical(result));
      return result;
    });
  }
  close() { this.db.close(); }
}
