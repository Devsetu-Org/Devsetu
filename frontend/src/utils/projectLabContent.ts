/**
 * Track labs with sandboxType `project` reuse a coding-minor ModuleWorkspace
 * (editor + theory/tasks + make test) instead of a Linux/K8s box terminal.
 */

import type { ChallengeFull, ChallengePublic } from '../types/domain';
import {
  getMinorChapterContent,
  type ProjectModuleContent,
} from '../fixtures/projectModules';
import type { LanguageId } from '../constants/languages';
import type { ModuleTask } from '../fixtures/projectModules/types';

export type ProjectLabSpec = {
  minorId: string;
  chapterId: string;
  taskId?: string;
  language?: LanguageId;
};

/** Legacy packs used chapterId `fallacies` + taskId; content is now per-lab. */
const FALLACIES_TASK_CHAPTER: Record<string, string> = {
  '1.1': 'fallacies-1.1',
  '1.2': 'fallacies-1.2',
  '1.3': 'fallacies-1.3',
  '1.4': 'fallacies-1.4',
};

const FALLACIES_CHALLENGE_CHAPTER: Record<string, { chapterId: string; taskId: string }> = {
  'ds-foundations-01-unreliable-slow-network': { chapterId: 'fallacies-1.1', taskId: '1.1' },
  'ds-foundations-02-constrained-network': { chapterId: 'fallacies-1.2', taskId: '1.2' },
  'ds-foundations-03-changing-untrusted-network': { chapterId: 'fallacies-1.3', taskId: '1.3' },
  'ds-foundations-04-heterogeneous-cluster': { chapterId: 'fallacies-1.4', taskId: '1.4' },
};

export function isProjectChallenge(
  challenge: ChallengePublic | ChallengeFull | null | undefined,
): boolean {
  return (challenge?.sandboxType || '') === 'project';
}

/** Read `projectPlatform` from the pack (with Fallacies remaps / hard fallbacks). */
export function projectLabSpec(
  challenge: ChallengePublic | ChallengeFull | null | undefined,
): ProjectLabSpec | null {
  if (!challenge) return null;
  const raw = challenge.projectPlatform;
  if (raw?.minorId && raw?.chapterId) {
    let chapterId = String(raw.chapterId);
    const taskId = raw.taskId ? String(raw.taskId) : undefined;
    // Old packs pointed at the shared Fallacies chapter; map to the lab module.
    if (chapterId === 'fallacies' && taskId && FALLACIES_TASK_CHAPTER[taskId]) {
      chapterId = FALLACIES_TASK_CHAPTER[taskId];
    }
    return {
      minorId: String(raw.minorId),
      chapterId,
      taskId,
      language: (raw.language as LanguageId | undefined) || 'go',
    };
  }
  const fb = FALLACIES_CHALLENGE_CHAPTER[challenge.id];
  if (fb) {
    return {
      minorId: 'ds-foundations',
      chapterId: fb.chapterId,
      taskId: fb.taskId,
      language: 'go',
    };
  }
  return null;
}

/**
 * Module content for this track lab. When `taskId` is set, only that task is
 * listed so the shelf lab matches one TODO.
 */
export function resolveProjectLabContent(
  challenge: ChallengePublic | ChallengeFull | null | undefined,
): { content: ProjectModuleContent; initialTaskId: string | null; spec: ProjectLabSpec } | null {
  const spec = projectLabSpec(challenge);
  if (!spec) return null;
  const base = getMinorChapterContent(spec.minorId, spec.chapterId, spec.language || 'go');
  if (!base) return null;

  let tasks: ModuleTask[] = base.tasks;
  if (spec.taskId) {
    const one = base.tasks.filter((t) => t.id === spec.taskId);
    if (one.length > 0) tasks = one;
  }

  const initialTaskId =
    spec.taskId && tasks.some((t) => t.id === spec.taskId) ? spec.taskId : null;

  return {
    spec,
    initialTaskId,
    content: { ...base, tasks },
  };
}
