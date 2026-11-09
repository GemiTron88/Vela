#!/usr/bin/env node
// GemiTron Local Build Agent CLI.
//   run      [--config f] [--until-idle | --once]   manual or continuous operation
//   install  [--config f] [--autostart] [--dry-run]  prepare dirs/launcher; autostart is opt-in
//   uninstall [--config f] [--dry-run]               remove autostart, request graceful stop
//   status   [--config f]                            local state + last history entries
//   doctor   [--config f]                            config, credentials, toolchain, enforcement, service probe
//   rotate-credentials --from new.json [--config f]  atomic replace; a running agent reloads it
import {readFile, writeFile, mkdir, rename, rm, chmod, copyFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import os from 'node:os';
import {loadAgentConfig, loadCredentials, createAgent, AGENT_VERSION} from './agent.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const IS_WINDOWS = process.platform === 'win32';
const argv = process.argv.slice(2);
const command = argv[0];
const flag = name => argv.includes('--' + name);
const value = name => { const i = argv.indexOf('--' + name); return i > 0 ? argv[i + 1] : undefined; };

export function defaultConfigPath() {
  if (IS_WINDOWS) return join(process.env.LOCALAPPDATA ?? join(os.homedir(), 'AppData', 'Local'), 'GemiTronAgent', 'agent.json');
  if (process.platform === 'darwin') return join(os.homedir(), 'Library', 'Application Support', 'GemiTronAgent', 'agent.json');
  return join(process.env.XDG_CONFIG_HOME ?? join(os.homedir(), '.config'), 'gemitron-agent', 'agent.json');
}
const run = (cmd, args) => new Promise(done => execFile(cmd, args, {windowsHide: true, timeout: 60000}, (e, out, err) => done({ok: !e, out: String(out).trim(), err: String(err).trim()})));
const q = s => `"${String(s).replace(/"/g, '')}"`;

// Returns the autostart plan for this OS. Nothing here needs administrator rights.
export function autostartPlan(config, platform = process.platform, nodePath = process.execPath) {
  const cli = join(HERE, 'cli.mjs');
  if (platform === 'win32') {
    const dir = dirname(config.config_path);
    const loop = join(dir, 'run-agent-loop.cmd'), vbs = join(dir, 'launch-hidden.vbs');
    return {platform, files: {
      [loop]: `@echo off\r\n:loop\r\nif exist ${q(join(config.state_dir, 'DISABLED'))} exit /b 0\r\n${q(nodePath)} ${q(cli)} run --config ${q(config.config_path)}\r\ntimeout /t 60 /nobreak >nul\r\ngoto loop\r\n`,
      [vbs]: `CreateObject("WScript.Shell").Run """${loop}""", 0, False\r\n`},
      commands: [['reg', ['add', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', 'GemiTronBuildAgent', '/t', 'REG_SZ', '/d', `wscript.exe //B //Nologo "${vbs}"`, '/f']]],
      undo: [['reg', ['delete', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', 'GemiTronBuildAgent', '/f']]]};
  }
  if (platform === 'darwin') {
    const plist = join(os.homedir(), 'Library', 'LaunchAgents', 'com.gemitron.build-agent.plist');
    return {platform, files: {[plist]: `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>Label</key><string>com.gemitron.build-agent</string>\n<key>ProgramArguments</key><array><string>${nodePath}</string><string>${cli}</string><string>run</string><string>--config</string><string>${config.config_path}</string></array>\n<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>60</integer><key>ProcessType</key><string>Background</string><key>LowPriorityIO</key><true/><key>Nice</key><integer>10</integer>\n</dict></plist>\n`},
      commands: [['launchctl', ['bootstrap', `gui/${process.getuid?.() ?? 501}`, plist]]], undo: [['launchctl', ['bootout', `gui/${process.getuid?.() ?? 501}`, plist]]]};
  }
  const unit = join(process.env.XDG_CONFIG_HOME ?? join(os.homedir(), '.config'), 'systemd', 'user', 'gemitron-build-agent.service');
  const L = config.limits;
  return {platform: 'linux', files: {[unit]: `[Unit]\nDescription=GemiTron local build agent (${config.worker_id})\nAfter=network-online.target\n\n[Service]\nType=simple\nExecStart=${nodePath} ${cli} run --config ${config.config_path}\nRestart=always\nRestartSec=30\n# Exit 3 = stopped by Studio/Launch OS directive or blocked credentials: do not relaunch.\nRestartPreventExitStatus=3\nKillMode=control-group\nTimeoutStopSec=60\nNice=10\nNoNewPrivileges=true\nUMask=0077\n# Enforced only where cgroup v2 controllers are delegated; the job supervisor reports the real backend.\nMemoryMax=${(L.memory_mb + 1024)}M\nCPUQuota=${L.cpu_cores * 100}%\nTasksMax=${L.max_processes + 64}\n\n[Install]\nWantedBy=default.target\n`},
    commands: [['systemctl', ['--user', 'daemon-reload']], ['systemctl', ['--user', 'enable', '--now', 'gemitron-build-agent.service']]],
    undo: [['systemctl', ['--user', 'disable', '--now', 'gemitron-build-agent.service']]],
    notes: ['To run before login after reboot, an administrator may run: loginctl enable-linger ' + os.userInfo().username]};
}

export function manualLauncher(config, platform = process.platform, nodePath = process.execPath) {
  const cli = join(HERE, 'cli.mjs'), dir = dirname(config.config_path);
  if (platform === 'win32') return {[join(dir, 'Run GemiTron Build Agent.cmd')]: `@echo off\r\nrem Manual session: drains queued jobs for this workstation, then exits. No background traffic afterwards.\r\n${q(nodePath)} ${q(cli)} run --until-idle --config ${q(config.config_path)}\r\npause\r\n`};
  return {[join(dir, 'run-build-agent.sh')]: `#!/bin/sh\n# Manual session: drains queued jobs, then exits.\nexec ${q(nodePath)} ${q(cli)} run --until-idle --config ${q(config.config_path)}\n`};
}

async function main() {
  const configPath = resolve(value('config') ?? defaultConfigPath());
  if (command === 'version') return console.log(JSON.stringify({agent: AGENT_VERSION}));
  const config = await loadAgentConfig(configPath);
  if (command === 'run') {
    const credentials = await loadCredentials(config.credentials_file);
    await rm(join(config.state_dir, 'STOP'), {force: true}); await rm(join(config.state_dir, 'DISABLED'), {force: true});
    const agent = createAgent({config, credentials});
    for (const sig of ['SIGINT', 'SIGTERM', ...(IS_WINDOWS ? ['SIGBREAK'] : [])]) process.on(sig, () => agent.stop());
    await agent.run({untilIdle: flag('until-idle'), once: flag('once')});
    return;
  }
  if (command === 'install') {
    const host = await run(config.python, [join(HERE, '../scripts/host_policy.py')]);
    if (!host.ok) throw new Error('VPS_NATIVE_MOBILE_FORBIDDEN: physical workstation enrollment required');
    const dry = flag('dry-run'), plan = {mode: flag('autostart') ? 'autostart' : 'manual', directories: [config.state_dir, config.work_root, config.evidence_root], files: manualLauncher(config)};
    let auto = null;
    if (flag('autostart')) { auto = autostartPlan(config); Object.assign(plan.files, auto.files); plan.commands = auto.commands; plan.notes = auto.notes; }
    if (!dry) {
      for (const d of plan.directories) await mkdir(d, {recursive: true, mode: 0o700});
      await rm(join(config.state_dir, 'DISABLED'), {force: true}); await rm(join(config.state_dir, 'STOP'), {force: true});
      for (const [file, text] of Object.entries(plan.files)) { await mkdir(dirname(file), {recursive: true}); await writeFile(file, text, {mode: 0o700}); }
      plan.results = [];
      for (const [cmd, args] of plan.commands ?? []) plan.results.push({cmd, ...(await run(cmd, args))});
    }
    return console.log(JSON.stringify({status: dry ? 'PLANNED' : 'INSTALLED', ...plan, files: Object.keys(plan.files)}, null, 2));
  }
  if (command === 'uninstall') {
    const auto = autostartPlan(config), dry = flag('dry-run');
    if (!dry) {
      await mkdir(config.state_dir, {recursive: true});
      await writeFile(join(config.state_dir, 'DISABLED'), new Date().toISOString());
      await writeFile(join(config.state_dir, 'STOP'), new Date().toISOString()); // running agent exits gracefully at next cycle
      const results = []; for (const [cmd, args] of auto.undo) results.push({cmd, ...(await run(cmd, args))});
      for (const file of Object.keys(auto.files)) await rm(file, {force: true});
      return console.log(JSON.stringify({status: 'UNINSTALLED', results, note: 'Ask the Launch OS operator to revoke this agent and rotate its token and receipt key.'}, null, 2));
    }
    return console.log(JSON.stringify({status: 'PLANNED', undo: auto.undo, remove: Object.keys(auto.files)}, null, 2));
  }
  if (command === 'status') {
    let state = {}, history = [];
    try { state = JSON.parse(await readFile(join(config.state_dir, 'state.json'), 'utf8')); } catch {}
    try { history = (await readFile(join(config.state_dir, 'history.jsonl'), 'utf8')).trim().split('\n').slice(-10).map(l => JSON.parse(l)); } catch {}
    return console.log(JSON.stringify({worker_id: config.worker_id, service_url: config.service_url, profile: config.network_profile ?? 'standard',
      stop_requested: existsSync(join(config.state_dir, 'STOP')), current: state.current ?? null, recent: history}, null, 2));
  }
  if (command === 'doctor') {
    const report = {config: 'OK', worker_id: config.worker_id, platform: process.platform, node: process.version};
    try { await loadCredentials(config.credentials_file); report.credentials = 'OK'; } catch (e) { report.credentials = e.code ?? e.message; }
    const py = await run(config.python, [join(HERE, '..', 'scripts', 'supervisor.py'), 'probe']);
    report.python = (await run(config.python, ['-c', 'import sys;print(sys.version.split()[0])'])).out || 'MISSING';
    report.supervisor = py.ok ? JSON.parse(py.out) : 'PYTHON_UNAVAILABLE';
    report.git = (await run('git', ['--version'])).out || 'MISSING';
    for (const [id, m] of Object.entries(config.projects)) report['project:' + id] = {repository: existsSync(m.repository) ? 'PRESENT' : 'MISSING', runner_config: existsSync(m.runner_config) ? 'PRESENT' : 'MISSING'};
    if (!flag('offline')) {
      try { const credentials = await loadCredentials(config.credentials_file); const agent = createAgent({config, credentials, log: () => {}}); await agent.probe(); report.service = 'COMPATIBLE'; }
      catch (e) { report.service = e.code ?? 'UNREACHABLE'; }
    }
    return console.log(JSON.stringify(report, null, 2));
  }
  if (command === 'rotate-credentials') {
    const from = value('from'); if (!from) throw Error('--from new-credentials.json required');
    const tmp = config.credentials_file + '.new';
    await copyFile(resolve(from), tmp); if (!IS_WINDOWS) await chmod(tmp, 0o600);
    await loadCredentials(tmp); await rename(tmp, config.credentials_file);
    return console.log(JSON.stringify({status: 'ROTATED', note: 'A running agent reloads credentials at its next cycle. Delete the source file securely.'}));
  }
  console.error('usage: cli.mjs run|install|uninstall|status|doctor|rotate-credentials|version [--config file]'); process.exitCode = 2;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(JSON.stringify({status: 'ERROR', code: e.code ?? e.message})); process.exitCode = 2; });
