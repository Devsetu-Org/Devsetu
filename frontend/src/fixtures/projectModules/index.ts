/**
 * Registry of authored module content.
 *
 * `constants/projects.ts` is the plan — every chapter a project will ship. This
 * is what actually exists. A chapter marked `ready` there must have an entry
 * here, and `hasModuleContent` is what the UI trusts when it decides whether a
 * chapter opens or stays locked.
 *
 * Cinder V0.1: chapters are authored one at a time. The scratch repo in each
 * fixture only contains files that chapter needs; later chapters add paths.
 * Do not register a full memkv tree in chapter 1.
 */

import { LSM_TREE_MEMTABLE_CPP, LSM_TREE_MEMTABLE_GO, LSM_TREE_MEMTABLE_PYTHON } from './lsmTreeMinor';
import {
  LSM_TREE_COMPACTION_GO,
  LSM_TREE_READ_PATH_GO,
  LSM_TREE_SSTABLE_GO,
  LSM_TREE_WAL_GO,
} from './lsmTreeChaptersGo';
import {
  LSM_TREE_COMPACTION_PYTHON,
  LSM_TREE_READ_PATH_PYTHON,
  LSM_TREE_SSTABLE_PYTHON,
  LSM_TREE_WAL_PYTHON,
} from './lsmTreeChaptersPython';
import {
  LSM_TREE_COMPACTION_CPP,
  LSM_TREE_READ_PATH_CPP,
  LSM_TREE_SSTABLE_CPP,
  LSM_TREE_WAL_CPP,
} from './lsmTreeChaptersCpp';
import {
  B_TREE_BTREE_GO,
  B_TREE_BUFFER_POOL_GO,
  B_TREE_MUTATIONS_GO,
  B_TREE_PAGER_GO,
  B_TREE_WAL_GO,
} from './bTreeChaptersGo';
import {
  B_TREE_BTREE_PYTHON,
  B_TREE_BUFFER_POOL_PYTHON,
  B_TREE_MUTATIONS_PYTHON,
  B_TREE_PAGER_PYTHON,
  B_TREE_WAL_PYTHON,
} from './bTreeChaptersPython';
import {
  B_TREE_BTREE_CPP,
  B_TREE_BUFFER_POOL_CPP,
  B_TREE_MUTATIONS_CPP,
  B_TREE_PAGER_CPP,
  B_TREE_WAL_CPP,
} from './bTreeChaptersCpp';
import {
  CONSENSUS_CLIENTS_GO,
  CONSENSUS_COMMIT_GO,
  CONSENSUS_ELECTION_GO,
  CONSENSUS_PERSISTENCE_GO,
  CONSENSUS_REPLICATION_GO,
} from './consensusChaptersGo';
import {
  CONSENSUS_CLIENTS_PYTHON,
  CONSENSUS_COMMIT_PYTHON,
  CONSENSUS_ELECTION_PYTHON,
  CONSENSUS_PERSISTENCE_PYTHON,
  CONSENSUS_REPLICATION_PYTHON,
} from './consensusChaptersPython';
import {
  CONSENSUS_CLIENTS_CPP,
  CONSENSUS_COMMIT_CPP,
  CONSENSUS_ELECTION_CPP,
  CONSENSUS_PERSISTENCE_CPP,
  CONSENSUS_REPLICATION_CPP,
} from './consensusChaptersCpp';
import { LSM_TREE_OVERVIEW } from './lsmTreeOverview';
import { B_TREE_OVERVIEW } from './bTreeOverview';
import { CONSENSUS_OVERVIEW } from './consensusOverview';
import { QUERY_ENGINE_OVERVIEW } from './queryEngineOverview';
import { GIT_OVERVIEW } from './gitOverview';
import { SHELL_OVERVIEW } from './shellOverview';
import { SEARCH_OVERVIEW } from './searchOverview';
import {
  QUERY_ENGINE_CATALOG_GO,
  QUERY_ENGINE_EXECUTE_GO,
  QUERY_ENGINE_LEXER_GO,
  QUERY_ENGINE_PARSER_GO,
  QUERY_ENGINE_RELATIONAL_GO,
} from './queryEngineChaptersGo';
import {
  QUERY_ENGINE_CATALOG_PYTHON,
  QUERY_ENGINE_EXECUTE_PYTHON,
  QUERY_ENGINE_LEXER_PYTHON,
  QUERY_ENGINE_PARSER_PYTHON,
  QUERY_ENGINE_RELATIONAL_PYTHON,
} from './queryEngineChaptersPython';
import {
  QUERY_ENGINE_CATALOG_CPP,
  QUERY_ENGINE_EXECUTE_CPP,
  QUERY_ENGINE_LEXER_CPP,
  QUERY_ENGINE_PARSER_CPP,
  QUERY_ENGINE_RELATIONAL_CPP,
} from './queryEngineChaptersCpp';
import {
  GIT_COMMIT_CHECKOUT_GO,
  GIT_HISTORY_MERGE_GO,
  GIT_INDEX_GO,
  GIT_OBJECTS_GO,
  GIT_REFS_GO,
} from './gitChaptersGo';
import {
  GIT_COMMIT_CHECKOUT_PYTHON,
  GIT_HISTORY_MERGE_PYTHON,
  GIT_INDEX_PYTHON,
  GIT_OBJECTS_PYTHON,
  GIT_REFS_PYTHON,
} from './gitChaptersPython';
import {
  GIT_COMMIT_CHECKOUT_CPP,
  GIT_HISTORY_MERGE_CPP,
  GIT_INDEX_CPP,
  GIT_OBJECTS_CPP,
  GIT_REFS_CPP,
} from './gitChaptersCpp';
import {
  SHELL_EXEC_GO,
  SHELL_JOBS_GO,
  SHELL_LEXER_GO,
  SHELL_PIPES_GO,
  SHELL_REDIRECTS_GO,
} from './shellChaptersGo';
import {
  SHELL_EXEC_PYTHON,
  SHELL_JOBS_PYTHON,
  SHELL_LEXER_PYTHON,
  SHELL_PIPES_PYTHON,
  SHELL_REDIRECTS_PYTHON,
} from './shellChaptersPython';
import {
  SHELL_EXEC_CPP,
  SHELL_JOBS_CPP,
  SHELL_LEXER_CPP,
  SHELL_PIPES_CPP,
  SHELL_REDIRECTS_CPP,
} from './shellChaptersCpp';
import {
  SEARCH_INDEX_ANALYZE_GO,
  SEARCH_INDEX_INDEX_GO,
  SEARCH_INDEX_POSTINGS_GO,
  SEARCH_INDEX_QUERY_GO,
  SEARCH_INDEX_RANK_GO,
} from './searchIndexChaptersGo';
import {
  SEARCH_INDEX_ANALYZE_PYTHON,
  SEARCH_INDEX_INDEX_PYTHON,
  SEARCH_INDEX_POSTINGS_PYTHON,
  SEARCH_INDEX_QUERY_PYTHON,
  SEARCH_INDEX_RANK_PYTHON,
} from './searchIndexChaptersPython';
import {
  SEARCH_INDEX_ANALYZE_CPP,
  SEARCH_INDEX_INDEX_CPP,
  SEARCH_INDEX_POSTINGS_CPP,
  SEARCH_INDEX_QUERY_CPP,
  SEARCH_INDEX_RANK_CPP,
} from './searchIndexChaptersCpp';
import { CINDER_EVENT_LOOP } from './cinderEventLoop';
import type { LanguageId } from '../../constants/languages';
import type { ChapterReading, ProjectModuleContent } from './types';

