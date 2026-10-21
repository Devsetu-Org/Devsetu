import type { ModuleTask } from '../fixtures/projectModules/types';
import { readMigrating } from './storageMigrate';

export function workspaceFilesKeys(persistId: string): { next: string; legacy: string } {
  return {
    next: `devsetu.workspace.${persistId}.files`,
    legacy: `devlabs.workspace.${persistId}.files`,
  };
}

/** The files a workspace saved in this browser, or null if it never saved. */
export function readSavedFiles(persistId: string): Record<string, string> | null {
  try {
    const { next, legacy } = workspaceFilesKeys(persistId);
    const raw = readMigrating(window.localStorage, next, legacy);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const files: Record<string, string> = {};
    for (const [path, source] of Object.entries(parsed)) {
      if (typeof source === 'string') files[path] = source;
    }
    return files;
  } catch {
    return null;
  }
}

/** A task is done once its TODO marker is gone from the file. */
export function taskDone(files: Record<string, string>, file: string, id: string): boolean {
  const source = files[file];
  if (typeof source !== 'string') return false;
  return !source.includes(`TODO(${id})`);
}

export function countDone(files: Record<string, string>, tasks: ModuleTask[]): number {
  return tasks.filter((task) => taskDone(files, task.file, task.id)).length;
}
