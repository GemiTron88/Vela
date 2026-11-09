#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schemaVersion = 'executionkit-launch-service-cli/v1';
const usage = [
  'launch-service start [--config <file>] [--port <1-65535>]',
  'launch-service status [--config <file>] [--port <1-65535>]',
  'launch-service help|--help|-h'
];
const output = (value, exitCode = 0) => {
  const stream = exitCode ? process.stderr : process.stdout;
  stream.write(JSON.stringify({ schemaVersion, ...value }) + '\n');
  process.exitCode = exitCode;
};
function invalid(message) {
  const error = new Error(message);
  error.cliError = true;
  throw error;
}
function parseArgs(args) {
  const result = { action: 'start', configPath: null, port: null };
  if (['help', '--help', '-h'].some(alias => args.includes(alias))) return { ...result, action: 'help' };
  if (args[0] && !args[0].startsWith('--')) {
    if (['start', 'status'].includes(args[0])) {
      result.action = args.shift();
      if (args[0] && !args[0].startsWith('--') && (args[0] === '.' || existsSync(args[0]))) args.shift();
    } else if ((args[0] === '.' || existsSync(args[0])) && ['start', 'status'].includes(args[1])) {
      args.shift();
      result.action = args.shift();
    } else {
      result.action = args.shift();
    }
  }
  if (!['start', 'status'].includes(result.action)) invalid('Unknown launch service action: ' + result.action);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (['--json', '--human', '--full-output', '--progress', '--timing', '--color'].includes(arg)) continue;
    if (arg === '--config' || arg === '--port' || arg.startsWith('--config=') || arg.startsWith('--port=')) {
      const isEq = arg.includes('=');
      const flag = isEq ? arg.slice(0, arg.indexOf('=')) : arg;
      const value = isEq ? arg.slice(arg.indexOf('=') + 1) : args[++i];
      if (!value || value.startsWith('--')) invalid('Missing value for ' + flag);
      if (flag === '--config') {
        if (result.configPath !== null) invalid('Duplicate --config');
        result.configPath = value;
      } else {
        if (result.port !== null) invalid('Duplicate --port');
        result.port = value;
      }
    } else invalid('Unknown launch service argument: ' + arg);
  }
  return result;
}
function portNumber(value) {
  if (!/^[0-9]+$/.test(String(value))) invalid('Port must be an integer between 1 and 65535');
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) invalid('Port must be an integer between 1 and 65535');
  return port;
}
function configPath(args) {
  const explicit = args.configPath ?? process.env.LAUNCH_SERVICE_CONFIG ?? process.env.MOBILE_RELEASE_CONFIG;
  if (explicit !== undefined && explicit !== null) {
    if (!explicit || !existsSync(explicit)) throw new Error('Launch service configuration not found: ' + explicit);
    return resolve(explicit);
  }
  return ['config/service.json', 'config/launch-service.json'].map(p => resolve(p)).find(p => existsSync(p)) ?? null;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.action === 'help') {
    output({ status: 'OK', commands: ['start', 'status', 'help'], usage });
  } else {
    // Validate explicit input before any imports, network requests or state writes.
    if (args.port !== null) args.port = portNumber(args.port);
    const resolvedConfigPath = configPath(args);
    const declared = resolvedConfigPath ? JSON.parse(readFileSync(resolvedConfigPath, 'utf8')) : {};
    if (args.action === 'status') {
      const port = portNumber(args.port ?? process.env.LAUNCH_SERVICE_PORT ?? declared.port ?? 8088);
      const host = process.env.LAUNCH_SERVICE_HOST ?? declared.host ?? '127.0.0.1';
      const url = new URL('http://' + (host.includes(':') && !host.startsWith('[') ? '[' + host + ']' : host) + ':' + port + '/readyz').href;
      try {
        const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(3000), redirect: 'error' });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = null; }
        const ready = res.ok && data?.status === 'ready' && Number.isSafeInteger(data.schema) && data.schema >= 1;
        output({ status: ready ? 'RUNNING' : 'UNHEALTHY', service_status: data?.status ?? null, schema: data?.schema ?? null, http_status: res.status, url }, ready ? 0 : 1);
      } catch (error) {
        output({ status: 'STOPPED', url, error: error.message }, 1);
      }
    } else {
      if (!resolvedConfigPath) throw new Error('No launch service configuration file found');
      // Optional service requires SQLite/online-backup support; core CLI remains Node >=20.
      const sqlite = await import('node:sqlite');
      if (typeof sqlite.DatabaseSync !== 'function' || typeof sqlite.backup !== 'function') throw new Error('LAUNCH_SERVICE_SQLITE_RUNTIME_REQUIRED: use a Node runtime with DatabaseSync and online backup');
      const { loadConfig, createServer } = await import('../lib/launch-service/src/server.mjs');
      const config = await loadConfig(resolvedConfigPath);
      if (args.port !== null) config.port = args.port;
      const listenPort = portNumber(config.port ?? 8088);
      const listenHost = config.host ?? '127.0.0.1';
      const { server, store } = await createServer(config);
      server.once('error', error => {
        store.close();
        output({ status: 'BLOCKED', error: error.code ?? error.message }, 1);
      });
      server.listen(listenPort, listenHost, () => output({
        status: 'READY', service: 'ExecutionKit-Launch-OS', host: listenHost,
        port: listenPort, pid: process.pid, config: resolvedConfigPath,
        agent_enrollment_enforced: config.requireAgentEnrollment === true
      }));
      for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => {
        server.close(() => { store.close(); process.exit(0); });
        setTimeout(() => process.exit(1), 10000).unref();
      });
    }
  }
} catch (error) {
  output({ status: error.cliError ? 'CLI_ERROR' : 'BLOCKED', error: error.message, ...(error.cliError ? { usage } : {}) }, error.cliError ? 2 : 1);
}
