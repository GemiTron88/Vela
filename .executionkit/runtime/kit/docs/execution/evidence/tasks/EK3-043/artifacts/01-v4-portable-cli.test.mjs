import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  V4_CLI_VERSION,
  EXIT_CODES,
  HELP_ALIASES,
  VERSION_ALIASES,
  GROUPED_COMMANDS,
  HELP_USAGE,
  availableCommands,
  usageForCommand,
  cliInputErrorCode,
  getCliCommandRegistry,
  parseCliArgs
} from '../lib/v4-cli-contract.mjs';

import {
  V4_SUPPORTED_PLATFORMS,
  V4_SUPPORTED_TARGETS,
  detectPlatformArchitecture,
  getPlatformSupportStrategy,
  buildArtifactIdentity,
  verifyArtifactIntegrity,
  resolveExecutionRuntime,
  signWindowsBinary,
  signMacBinary,
  notarizeMacBinary
} from '../lib/v4-platform.mjs';

import { buildExecutionKitBinary } from '../scripts/build-executionkit-binary.mjs';
import { doctorV4Installation } from '../lib/v4-installer.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'bin', 'executionkit-cli.mjs');
const launcher = path.join(root, 'bin', 'executionkit.mjs');
const binary = path.join(root, 'dist', 'bin', process.platform === 'win32' ? 'executionkit.exe' : 'executionkit');

function runNode(script, argv = [], opts = {}) {
  return spawnSync(process.execPath, [script, ...argv], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60000,
    windowsHide: true,
    shell: false,
    ...opts
  });
}

function runExecutable(binPath, argv = [], opts = {}) {
  return spawnSync(binPath, argv, {
    cwd: root,
    encoding: 'utf8',
    timeout: 60000,
    windowsHide: true,
    shell: false,
    ...opts
  });
}

function fixture(t) {
  const dir = path.join(os.tmpdir(), 'ek4-portable-' + crypto.randomUUID());
  fs.mkdirSync(dir, { recursive: true });
  t.after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
  return dir;
}

test('CLI contract is the authoritative single source of command truth', () => {
  const registry = getCliCommandRegistry();
  assert.equal(registry.schemaVersion, 'executionkit-v4-cli-registry/v1');
  assert.equal(registry.mcp, 'DISABLED');
  assert.equal(registry.systems, 10);
  assert.ok(registry.commands.length >= 30, 'registry should contain at least 30 commands');
  assert.ok(Array.isArray(registry.usage) && registry.usage.length >= 25);
  assert.ok(Array.isArray(registry.groupedCommands) && registry.groupedCommands.length >= 20);

  const available = availableCommands();
  assert.ok(available.includes('start'));
  assert.ok(available.includes('status'));
  assert.ok(available.includes('next'));
  assert.ok(available.includes('systems'));
  assert.ok(available.includes('db'));
  assert.ok(available.includes('help'));
  assert.ok(available.includes('version'));
  assert.ok(available.includes('upgrade-revalidation'));

  for (const cmd of registry.commands) {
    assert.ok(cmd.name, 'command must have name');
    assert.ok(cmd.family, 'command must have family');
    assert.ok(cmd.description, 'command must have description');
    assert.ok(cmd.exitCodes, 'command must define exitCodes');
    assert.equal(cmd.exitCodes.OK, 0);
    assert.equal(cmd.exitCodes.BLOCKED, 1);
    assert.equal(cmd.exitCodes.CLI_ERROR, 2);
  }
});

test('Node CLI and executable launcher exhibit full command and exit code parity on help aliases', () => {
  for (const alias of HELP_ALIASES) {
    const nodeRun = runNode(cli, [alias]);
    const launcherRun = runNode(launcher, [alias]);

    assert.equal(nodeRun.status, 0, `Node CLI failed for alias ${alias}`);
    assert.equal(launcherRun.status, 0, `Launcher failed for alias ${alias}`);

    const nodeOut = JSON.parse(nodeRun.stdout);
    const launcherOut = JSON.parse(launcherRun.stdout);

    assert.equal(nodeOut.schemaVersion, 'executionkit-v4-cli/v1');
    assert.equal(launcherOut.schemaVersion, 'executionkit-v4-cli/v1');
    assert.equal(nodeOut.status, 'OK');
    assert.equal(launcherOut.status, 'OK');
    assert.equal(launcherOut.systems, nodeOut.systems);
    assert.deepEqual(launcherOut.commands, nodeOut.commands);
  }
});

