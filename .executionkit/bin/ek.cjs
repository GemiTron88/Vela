const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
(async () => {
  const root = path.resolve(__dirname, '..', '..');
  const { resolveExecutionRuntime } = await import(pathToFileURL(path.join(root, '.executionkit/runtime/kit/lib/v4-platform.mjs')).href);
  const { parseCliArgs } = await import(pathToFileURL(path.join(root, '.executionkit/runtime/kit/lib/v4-cli-contract.mjs')).href);
  const candidate = path.resolve(root, parseCliArgs(process.argv.slice(2)).projectArg);
  const target = fs.existsSync(path.join(candidate, '.executionkit')) ? candidate : root;
  const runtime = resolveExecutionRuntime(target);
  if (!runtime.verified) throw new Error(runtime.error);
  const result = spawnSync(runtime.executable, [...runtime.args, ...process.argv.slice(2)], { cwd: root, stdio: 'inherit', shell: false, windowsHide: true });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
})().catch(() => {
  console.error(JSON.stringify({ status: 'BLOCKED', code: 'PROJECT_CLI_ENTRY_FAILED' }));
  process.exitCode = 1;
});
