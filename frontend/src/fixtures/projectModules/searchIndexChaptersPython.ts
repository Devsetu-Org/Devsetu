/**
 * Search-index chapters 1–5, Python. Each starter repo is loaded whole from its
 * `python/files/` folder; `solution/` folders are never globbed, so they stay
 * out of the bundle.
 *
 * A task's `file` also marks which files the learner owns: the workspace
 * carries those files into later chapters, so they must be byte-identical in
 * every later starter (see minors/search-index/AUTHORING.md).
 */

import type { ModuleTask, ProjectModuleContent } from './types';
import { SEARCH_INDEX_VERIFY_LEAD } from './searchIndexMinor';
import { theoryForLanguage } from './theoryLanguage';

import analyzeTheory from './minors/search-index/analyze/theory.md?raw';
import postingsTheory from './minors/search-index/postings/theory.md?raw';
import indexTheory from './minors/search-index/index/theory.md?raw';
import queryTheory from './minors/search-index/query/theory.md?raw';
import rankTheory from './minors/search-index/rank/theory.md?raw';

type RawFiles = Record<string, string>;

const ANALYZE_FILES = import.meta.glob<string>('./minors/search-index/analyze/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const POSTINGS_FILES = import.meta.glob<string>('./minors/search-index/postings/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const INDEX_FILES = import.meta.glob<string>('./minors/search-index/index/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const QUERY_FILES = import.meta.glob<string>('./minors/search-index/query/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const RANK_FILES = import.meta.glob<string>('./minors/search-index/rank/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Glob keys are module paths; the workspace wants repo-relative paths. */
function repo(globbed: RawFiles): RawFiles {
  const out: RawFiles = {};
  for (const [path, source] of Object.entries(globbed)) {
    const at = path.indexOf('/python/files/');
    out[path.slice(at + '/python/files/'.length)] = source;
  }
  return out;
}

const VERIFY = ['make test', 'make run'];

function chapter(
  moduleId: string,
  theory: string,
  files: RawFiles,
  entryFile: string,
  tasks: ModuleTask[],
): ProjectModuleContent {
  const repoFiles = repo(files);
  if (import.meta.env.DEV) {
    for (const path of [entryFile, ...tasks.map((t) => t.file)]) {
      if (!(path in repoFiles)) console.error(`search-index/${moduleId}: starter repo has no ${path}`);
    }
  }
  return {
    projectId: 'search-index',
    moduleId,
    language: 'python',
    theory: theoryForLanguage(theory, 'python'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: VERIFY,
    verifyLead: SEARCH_INDEX_VERIFY_LEAD,
  };
}

export const SEARCH_INDEX_ANALYZE_PYTHON = chapter(
  'analyze',
  analyzeTheory,
  ANALYZE_FILES,
  'findx/analyze/analyze.py',
  [
    {
      id: '1.1',
      label: 'Tokenize text',
      file: 'findx/analyze/analyze.py',
      summary: 'tokenize: split on non-letters; keep Unicode letter runs; preserve case.',
    },
    {
      id: '1.2',
      label: 'Lowercase tokens',
      file: 'findx/analyze/analyze.py',
      summary: 'lower: .lower() each token into a new list.',
    },
    {
      id: '1.3',
      label: 'Drop stopwords',
      file: 'findx/analyze/analyze.py',
      summary: 'filter_stop: drop tokens in STOPWORDS; preserve order.',
    },
  ],
);

export const SEARCH_INDEX_POSTINGS_PYTHON = chapter(
  'postings',
  postingsTheory,
  POSTINGS_FILES,
  'findx/postings/map.py',
  [
    {
      id: '2.1',
      label: 'Add a posting',
      file: 'findx/postings/map.py',
      summary: 'Map.add: insert or replace (doc_id, tf); keep the list sorted by doc id.',
    },
    {
      id: '2.2',
      label: 'Encode a segment',
      file: 'findx/postings/segment.py',
      summary: 'write_segment: header, sorted directory, then (doc_id, tf) data.',
    },
    {
      id: '2.3',
      label: 'Decode and seek',
      file: 'findx/postings/segment.py',
      summary: 'decode_segment and Segment.postings: directory lookup, then read pairs.',
    },
  ],
);

export const SEARCH_INDEX_INDEX_PYTHON = chapter(
  'index',
  indexTheory,
  INDEX_FILES,
  'findx/index/add.py',
  [
    {
      id: '3.1',
      label: 'Add a document',
      file: 'findx/index/add.py',
      summary: 'add: analyze, assign a doc id, record length, buffer postings.',
    },
    {
      id: '3.2',
      label: 'Flush a segment',
      file: 'findx/index/flush.py',
      summary: 'flush: write segment-N.fx, open it, clear the buffer, write catalog.json.',
    },
    {
      id: '3.3',
      label: 'Open a catalog',
      file: 'findx/index/open.py',
      summary: 'open_index: create or load catalog.json and reopen every listed segment.',
    },
  ],
);

export const SEARCH_INDEX_QUERY_PYTHON = chapter(
  'query',
  queryTheory,
  QUERY_FILES,
  'findx/query/parse.py',
  [
    {
      id: '4.1',
      label: 'Parse a query',
      file: 'findx/query/parse.py',
      summary: 'parse: OR splits groups; each group is analyzed; terms inside a group are AND.',
    },
    {
      id: '4.2',
      label: 'Intersect postings',
      file: 'findx/query/bool.py',
      summary: 'intersect: docs that appear in every sorted posting list.',
    },
    {
      id: '4.3',
      label: 'Union postings',
      file: 'findx/query/bool.py',
      summary: 'union: docs that appear in any list; ids stay sorted and unique.',
    },
  ],
);

export const SEARCH_INDEX_RANK_PYTHON = chapter(
  'rank',
  rankTheory,
  RANK_FILES,
  'findx/rank/bm25.py',
  [
    {
      id: '5.1',
      label: 'Collection stats',
      file: 'findx/rank/stats.py',
      summary: 'collect_stats: N, avg_dl, and df for each query term.',
    },
    {
      id: '5.2',
      label: 'BM25 score',
      file: 'findx/rank/bm25.py',
      summary: 'idf and score with k1=1.2 and b=0.75.',
    },
    {
      id: '5.3',
      label: 'Top-k hits',
      file: 'findx/rank/topk.py',
      summary: 'top_k: sort by score descending, then doc id ascending; keep k.',
    },
  ],
);