export type { ChapterReading, ModuleTask, ProjectModuleContent } from './types';

/** Cinder chapter fixtures land here as each chapter is authored. */
const MODULE_CONTENT: ProjectModuleContent[] = [CINDER_EVENT_LOOP];

/** Single-workspace minors, keyed by minor id. (Chaptered minors use readings + chapter fixtures.) */
const MINOR_CONTENT: ProjectModuleContent[] = [];

/**
 * Chapters of chaptered minors: `projectId` is the minor id, `moduleId` the
 * chapter id, and `language` which port it is (Go when unset).
 */
const MINOR_CHAPTER_CONTENT: ProjectModuleContent[] = [
  LSM_TREE_MEMTABLE_GO,
  LSM_TREE_MEMTABLE_PYTHON,
  LSM_TREE_MEMTABLE_CPP,
  LSM_TREE_WAL_GO,
  LSM_TREE_WAL_PYTHON,
  LSM_TREE_WAL_CPP,
  LSM_TREE_SSTABLE_GO,
  LSM_TREE_SSTABLE_PYTHON,
  LSM_TREE_SSTABLE_CPP,
  LSM_TREE_READ_PATH_GO,
  LSM_TREE_READ_PATH_PYTHON,
  LSM_TREE_READ_PATH_CPP,
  LSM_TREE_COMPACTION_GO,
  LSM_TREE_COMPACTION_PYTHON,
  LSM_TREE_COMPACTION_CPP,
  B_TREE_PAGER_GO,
  B_TREE_PAGER_PYTHON,
  B_TREE_PAGER_CPP,
  B_TREE_BTREE_GO,
  B_TREE_BTREE_PYTHON,
  B_TREE_BTREE_CPP,
  B_TREE_WAL_GO,
  B_TREE_WAL_PYTHON,
  B_TREE_WAL_CPP,
  B_TREE_BUFFER_POOL_GO,
  B_TREE_BUFFER_POOL_PYTHON,
  B_TREE_BUFFER_POOL_CPP,
  B_TREE_MUTATIONS_GO,
  B_TREE_MUTATIONS_PYTHON,
  B_TREE_MUTATIONS_CPP,
  CONSENSUS_ELECTION_GO,
  CONSENSUS_ELECTION_PYTHON,
  CONSENSUS_ELECTION_CPP,
  CONSENSUS_REPLICATION_GO,
  CONSENSUS_REPLICATION_PYTHON,
  CONSENSUS_REPLICATION_CPP,
  CONSENSUS_COMMIT_GO,
  CONSENSUS_COMMIT_PYTHON,
  CONSENSUS_COMMIT_CPP,
  CONSENSUS_PERSISTENCE_GO,
  CONSENSUS_PERSISTENCE_PYTHON,
  CONSENSUS_PERSISTENCE_CPP,
  CONSENSUS_CLIENTS_GO,
  CONSENSUS_CLIENTS_PYTHON,
  CONSENSUS_CLIENTS_CPP,
  QUERY_ENGINE_LEXER_GO,
  QUERY_ENGINE_LEXER_PYTHON,
  QUERY_ENGINE_LEXER_CPP,
  QUERY_ENGINE_PARSER_GO,
  QUERY_ENGINE_PARSER_PYTHON,
  QUERY_ENGINE_PARSER_CPP,
  QUERY_ENGINE_CATALOG_GO,
  QUERY_ENGINE_CATALOG_PYTHON,
  QUERY_ENGINE_CATALOG_CPP,
  QUERY_ENGINE_EXECUTE_GO,
  QUERY_ENGINE_EXECUTE_PYTHON,
  QUERY_ENGINE_EXECUTE_CPP,
  QUERY_ENGINE_RELATIONAL_GO,
  QUERY_ENGINE_RELATIONAL_PYTHON,
  QUERY_ENGINE_RELATIONAL_CPP,
  GIT_OBJECTS_GO,
  GIT_OBJECTS_PYTHON,
  GIT_OBJECTS_CPP,
  GIT_REFS_GO,
  GIT_REFS_PYTHON,
  GIT_REFS_CPP,
  GIT_INDEX_GO,
  GIT_INDEX_PYTHON,
  GIT_INDEX_CPP,
  GIT_COMMIT_CHECKOUT_GO,
  GIT_COMMIT_CHECKOUT_PYTHON,
  GIT_COMMIT_CHECKOUT_CPP,
  GIT_HISTORY_MERGE_GO,
  GIT_HISTORY_MERGE_PYTHON,
  GIT_HISTORY_MERGE_CPP,
  SHELL_LEXER_GO,
  SHELL_LEXER_PYTHON,
  SHELL_LEXER_CPP,
  SHELL_EXEC_GO,
  SHELL_EXEC_PYTHON,
  SHELL_EXEC_CPP,
  SHELL_REDIRECTS_GO,
  SHELL_REDIRECTS_PYTHON,
  SHELL_REDIRECTS_CPP,
  SHELL_PIPES_GO,
  SHELL_PIPES_PYTHON,
  SHELL_PIPES_CPP,
  SHELL_JOBS_GO,
  SHELL_JOBS_PYTHON,
  SHELL_JOBS_CPP,
  SEARCH_INDEX_ANALYZE_GO,
  SEARCH_INDEX_ANALYZE_PYTHON,
  SEARCH_INDEX_ANALYZE_CPP,
  SEARCH_INDEX_POSTINGS_GO,
  SEARCH_INDEX_POSTINGS_PYTHON,
  SEARCH_INDEX_POSTINGS_CPP,
  SEARCH_INDEX_INDEX_GO,
  SEARCH_INDEX_INDEX_PYTHON,
  SEARCH_INDEX_INDEX_CPP,
  SEARCH_INDEX_QUERY_GO,
  SEARCH_INDEX_QUERY_PYTHON,
  SEARCH_INDEX_QUERY_CPP,
  SEARCH_INDEX_RANK_GO,
  SEARCH_INDEX_RANK_PYTHON,
  SEARCH_INDEX_RANK_CPP,
];

