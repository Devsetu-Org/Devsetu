/**
 * Search-index chapters 1–5, C++. Each starter repo is loaded whole from its
 * `cpp/files/` folder; `solution/` folders are never globbed, so they stay
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

const ANALYZE_FILES = import.meta.glob<string>('./minors/search-index/analyze/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const POSTINGS_FILES = import.meta.glob<string>('./minors/search-index/postings/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const INDEX_FILES = import.meta.glob<string>('./minors/search-index/index/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const QUERY_FILES = import.meta.glob<string>('./minors/search-index/query/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const RANK_FILES = import.meta.glob<string>('./minors/search-index/rank/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Glob keys are module paths; the workspace wants repo-relative paths. */
function repo(globbed: RawFiles): RawFiles {
  const out: RawFiles = {};
  for (const [path, source] of Object.entries(globbed)) {
    const at = path.indexOf('/cpp/files/');
    out[path.slice(at + '/cpp/files/'.length)] = source;
  }
  return out;
}

const VERIFY = ['make test', 'make asan', 'make run'];

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
    language: 'cpp',
    theory: theoryForLanguage(theory, 'cpp'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: VERIFY,
    verifyLead: SEARCH_INDEX_VERIFY_LEAD,
  };
}

export const SEARCH_INDEX_ANALYZE_CPP = chapter(
  'analyze',
  analyzeTheory,
  ANALYZE_FILES,
  'src/analyze/analyze.cc',
  [
    {
      id: '1.1',
      label: 'Tokenize text',
      file: 'src/analyze/analyze.cc',
      summary: 'Tokenize: split on non-letters; keep Unicode letter runs; preserve case.',
    },
    {
      id: '1.2',
      label: 'Lowercase tokens',
      file: 'src/analyze/analyze.cc',
      summary: 'Lower: ToLowerUtf8 each token into a new vector.',
    },
    {
      id: '1.3',
      label: 'Drop stopwords',
      file: 'src/analyze/analyze.cc',
      summary: 'FilterStop: drop tokens in Stopwords(); preserve order.',
    },
  ],
);

export const SEARCH_INDEX_POSTINGS_CPP = chapter(
  'postings',
  postingsTheory,
  POSTINGS_FILES,
  'src/postings/map.cc',
  [
    {
      id: '2.1',
      label: 'Add a posting',
      file: 'src/postings/map.cc',
      summary: 'Map::Add: insert or replace (doc_id, tf); keep the list sorted by doc id.',
    },
    {
      id: '2.2',
      label: 'Encode a segment',
      file: 'src/postings/segment.cc',
      summary: 'WriteSegment: header, sorted directory, then (doc_id, tf) data.',
    },
    {
      id: '2.3',
      label: 'Decode and seek',
      file: 'src/postings/segment.cc',
      summary: 'DecodeSegment and Segment::Postings: directory lookup, then read pairs.',
    },
  ],
);

export const SEARCH_INDEX_INDEX_CPP = chapter(
  'index',
  indexTheory,
  INDEX_FILES,
  'src/index/add.cc',
  [
    {
      id: '3.1',
      label: 'Add a document',
      file: 'src/index/add.cc',
      summary: 'Add: analyze, assign a doc id, record length, buffer postings.',
    },
    {
      id: '3.2',
      label: 'Flush a segment',
      file: 'src/index/flush.cc',
      summary: 'Flush: write segment-N.fx, open it, clear the buffer, write catalog.json.',
    },
    {
      id: '3.3',
      label: 'Open a catalog',
      file: 'src/index/open.cc',
      summary: 'Open: create or load catalog.json and reopen every listed segment.',
    },
  ],
);

export const SEARCH_INDEX_QUERY_CPP = chapter(
  'query',
  queryTheory,
  QUERY_FILES,
  'src/query/parse.cc',
  [
    {
      id: '4.1',
      label: 'Parse a query',
      file: 'src/query/parse.cc',
      summary: 'Parse: OR splits groups; each group is analyzed; terms inside a group are AND.',
    },
    {
      id: '4.2',
      label: 'Intersect postings',
      file: 'src/query/bool.cc',
      summary: 'Intersect: docs that appear in every sorted posting list.',
    },
    {
      id: '4.3',
      label: 'Union postings',
      file: 'src/query/bool.cc',
      summary: 'Union: docs that appear in any list; ids stay sorted and unique.',
    },
  ],
);

export const SEARCH_INDEX_RANK_CPP = chapter(
  'rank',
  rankTheory,
  RANK_FILES,
  'src/rank/bm25.cc',
  [
    {
      id: '5.1',
      label: 'Collection stats',
      file: 'src/rank/stats.cc',
      summary: 'CollectStats: N, avg_dl, and df for each query term.',
    },
    {
      id: '5.2',
      label: 'BM25 score',
      file: 'src/rank/bm25.cc',
      summary: 'IDF and Score with k1=1.2 and b=0.75.',
    },
    {
      id: '5.3',
      label: 'Top-k hits',
      file: 'src/rank/topk.cc',
      summary: 'TopK: sort by score descending, then doc id ascending; keep k.',
    },
  ],
);
