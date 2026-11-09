#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { composerHas, executable, runCommand } from '../lib/external-adapters.mjs';

const root = path.resolve(process.argv[2] ?? '.');
try {
  const applicable = fs.existsSync(path.join(root, 'artisan')) && composerHas(root, 'laravel/boost');
  if (!applicable) {
    console.log(JSON.stringify({ status: 'NOT_APPLICABLE', integration: 'laravel-boost' }, null, 2));
    process.exit(0);
  }
  if (!executable('php', root)) {
    console.log(JSON.stringify({ status: 'NOT_AVAILABLE', integration: 'laravel-boost', reason: 'php executable not found' }, null, 2));
    process.exit(2);
  }
  const list = runCommand(root, 'php', ['artisan', 'list', '--format=json'], { timeoutMs: 30000 });
  let registered = false;
  try {
    const parsed = JSON.parse(list.stdout);
    registered = Array.isArray(parsed.commands) && parsed.commands.some((c) => (c.name ?? c) === 'boost:mcp');
  } catch {
    registered = /boost:mcp/.test(list.stdout);
  }
  const status = list.ok && registered ? 'READY' : 'DEGRADED';
  const result = {
    status,
    integration: 'laravel-boost',
    packageInstalled: true,
    mcpCommand: 'php artisan boost:mcp',
    mcpRegistered: registered,
    documentedToolFamilies: ['application-info', 'browser-logs', 'database', 'schema', 'logs', 'documentation-search'],
    runtimeToolsEnumerated: false,
    limits: 'READY proves package presence and local boost:mcp command registration only. Actual server startup, negotiated tool list and MCP tool calls require connected-host runtime evidence.',
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(status === 'READY' ? 0 : 1);
} catch (error) {
  console.error(`Laravel Boost adapter failed: ${error.message}`);
  process.exit(1);
}