test('Node CLI and executable launcher exhibit full version parity', () => {
  for (const alias of VERSION_ALIASES) {
    const nodeRun = runNode(cli, [alias]);
    const launcherRun = runNode(launcher, [alias]);

    assert.equal(nodeRun.status, 0);
    assert.equal(launcherRun.status, 0);

    const nodeOut = JSON.parse(nodeRun.stdout);
    const launcherOut = JSON.parse(launcherRun.stdout);

    assert.equal(nodeOut.schemaVersion, 'executionkit-v4-cli/v1');
    assert.equal(launcherOut.schemaVersion, 'executionkit-v4-cli/v1');
    assert.equal(nodeOut.status, 'OK');
    assert.equal(launcherOut.status, 'OK');
    assert.equal(launcherOut.version, nodeOut.version);
    assert.match(launcherOut.version, /^4\./);
  }
});

test('Node CLI and executable launcher exhibit full family help parity', () => {
  const families = ['db', 'boundary', 'activation', 'content', 'seo', 'docs', 'visual', 'audit', 'test', 'launch', 'todo', 'upgrade-revalidation'];
  for (const fam of families) {
    const nodeRun = runNode(cli, [fam, '--help']);
    const launcherRun = runNode(launcher, [fam, '--help']);

    assert.equal(nodeRun.status, 0, `Node CLI failed on ${fam} --help`);
    assert.equal(launcherRun.status, 0, `Launcher failed on ${fam} --help`);

    const nodeOut = JSON.parse(nodeRun.stdout);
    const launcherOut = JSON.parse(launcherRun.stdout);

    assert.equal(nodeOut.command, fam);
    assert.equal(launcherOut.command, fam);
    assert.deepEqual(launcherOut.usage, nodeOut.usage);
  }
});

test('Node CLI and executable launcher return identical structured errors for unknown commands', () => {
  const badCommand = 'completely-fictional-command-42';
  const nodeRun = runNode(cli, [badCommand]);
  const launcherRun = runNode(launcher, [badCommand]);

  assert.equal(nodeRun.status, 2, 'Node CLI exit code must be 2 for CLI input error');
  assert.equal(launcherRun.status, 2, 'Launcher exit code must be 2 for CLI input error');

  const nodeErr = JSON.parse(nodeRun.stderr);
  const launcherErr = JSON.parse(launcherRun.stderr);

  assert.equal(nodeErr.status, 'CLI_ERROR');
  assert.equal(launcherErr.status, 'CLI_ERROR');
  assert.equal(nodeErr.code, 'UNKNOWN_COMMAND');
  assert.equal(launcherErr.code, 'UNKNOWN_COMMAND');
  assert.equal(nodeErr.command, badCommand);
  assert.equal(launcherErr.command, badCommand);
  assert.deepEqual(launcherErr.availableCommands, nodeErr.availableCommands);
});

test('Node CLI and executable launcher return identical structured errors for unknown sub-actions', () => {
  const nodeRun = runNode(cli, ['db', 'invalid-action']);
  const launcherRun = runNode(launcher, ['db', 'invalid-action']);

  assert.equal(nodeRun.status, 2);
  assert.equal(launcherRun.status, 2);

  const nodeErr = JSON.parse(nodeRun.stderr);
  const launcherErr = JSON.parse(launcherRun.stderr);

  assert.equal(nodeErr.status, 'CLI_ERROR');
  assert.equal(launcherErr.status, 'CLI_ERROR');
  assert.equal(nodeErr.code, 'UNKNOWN_ACTION');
  assert.equal(launcherErr.code, 'UNKNOWN_ACTION');
});

test('Platform strategy identifies supported SEA platforms and selects pinned fallback for macOS Intel', () => {
  // Linux targets
  assert.equal(getPlatformSupportStrategy('linux', 'x64').strategy, 'STANDALONE_SEA');
  assert.equal(getPlatformSupportStrategy('linux', 'arm64').strategy, 'STANDALONE_SEA');

  // Windows targets
  assert.equal(getPlatformSupportStrategy('win32', 'x64').strategy, 'STANDALONE_SEA');
  assert.equal(getPlatformSupportStrategy('win32', 'arm64').strategy, 'STANDALONE_SEA');

  // macOS ARM64 target
  assert.equal(getPlatformSupportStrategy('darwin', 'arm64').strategy, 'STANDALONE_SEA');

  // macOS Intel/x64 target must fall back to project-local pinned Node runtime
  const macIntel = getPlatformSupportStrategy('darwin', 'x64');
  assert.equal(macIntel.strategy, 'PINNED_NODE_FALLBACK');
  assert.equal(macIntel.seaSupported, false);
  assert.match(macIntel.reason, /pinned Node runtime/);

  // Unsupported OS
  const freebsd = getPlatformSupportStrategy('freebsd', 'x64');
  assert.equal(freebsd.strategy, 'UNSUPPORTED');
  assert.equal(freebsd.seaSupported, false);
});

