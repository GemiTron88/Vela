const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

async function main() {
  const rawArgs = process.argv.slice(2);
  const engineAt = (root) => {
    const installed = path.join(root, '.executionkit', 'runtime', 'kit', 'bin', 'executionkit-cli.mjs');
    if (fs.existsSync(installed)) return installed;
    const sourceRepo = path.join(root, 'bin', 'executionkit-cli.mjs');
    if (fs.existsSync(sourceRepo) && fs.existsSync(path.join(root, 'STANDARD_V5.md'))) return sourceRepo;
    return installed;
  };
  // Locate the parser beside a real engine, then let its canonical registry parse
  // the project argument. The command name is never a project directory.
  const candidatePaths = [
    path.join(__dirname, '..', 'runtime', 'kit', 'bin', 'executionkit-cli.mjs'),
    path.join(__dirname, '..', '..', 'bin', 'executionkit-cli.mjs'),
    path.join(__dirname, 'executionkit-cli.mjs'),
    path.join(__dirname, 'kit', 'bin', 'executionkit-cli.mjs'),
    engineAt(process.cwd()),
    // Bootstrap an unbundled launcher invoked outside the project. These are
    // possible positional slots only; parseCliArgs below decides the target.
    ...rawArgs.slice(1, 3).filter((arg) => !arg.startsWith('-')).map((arg) => engineAt(path.resolve(arg)))
  ];

  let cliToRun = null;
  for (const p of candidatePaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(path.dirname(p), '..', 'lib', 'v4-cli-contract.mjs'))) {
      cliToRun = p;
      break;
    }
  }

  if (cliToRun) {
    try {
      const contract = path.join(path.dirname(cliToRun), '..', 'lib', 'v4-cli-contract.mjs');
      const { parseCliArgs } = await import(pathToFileURL(contract).href);
      const parsed = parseCliArgs(rawArgs);
      const projectEngine = engineAt(path.resolve(parsed.projectArg));
      if (fs.existsSync(projectEngine)) cliToRun = projectEngine;
      await import(pathToFileURL(path.resolve(cliToRun)).href);
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