const DEFAULT_LANGUAGE: LanguageId = 'go';

const BY_KEY = new Map<string, ProjectModuleContent>(
  MODULE_CONTENT.map((m) => [`${m.projectId}/${m.moduleId}`, m]),
);

const MINOR_BY_ID = new Map<string, ProjectModuleContent>(
  MINOR_CONTENT.map((m) => [m.moduleId, m]),
);

const MINOR_CHAPTER_BY_KEY = new Map<string, ProjectModuleContent>(
  MINOR_CHAPTER_CONTENT.map((m) => [
    `${m.projectId}/${m.moduleId}/${m.language || DEFAULT_LANGUAGE}`,
    m,
  ]),
);

/** Articles for `reading` chapters of minors, keyed `minorId/chapterId`. */
const MINOR_READINGS = new Map<string, ChapterReading>([
  ['lsm-tree/overview', LSM_TREE_OVERVIEW],
  ['b-tree/overview', B_TREE_OVERVIEW],
  ['consensus/overview', CONSENSUS_OVERVIEW],
  ['query-engine/overview', QUERY_ENGINE_OVERVIEW],
  ['git/overview', GIT_OVERVIEW],
  ['shell/overview', SHELL_OVERVIEW],
  ['search-index/overview', SEARCH_OVERVIEW],
]);