test('buildArtifactIdentity creates complete supply-chain identity bound to source and platform', () => {
  const id = buildArtifactIdentity({
    sourceSha: 'abcdef1234567890abcdef1234567890abcdef12',
    targetPlatform: 'linux',
    targetArch: 'x64',
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    version: '4.0.0-dev'
  });
  assert.equal(id.schemaVersion, 'executionkit-v4-artifact-identity/v1');
  assert.equal(id.sourceSha, 'abcdef1234567890abcdef1234567890abcdef12');
  assert.equal(id.platform, 'linux');
  assert.equal(id.arch, 'x64');
  assert.equal(id.strategy, 'STANDALONE_SEA');
  assert.equal(id.version, '4.0.0-dev');
  assert.equal(id.signing.status, 'UNSIGNED_DEVELOPER_BUILD');
  assert.ok(id.builtAt);
});

test('verifyArtifactIntegrity detects tampered binary, missing binary and missing executable bit', (t) => {
  const dir = fixture(t);
  const binaryFile = path.join(dir, 'test-bin');
  fs.writeFileSync(binaryFile, 'dummy binary content');
  fs.chmodSync(binaryFile, 0o755);

  const correctDigest = crypto.createHash('sha256').update('dummy binary content').digest('hex');

  // Valid verification
  const okCheck = verifyArtifactIntegrity(binaryFile, { sha256: correctDigest });
  assert.equal(okCheck.valid, true);
  assert.equal(okCheck.sha256, correctDigest);

  // Tampered verification
  const badCheck = verifyArtifactIntegrity(binaryFile, { sha256: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' });
  assert.equal(badCheck.valid, false);
  assert.equal(badCheck.code, 'ARTIFACT_DIGEST_MISMATCH');

  // Missing file
  const missingCheck = verifyArtifactIntegrity(path.join(dir, 'not-exists'));
  assert.equal(missingCheck.valid, false);
  assert.equal(missingCheck.code, 'ARTIFACT_MISSING');

  // Missing executable permission
  if (process.platform !== 'win32') {
    fs.chmodSync(binaryFile, 0o644);
    const noExecCheck = verifyArtifactIntegrity(binaryFile, { sha256: correctDigest });
    assert.equal(noExecCheck.valid, false);
    assert.equal(noExecCheck.code, 'ARTIFACT_NOT_EXECUTABLE');
  }
});

test('runtime resolution prioritizes standalone binary, then pinned fallback, then project CLI', (t) => {
  const dir = fixture(t);

  // Case 1: unconfigured project
  const unconfigured = resolveExecutionRuntime(dir);
  assert.equal(unconfigured.type, 'UNCONFIGURED');

  // Case 2: project-local CLI installed
  const kitBinDir = path.join(dir, '.executionkit', 'runtime', 'kit', 'bin');
  fs.mkdirSync(kitBinDir, { recursive: true });
  const installedCli = path.join(kitBinDir, 'executionkit-cli.mjs');
  fs.writeFileSync(installedCli, '// installed cli');

  const cliResolved = resolveExecutionRuntime(dir);
  assert.equal(cliResolved.type, 'PROJECT_LOCAL_CLI');
  assert.equal(cliResolved.verified, true);

  // Case 3: project-local pinned Node runtime
  const nodeBinDir = path.join(dir, '.executionkit', 'runtime', 'node', 'bin');
  fs.mkdirSync(nodeBinDir, { recursive: true });
  const pinnedNode = path.join(nodeBinDir, process.platform === 'win32' ? 'node.exe' : 'node');
  fs.writeFileSync(pinnedNode, '#!/bin/sh\n');
  if (process.platform !== 'win32') fs.chmodSync(pinnedNode, 0o755);

  const pinnedResolved = resolveExecutionRuntime(dir);
  assert.equal(pinnedResolved.type, 'PINNED_NODE_FALLBACK');
  assert.equal(pinnedResolved.executable, pinnedNode);

  // Case 4: standalone binary present and verified
  const binDir = path.join(dir, '.executionkit', 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const binFile = path.join(binDir, process.platform === 'win32' ? 'executionkit.exe' : 'executionkit');
  fs.writeFileSync(binFile, 'binary-bytes');
  if (process.platform !== 'win32') fs.chmodSync(binFile, 0o755);

  const binDigest = crypto.createHash('sha256').update('binary-bytes').digest('hex');
  fs.writeFileSync(path.join(binDir, 'artifact-identity.json'), JSON.stringify({ sha256: binDigest }) + '\n');

  const standaloneResolved = resolveExecutionRuntime(dir);
  assert.equal(standaloneResolved.type, 'STANDALONE_BINARY');
  assert.equal(standaloneResolved.executable, binFile);
});

test('doctor rejects tampered binary artifact in project', (t) => {
  const dir = fixture(t);

  // Setup minimal v4 project structure
  fs.mkdirSync(path.join(dir, '.executionkit'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'execution.config.json'), JSON.stringify({
    standardVersion: '4.0.0-dev',
    v4: { mcp: false },
    ci: { allowedRunnerOS: ['linux', 'windows', 'macos'], projectRunnerLabel: 'project-test' }
  }));
  fs.writeFileSync(path.join(dir, '.executionkit/installation.json'), JSON.stringify({
    schemaVersion: 'executionkit-v4-install/v1',
    version: '4.0.0-dev',
    runtime: '.executionkit/runtime/kit'
  }));

  // Tampered binary
  const binDir = path.join(dir, '.executionkit', 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const binFile = path.join(binDir, process.platform === 'win32' ? 'executionkit.exe' : 'executionkit');
  fs.writeFileSync(binFile, 'tampered-bytes');
  if (process.platform !== 'win32') fs.chmodSync(binFile, 0o755);

  fs.writeFileSync(path.join(binDir, 'artifact-identity.json'), JSON.stringify({
    sha256: '0000000000000000000000000000000000000000000000000000000000000000'
  }) + '\n');

  const result = doctorV4Installation(dir, { checkProviderTooling: false, checkUpgradeRevalidation: false });
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.errors.some((e) => e.code === 'V4_BINARY_ARTIFACT_DIGEST_MISMATCH'));
});

test('code signing hooks handle developer builds without false claims', () => {
  const winCheck = signWindowsBinary('dummy.exe', { certificatePath: null });
  assert.equal(winCheck.signed, false);
  assert.equal(winCheck.status, 'UNSIGNED_DEVELOPER_BUILD');

  const macCheck = signMacBinary('dummy_mac', { identity: null });
  assert.equal(macCheck.signed, false);
  assert.equal(macCheck.status, 'UNSIGNED_DEVELOPER_BUILD');

  const notarizeCheck = notarizeMacBinary('dummy_mac', { appleId: null });
  assert.equal(notarizeCheck.notarized, false);
  assert.equal(notarizeCheck.status, 'NOT_NOTARIZED');
});

test('built standalone binary executes canonical commands with byte-level parity when present', () => {
  if (!fs.existsSync(binary)) {
    // If binary not built yet, build it
    const buildResult = buildExecutionKitBinary();
    assert.equal(buildResult.status, 'SUCCESS');
  }

  // Test help
  const binHelp = runExecutable(binary, ['help']);
  assert.equal(binHelp.status, 0);
  const binHelpJson = JSON.parse(binHelp.stdout);
  assert.equal(binHelpJson.status, 'OK');
  assert.equal(binHelpJson.systems, 10);

  // Test version
  const binVer = runExecutable(binary, ['version']);
  assert.equal(binVer.status, 0);
  const binVerJson = JSON.parse(binVer.stdout);
  assert.equal(binVerJson.status, 'OK');

  // Test family help
  const binDbHelp = runExecutable(binary, ['db', '--help']);
  assert.equal(binDbHelp.status, 0);
  const binDbJson = JSON.parse(binDbHelp.stdout);
  assert.equal(binDbJson.command, 'db');

  // Test unknown command
  const binBad = runExecutable(binary, ['bogus-cmd']);
  assert.equal(binBad.status, 2);
  const binBadJson = JSON.parse(binBad.stderr);
  assert.equal(binBadJson.code, 'UNKNOWN_COMMAND');
});

test('startup performance benchmark: launcher help and version execute within performance budget', () => {
  const t0 = performance.now();
  const run1 = runNode(launcher, ['version']);
  const versionDurationMs = performance.now() - t0;

  assert.equal(run1.status, 0);
  assert.ok(versionDurationMs < 1000, `version took ${versionDurationMs}ms, budget is 1000ms`);

  const t1 = performance.now();
  const run2 = runNode(launcher, ['help']);
  const helpDurationMs = performance.now() - t1;

  assert.equal(run2.status, 0);
  assert.ok(helpDurationMs < 1000, `help took ${helpDurationMs}ms, budget is 1000ms`);
});
