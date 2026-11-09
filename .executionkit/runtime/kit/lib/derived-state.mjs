import fs from 'node:fs';
import path from 'node:path';

export const DERIVED_DIR = '.executionkit';
export const DERIVED_IGNORE_CONTENT = '# AI ExecutionKit derived/runtime state. Keep the directory local and non-authoritative.\n*\n!.gitignore\n';
export const INSTALLED_IGNORE_CONTENT = DERIVED_IGNORE_CONTENT + '!runtime/\nruntime/*\n!runtime/kit/\n!runtime/kit/**\n!installation.json\n!upgrade-revalidation.json\n!bin/\nbin/*\n!bin/ek\n!bin/ek.cmd\n!bin/ek.cjs\n';

export function derivedDirectory(root) { return path.join(root, DERIVED_DIR); }
function entryStat(full) { try { return fs.lstatSync(full); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }

export function resolveProjectPathSafe(root, rel, label = 'project path', { mustExist = false, file = false, createParents = false } = {}) {
  const projectRoot = path.resolve(root);
  if (typeof rel !== 'string' || !rel.trim() || path.isAbsolute(rel)) throw new Error(`${label} must be a non-empty project-relative path`);
  const full = path.resolve(projectRoot, rel), delta = path.relative(projectRoot, full);
  if (!delta || delta.startsWith('..') || path.isAbsolute(delta)) throw new Error(`${label} must stay inside the project: ${rel}`);
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) throw new Error(`${label}: project root is missing/not a directory`);
  const rootReal = fs.realpathSync(projectRoot), parts = delta.split(path.sep).filter(Boolean);
  let cursor = projectRoot;
  for (let index = 0; index < parts.length; index++) {
    cursor = path.join(cursor, parts[index]);
    const isLeaf = index === parts.length - 1;
    if (!entryStat(cursor)) {
      if (createParents && !isLeaf) fs.mkdirSync(cursor);
      else continue;
    }
    const stat = fs.lstatSync(cursor);
    if (stat.isSymbolicLink()) throw new Error(`${label} traverses a symbolic link: ${path.relative(projectRoot, cursor).split(path.sep).join('/')}`);
    if (!isLeaf && !stat.isDirectory()) throw new Error(`${label} parent is not a directory: ${path.relative(projectRoot, cursor).split(path.sep).join('/')}`);
    const real = fs.realpathSync(cursor), realDelta = path.relative(rootReal, real);
    if (realDelta.startsWith('..') || path.isAbsolute(realDelta)) throw new Error(`${label} realpath escapes the project: ${rel}`);
  }
  if (mustExist && !fs.existsSync(full)) throw new Error(`${label} missing: ${rel}`);
  if (file && fs.existsSync(full) && !fs.statSync(full).isFile()) throw new Error(`${label} is not a file: ${rel}`);
  return full;
}

function validateDerivedDirectory(root, { requireIgnore = true } = {}) {
  const projectRoot = path.resolve(root), dir = path.join(projectRoot, DERIVED_DIR);
  if (!entryStat(dir)) return dir;
  const stat = fs.lstatSync(dir);
  if (stat.isSymbolicLink()) throw new Error('.executionkit may not be a symbolic link');
  if (!stat.isDirectory()) throw new Error('.executionkit must be a directory');
  const rootReal = fs.realpathSync(projectRoot), dirReal = fs.realpathSync(dir), delta = path.relative(rootReal, dirReal);
  if (delta.startsWith('..') || path.isAbsolute(delta)) throw new Error('.executionkit realpath escapes the project');
  const ignore = path.join(dir, '.gitignore');
  if (!entryStat(ignore)) {
    if (requireIgnore) throw new Error('.executionkit/.gitignore is missing; derived state is not proven isolated');
    return dir;
  }
  const ignoreStat = fs.lstatSync(ignore);
  if (ignoreStat.isSymbolicLink() || !ignoreStat.isFile()) throw new Error('.executionkit/.gitignore must be a real file');
  const ignoreContent = fs.readFileSync(ignore, 'utf8').replaceAll('\r\n', '\n');
  if (![DERIVED_IGNORE_CONTENT,INSTALLED_IGNORE_CONTENT].includes(ignoreContent)) throw new Error('.executionkit/.gitignore differs from the canonical derived-state isolation contract');
  return dir;
}

export function ensureDerivedStateDirectory(root) {
  const projectRoot = path.resolve(root), dir = path.join(projectRoot, DERIVED_DIR);
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) throw new Error(`${DERIVED_DIR}: project root is missing/not a directory`);
  if (!entryStat(dir)) fs.mkdirSync(dir);
  validateDerivedDirectory(root, { requireIgnore:false });
  const ignore = path.join(dir, '.gitignore');
  if (!entryStat(ignore)) fs.writeFileSync(ignore, DERIVED_IGNORE_CONTENT, { flag:'wx' });
  validateDerivedDirectory(root, { requireIgnore:true });
  return dir;
}

export function resolveDerivedPath(root, rel, label = 'derived path', { mustExist = false, file = false, createParents = false } = {}) {
  const normalized = path.posix.normalize(String(rel ?? '').replaceAll('\\', '/').replace(/^\.\//, ''));
  if (['.executionkit/installation.json', '.executionkit/.gitignore', '.executionkit/upgrade-revalidation.json', '.executionkit/bin/ek', '.executionkit/bin/ek.cmd', '.executionkit/bin/ek.cjs'].includes(normalized) || ['.executionkit/runtime/kit', '.executionkit/runtime/AI-ExecutionKit', '.executionkit/source/AI-ExecutionKit'].some(runtime => normalized === runtime || normalized.startsWith(`${runtime}/`))) throw new Error(`${label} may not overwrite the installed source/receipt`);
  if (normalized !== DERIVED_DIR && !normalized.startsWith(`${DERIVED_DIR}/`)) throw new Error(`${label} must stay under ${DERIVED_DIR}/: ${rel}`);
  if (createParents) ensureDerivedStateDirectory(root);
  else if (entryStat(derivedDirectory(root))) validateDerivedDirectory(root, { requireIgnore:true });
  return resolveProjectPathSafe(root, normalized, label, { mustExist, file, createParents });
}

export function meaningfulGitStatus(statusText) {
  return String(statusText ?? '')
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => {
      if (!line.startsWith('?? ')) return true;
      const rel = line.slice(3).trim().replaceAll('\\', '/');
      if (rel === '.executionkit/installation.json' || ['.executionkit/runtime/kit', '.executionkit/runtime/AI-ExecutionKit'].some(runtime => rel === runtime || rel.startsWith(`${runtime}/`))) return true;
      return rel !== DERIVED_DIR && !rel.startsWith(`${DERIVED_DIR}/`);
    })
    .join('\n');
}