export function getModuleContent(
  projectId: string | null | undefined,
  moduleId: string | null | undefined,
): ProjectModuleContent | null {
  if (!projectId || !moduleId) return null;
  return BY_KEY.get(`${projectId}/${moduleId}`) || null;
}

export function hasModuleContent(
  projectId: string | null | undefined,
  moduleId: string | null | undefined,
): boolean {
  return getModuleContent(projectId, moduleId) != null;
}

export function getMinorContent(minorId: string | null | undefined): ProjectModuleContent | null {
  if (!minorId) return null;
  return MINOR_BY_ID.get(minorId) || null;
}

export function hasMinorContent(minorId: string | null | undefined): boolean {
  return getMinorContent(minorId) != null;
}

export function getMinorChapterContent(
  minorId: string | null | undefined,
  chapterId: string | null | undefined,
  language: LanguageId = DEFAULT_LANGUAGE,
): ProjectModuleContent | null {
  if (!minorId || !chapterId) return null;
  return MINOR_CHAPTER_BY_KEY.get(`${minorId}/${chapterId}/${language}`) || null;
}

export function hasMinorChapterContent(
  minorId: string | null | undefined,
  chapterId: string | null | undefined,
  language: LanguageId = DEFAULT_LANGUAGE,
): boolean {
  return getMinorChapterContent(minorId, chapterId, language) != null;
}

export function getMinorReading(
  minorId: string | null | undefined,
  chapterId: string | null | undefined,
): ChapterReading | null {
  if (!minorId || !chapterId) return null;
  return MINOR_READINGS.get(`${minorId}/${chapterId}`) || null;
}
