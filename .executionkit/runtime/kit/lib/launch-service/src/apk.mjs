import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createReadStream, existsSync, readdirSync} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {need, sha, integer} from './contracts.mjs';
const execute = promisify(execFile);
const BATCH_META = /[\r\n&|<>^%]/;

function sdkRoots() {
  const roots = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT];
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) roots.push(path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'));
  if (process.env.HOME) roots.push(path.join(process.env.HOME, 'Android', 'Sdk'), path.join(process.env.HOME, 'Library', 'Android', 'sdk'));
  return [...new Set(roots.filter(Boolean))];
}

export function resolveAndroidSdkTool(name, explicit) {
  if (explicit) return explicit;
  const ext = process.platform === 'win32' ? '.bat' : '';
  for (const root of sdkRoots()) {
    if (name === 'apksigner') {
      const bt = path.join(root, 'build-tools');
      if (existsSync(bt)) {
        const versions = readdirSync(bt).sort().reverse();
        for (const v of versions) {
          const candidate = path.join(bt, v, 'apksigner' + ext);
          if (existsSync(candidate)) return candidate;
        }
      }
    }
    if (name === 'apkanalyzer') {
      const candidates = [
        path.join(root, 'cmdline-tools', 'latest', 'bin', 'apkanalyzer' + ext),
        path.join(root, 'tools', 'bin', 'apkanalyzer' + ext),
      ];
      for (const c of candidates) if (existsSync(c)) return c;
    }
  }
  return name;
}

export function sdkToolEnvironment() {
  let javaHome = process.env.JAVA_HOME;
  if (!javaHome && process.platform === 'win32') {
    const studioJbr = 'C:\\Program Files\\Android\\Android Studio\\jbr';
    if (existsSync(studioJbr)) javaHome = studioJbr;
  }
  const pathVal = process.env.PATH ?? process.env.Path ?? '';
  const fullPath = javaHome ? `${path.join(javaHome, 'bin')}${path.delimiter}${pathVal}` : pathVal;
  return {
    PATH: fullPath,
    Path: fullPath,
    JAVA_HOME: javaHome,
    HOME: process.env.HOME ?? process.env.USERPROFILE,
    USERPROFILE: process.env.USERPROFILE,
    LOCALAPPDATA: process.env.LOCALAPPDATA,
    APPDATA: process.env.APPDATA,
    SYSTEMROOT: process.env.SYSTEMROOT ?? process.env.SystemRoot,
    SystemRoot: process.env.SystemRoot ?? process.env.SYSTEMROOT,
    COMSPEC: process.env.COMSPEC ?? process.env.ComSpec,
    ComSpec: process.env.ComSpec ?? process.env.COMSPEC,
    PATHEXT: process.env.PATHEXT,
    TEMP: process.env.TEMP ?? process.env.TMP,
    TMP: process.env.TMP ?? process.env.TEMP,
    ANDROID_HOME: process.env.ANDROID_HOME ?? sdkRoots()[0],
    ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT ?? sdkRoots()[0],
  };
}

export async function runSdkTool(tool, args) {
  const strArgs = args.map(String);
  const env = sdkToolEnvironment();
  if (process.platform === 'win32' && /\.(?:bat|cmd)$/i.test(tool)) {
    need(![tool, ...strArgs].some(v => BATCH_META.test(v)), 'UNSAFE_BATCH_TOOL_ARGS');
    const comspec = env.ComSpec || env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe';
    return (await execute(comspec, ['/d', '/v:off', '/s', '/c', tool, ...strArgs], {timeout: 60000, maxBuffer: 4 * 1024 * 1024, windowsHide: true, env})).stdout.trim();
  }
  return (await execute(tool, strArgs, {timeout: 60000, maxBuffer: 4 * 1024 * 1024, windowsHide: true, env})).stdout.trim();
}

export async function checksum(path) {
  const h = createHash('sha256'); for await (const b of createReadStream(path)) h.update(b); return h.digest('hex');
}
export async function inspectApk(path, tools = {}) {
  const signer = resolveAndroidSdkTool('apksigner', tools.apksigner);
  const signature = await runSdkTool(signer, ['verify', '--verbose', '--print-certs', path]);
  const certificates = [...signature.matchAll(/Signer #\d+ certificate SHA-256 digest: ([a-fA-F0-9:]+)/g)].map(m => m[1].replaceAll(':', '').toLowerCase());
  need(certificates.length === 1, 'UNSUPPORTED_APK_SIGNER_SET');
  const debugSigned = /CN=Android Debug/i.test(signature);
  need(!debugSigned || tools.observationOnly === true, 'DEBUG_SIGNED_ARTIFACT');
  const analyzer = resolveAndroidSdkTool('apkanalyzer', tools.apkanalyzer);
  const [package_id, code, version, minimum, files] = await Promise.all([
    runSdkTool(analyzer, ['manifest', 'application-id', path]), runSdkTool(analyzer, ['manifest', 'version-code', path]),
    runSdkTool(analyzer, ['manifest', 'version-name', path]), runSdkTool(analyzer, ['manifest', 'min-sdk', path]),
    runSdkTool(analyzer, ['files', 'list', path]),
  ]);
  need(/^[A-Za-z][\w]*(?:\.[A-Za-z][\w]*)+$/.test(package_id), 'INVALID_PACKAGE_ID');
  const architectures = [...new Set([...files.matchAll(/\/lib\/(arm64-v8a|armeabi-v7a|x86_64|x86)\//g)].map(m => m[1]))].sort();
  need(architectures.length > 0, 'APK_ARCHITECTURES_UNKNOWN');
  return {package_id, version_code: integer(Number(code)), version, minimum_android_sdk: integer(Number(minimum)), signing_sha256: sha(certificates[0]), architectures, sha256: await checksum(path), size: (await stat(path)).size, verification: tools.observationOnly ? 'OBSERVED' : 'VERIFIED', debug_signed: debugSigned, verifier: 'android-sdk-apksigner+apkanalyzer'};
}

