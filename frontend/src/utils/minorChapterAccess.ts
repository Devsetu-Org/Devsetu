/**
 * Sequential unlock for chaptered minors: a build chapter opens only after
 * every earlier build chapter has a successful Run in at least one language.
 * Reading chapters never lock the chain.
 */

import type { LanguageId } from '../constants/languages';
import type { MinorEntry } from '../constants/minors';
import type { ProjectModule } from '../constants/projects';
import { getMinorChapterContent, getMinorReading, hasMinorChapterContent } from '../fixtures/projectModules';
import { loadRunHistory } from './projectRunHistory';
import { countDone, readSavedFiles } from './workspaceFiles';

export function chapterPersistId(
  minor: MinorEntry,
  chapter: ProjectModule,
  language: LanguageId,
): string {
  const languageSuffix = language === 'go' ? '' : `.${language}`;
  return `minor.${minor.id}.${chapter.id}${languageSuffix}`;
}

/** Shared Runs scope for a chapter (all languages). */
export function chapterRunScopeId(minorId: string, chapterId: string): string {
  return `minor.${minorId}.${chapterId}`;
}

/** Authored content exists for this chapter in this language. */
export function chapterHasContent(
  minor: MinorEntry,
  chapter: ProjectModule,
  language: LanguageId,
): boolean {
  if (chapter.status !== 'ready') return false;
  return chapter.kind === 'reading'
    ? getMinorReading(minor.id, chapter.id) != null
    : hasMinorChapterContent(minor.id, chapter.id, language);
}

/**
 * Cleared once any language has a succeeded Run for this chapter.
 * Task progress is separate (shown as 2/4); unlock keys off the green run.
 */
export function chapterCleared(minor: MinorEntry, chapter: ProjectModule): boolean {
  if (chapter.kind === 'reading') return true;
  const history = loadRunHistory(chapterRunScopeId(minor.id, chapter.id));
  return history.some((run) => run.status === 'succeeded');
}

/** Task progress for the language currently selected (null if never started). */
export function chapterTaskProgress(
  minor: MinorEntry,
  chapter: ProjectModule,
  language: LanguageId,
): { done: number; total: number } | null {
  if (chapter.kind === 'reading') return null;
  const content = getMinorChapterContent(minor.id, chapter.id, language);
  if (!content || content.tasks.length === 0) return null;
  const saved = readSavedFiles(chapterPersistId(minor, chapter, language));
  if (!saved) return null;
  return { done: countDone(saved, content.tasks), total: content.tasks.length };
}

/** Earlier ready build chapters that still block this one. */
export function blockingChapters(
  minor: MinorEntry,
  chapter: ProjectModule,
  language: LanguageId,
): ProjectModule[] {
  const chapters = minor.chapters || [];
  const index = chapters.findIndex((c) => c.id === chapter.id);
  if (index <= 0) return [];
  return chapters.slice(0, index).filter((earlier) => {
    if (earlier.kind === 'reading') return false;
    // Blocker if that chapter exists in any listed language and is not cleared.
    const langs = minor.languages?.length ? minor.languages : ([language] as LanguageId[]);
    const authored = langs.some((lang) => chapterHasContent(minor, earlier, lang));
    if (!authored) return false;
    return !chapterCleared(minor, earlier);
  });
}

/**
 * Whether the learner may open this chapter.
 * Overview + chapters whose priors have a successful Run.
 */
export function chapterUnlocked(
  minor: MinorEntry,
  chapter: ProjectModule,
  language: LanguageId,
): boolean {
  if (!chapterHasContent(minor, chapter, language)) return false;
  if (chapter.kind === 'reading') return true;
  return blockingChapters(minor, chapter, language).length === 0;
}

export type ChapterAccess = 'open' | 'locked' | 'soon';

export function chapterAccess(
  minor: MinorEntry,
  chapter: ProjectModule,
  language: LanguageId,
): ChapterAccess {
  if (!chapterHasContent(minor, chapter, language)) return 'soon';
  if (chapterUnlocked(minor, chapter, language)) return 'open';
  return 'locked';
}

export function lockReason(
  minor: MinorEntry,
  chapter: ProjectModule,
  language: LanguageId,
): string | null {
  const blockers = blockingChapters(minor, chapter, language);
  if (blockers.length === 0) return null;
  const first = blockers[0];
  return `Pass ${first.label} first`;
}
