import type { ProjectModuleContent } from '../fixtures/projectModules/types';
import { taskDone } from './workspaceFiles';

/**
 * Chapters of a minor build on each other. Every task file belongs to the
 * chapter that asks for it, and later starters ship that file solved. A
 * learner's own version replaces the solved one once the chapter is finished.
 */
export interface EarlierChapter {
  id: string;
  label: string;
  href: string;
  persistId: string;
  content: ProjectModuleContent;
}

export interface CarryPlan {
  /** The starter, with the learner's files wherever their chapter is finished. */
  files: Record<string, string>;
  fromLearner: EarlierChapter[];
  /** Chapters still on the reference: never opened here, or tasks left open. */
  unfinished: EarlierChapter[];
}

export function ownedFiles(chapter: EarlierChapter): string[] {
  return [...new Set(chapter.content.tasks.map((task) => task.file))];
}

/**
 * Builds a chapter's starting files from the learner's earlier work. A file is
 * taken from the latest earlier chapter that saved it, so a fix made while
 * working on a later chapter carries on too. A chapter is carried whole or
 * not at all: only when every one of its tasks is done in the files found.
 */
export function planCarry(
  starter: Record<string, string>,
  earlier: EarlierChapter[],
  readSaved: (persistId: string) => Record<string, string> | null,
): CarryPlan {
  const saved = earlier.map((chapter) => readSaved(chapter.persistId));
  const files = { ...starter };
  const fromLearner: EarlierChapter[] = [];
  const unfinished: EarlierChapter[] = [];

  earlier.forEach((chapter, owner) => {
    const picked: Record<string, string> = {};
    for (const path of ownedFiles(chapter)) {
      if (!(path in starter)) continue;
      for (let j = saved.length - 1; j >= owner; j -= 1) {
        const source = saved[j]?.[path];
        if (typeof source === 'string') {
          picked[path] = source;
          break;
        }
      }
    }
    const finished = chapter.content.tasks.every(
      (task) => !(task.file in starter) || taskDone(picked, task.file, task.id),
    );
    if (finished) {
      Object.assign(files, picked);
      fromLearner.push(chapter);
    } else {
      unfinished.push(chapter);
    }
  });

  return { files, fromLearner, unfinished };
}

/** Replaces every earlier chapter's files in `files` with the reference ones. */
export function withReference(
  files: Record<string, string>,
  starter: Record<string, string>,
  earlier: EarlierChapter[],
): Record<string, string> {
  const next = { ...files };
  for (const chapter of earlier) {
    for (const path of ownedFiles(chapter)) {
      if (path in starter) next[path] = starter[path];
    }
  }
  return next;
}

export function joinLabels(chapters: EarlierChapter[]): string {
  const labels = chapters.map((chapter) => chapter.label);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}
