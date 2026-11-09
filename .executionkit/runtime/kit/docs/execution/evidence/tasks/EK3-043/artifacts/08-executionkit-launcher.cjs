const path = require('node:path');
const fs = require('node:fs');

async function main() {
  const rawArgs = process.argv.slice(2);
  const targetProject = (rawArgs[0] && !rawArgs[0].startsWith('--') && rawArgs[0] !== 'help' && rawArgs[0] !== 'version')
    ? path.resolve(rawArgs[0])
    : process.cwd();

  const candidatePaths = [
    path.join(targetProject, '.executionkit', 'runtime', 'kit', 'bin', 'executionkit-cli.mjs'),
    path.join(targetProject, 'bin', 'executionkit-cli.mjs'),
    path.join(__dirname, '..', '..', 'bin', 'executionkit-cli.mjs'),
    path.join(__dirname, 'executionkit-cli.mjs'),
    path.join(__dirname, 'kit', 'bin', 'executionkit-cli.mjs')
  ];

  let cliToRun = null;
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      cliToRun = p;
      break;
    }
  }

  if (cliToRun) {
    try {
      await import(path.resolve(cliToRun));
    } catch (err) {
      console.error(JSON.stringify({
        schemaVersion: 'executionkit-v4-cli/v1',
        status: 'BLOCKED',
        code: 'LAUNCHER_IMPORT_ERROR',
        error: err.message,
        cliPath: cliToRun
      }));
      process.exitCode = 1;
    }
  } else {
    console.error(JSON.stringify({
      schemaVersion: 'executionkit-v4-cli/v1',
      status: 'BLOCKED',
      code: 'LAUNCHER_ERROR',
      error: 'ExecutionKit engine could not be resolved from binary launcher.'
    }));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(JSON.stringify({
    schemaVersion: 'executionkit-v4-cli/v1',
    status: 'BLOCKED',
    code: 'FATAL_LAUNCHER_ERROR',
    error: err.message
  }));
  process.exitCode = 1;
});
