import { integrationAllowsTask, canonicalState, extractDependencies, stateSatisfiesDependency } from './execution-model.mjs';

export function resolveReadinessCandidates(tasks, config) {
  const active = (tasks ?? []).filter((task) => !task.isArchive);
  const byId = new Map(active.map((task) => [task.id, task]));
  const candidates = [];

  for (const task of active) {
    if (canonicalState(task, config) !== 'PLANNED' || !integrationAllowsTask(task, tasks, config)) continue;
    const dependencies = extractDependencies(task);
    const unresolvedDependencies = dependencies.filter((id) => {
      const dependency = byId.get(id);
      return !dependency || !stateSatisfiesDependency(dependency, config);
    });
    if (unresolvedDependencies.length) continue;
    candidates.push({
      task,
      dependencies,
      unresolvedDependencies,
      phase: task.meta?.Phase ?? null,
      priority: task.meta?.Priority ?? null,
      contract: task.meta?.Contract ?? null,
    });
  }

  candidates.sort((a, b) => (a.task.order ?? 0) - (b.task.order ?? 0) || a.task.id.localeCompare(b.task.id));
  return candidates;
}

export function nextReadinessCandidate(tasks, config) {
  return resolveReadinessCandidates(tasks, config)[0] ?? null;
}
