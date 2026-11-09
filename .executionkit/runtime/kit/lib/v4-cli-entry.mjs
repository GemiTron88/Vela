// A tracked project-local entry exists even before a standalone SEA is provisioned.
export function projectCliCommand(platform=process.platform){
  return platform==='win32'?'.\\.executionkit\\bin\\ek.cmd':'./.executionkit/bin/ek';
}

export function projectCliFiles(){
  return [
    {path:'.executionkit/bin/ek',mode:0o755,content:'#!/bin/sh\nexec node "$(dirname "$0")/ek.cjs" "$@"\n'},
    {path:'.executionkit/bin/ek.cmd',mode:0o644,content:'@echo off\r\nnode "%~dp0ek.cjs" %*\r\nexit /b %errorlevel%\r\n'},
    {path:'.executionkit/bin/ek.cjs',mode:0o644,content:"const fs = require('node:fs');\nconst path = require('node:path');\nconst { pathToFileURL } = require('node:url');\nconst { spawnSync } = require('node:child_process');\n(async () => {\n  const root = path.resolve(__dirname, '..', '..');\n  const { resolveExecutionRuntime } = await import(pathToFileURL(path.join(root, '.executionkit/runtime/kit/lib/v4-platform.mjs')).href);\n  const { parseCliArgs } = await import(pathToFileURL(path.join(root, '.executionkit/runtime/kit/lib/v4-cli-contract.mjs')).href);\n  const candidate = path.resolve(root, parseCliArgs(process.argv.slice(2)).projectArg);\n  const target = fs.existsSync(path.join(candidate, '.executionkit')) ? candidate : root;\n  const runtime = resolveExecutionRuntime(target);\n  if (!runtime.verified) throw new Error(runtime.error);\n  const result = spawnSync(runtime.executable, [...runtime.args, ...process.argv.slice(2)], { cwd: root, stdio: 'inherit', shell: false, windowsHide: true });\n  if (result.error) throw result.error;\n  process.exitCode = result.status ?? 1;\n})().catch(() => {\n  console.error(JSON.stringify({ status: 'BLOCKED', code: 'PROJECT_CLI_ENTRY_FAILED' }));\n  process.exitCode = 1;\n});\n"}
  ];
}

export function renderProjectCliCommands(text,platform=process.platform){
  const cli=projectCliCommand(platform);
  const maps={
    'executionkit-cli.mjs':'',
    'next-execution.mjs':'next',
    'next-readiness.mjs':'status',
    'resolve-task-context.mjs':'start',
    'state-status.mjs':'state status',
    'state-rehydrate.mjs':'state rehydrate',
    'state-checkpoint.mjs':'state checkpoint',
    'state-amnesia-test.mjs':'state amnesia',
    'state-memory-envelope.mjs':'state memory',
    'documentation-fabric.mjs':'docs',
    'analyze-revalidation.mjs':'test impact',
    'discover-product.mjs':'product discover',
    'reconcile-product.mjs':'product reconcile',
    'collect-evidence.mjs':'proof status',
    'build-candidate.mjs':'launch build',
    'validate-candidate.mjs':'launch verify',
    'validate-component-system.mjs':'guard ux',
    'audit-project.mjs':'audit',
    'test-project.mjs':'test',
    'visual-project.mjs':'visual',
    'seo-os.mjs':'seo',
    'repository-intelligence.mjs':'knowledge',
    'repository-providers.mjs':'providers',
    'production-deployment.mjs':'launch',
    'run-tests.mjs':'test task',
    'analyze-flakes.mjs':'test flakes',
    'select-tests.mjs':'test select',
    'discover-project.mjs':'product discover',
    'discover-content.mjs':'content discover',
    'validate-content-depth.mjs':'content validate',
    'validate-security.mjs':'audit security',
    'validate-data-safety.mjs':'audit data-safety',
    'validate-runtime-health.mjs':'audit health',
    'validate-quality.mjs':'audit quality',
    'validate-seo.mjs':'seo validate',
    'validate-seo-performance.mjs':'seo validate',
    'validate-state.mjs':'state status',
    'coordinate-agents.mjs':'agents status',
    'inspect-blocker.mjs':'status',
    'archive-terminal-tasks.mjs':'todo archive',
  };
  return String(text)
    .replace(/\bnode (?:\.executionkit\/runtime\/kit\/)?bin\/([a-z0-9-]+\.mjs)(?:\s+(status|build|validate|search|refresh))?/g,(match,file,action)=>{
      if(!(file in maps))return match;
      return [cli,maps[file],action].filter(Boolean).join(' ');
    });
}
