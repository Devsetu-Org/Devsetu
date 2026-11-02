/**
 * Search-index chapters 1–5, Go only for now. Each starter repo is loaded whole
 * from its `go/files/` folder; `solution/` folders are never globbed, so they
 * stay out of the bundle.
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

// Vite needs the glob options written out literally in each call.
const ANALYZE_FILES = import.meta.glob<string>('./minors/search-index/analyze/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const POSTINGS_FILES = import.meta.glob<string>('./minors/search-index/postings/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const INDEX_FILES = import.meta.glob<string>('./minors/search-index/index/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const QUERY_FILES = import.meta.glob<string>('./minors/search-index/query/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const RANK_FILES = import.meta.glob<string>('./minors/search-index/rank/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Glob keys are module paths; the workspace wants repo-relative paths. */
function repo(globbed: RawFiles): RawFiles {
  const out: RawFiles = {};
  for (const [path, source] of Object.entries(globbed)) {
    const at = path.indexOf('/go/files/');
    out[path.slice(at + '/go/files/'.length)] = source;
  }
  return out;
}

const VERIFY = ['make test', 'make race', 'make run'];

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
    language: 'go',
    theory: theoryForLanguage(theory, 'go'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: VERIFY,
    verifyLead: SEARCH_INDEX_VERIFY_LEAD,
  };
}

export const SEARCH_INDEX_ANALYZE_GO = chapter(
  'analyze',
  analyzeTheory,
  ANALYZE_FILES,
  'internal/analyze/analyze.go',
  [
    {
      id: '1.1',
      label: 'Tokenize text',
      file: 'internal/analyze/analyze.go',
      summary: 'Tokenize: split on non-letters; keep Unicode letter runs; preserve case.',
    },
    {
      id: '1.2',
      label: 'Lowercase tokens',
      file: 'internal/analyze/analyze.go',
      summary: 'Lower: strings.ToLower each token into a new slice.',
    },
    {
      id: '1.3',
      label: 'Drop stopwords',
      file: 'internal/analyze/analyze.go',
      summary: 'FilterStop: drop tokens in Stopwords; preserve order.',
    },
  ],
);

export const SEARCH_INDEX_POSTINGS_GO = chapter(
  'postings',
  postingsTheory,
  POSTINGS_FILES,
  'internal/postings/map.go',
  [
    {
      id: '2.1',
      label: 'Add a posting',
      file: 'internal/postings/map.go',
      summary: 'Map.Add: insert or replace (docId, tf); keep the list sorted by doc id.',
    },
    {
      id: '2.2',
      label: 'Encode a segment',
      file: 'internal/postings/segment.go',
      summary: 'WriteSegment: header, sorted directory, then (docId, tf) data.',
    },
    {
      id: '2.3',
      label: 'Decode and seek',
      file: 'internal/postings/segment.go',
      summary: 'DecodeSegment and Segment.Postings: directory lookup, then read pairs.',
    },
  ],
);

export const SEARCH_INDEX_INDEX_GO = chapter(
  'index',
  indexTheory,
  INDEX_FILES,
  'internal/index/add.go',
  [
    {
      id: '3.1',
      label: 'Add a document',
      file: 'internal/index/add.go',
      summary: 'Add: analyze, assign a doc id, record length, buffer postings.',
    },
    {
      id: '3.2',
      label: 'Flush a segment',
      file: 'internal/index/flush.go',
      summary: 'Flush: write segment-N.fx, open it, clear the buffer, write catalog.json.',
    },
    {
      id: '3.3',
      label: 'Open a catalog',
      file: 'internal/index/open.go',
      summary: 'Open: create or load catalog.json and reopen every listed segment.',
    },
  ],
);

export const SEARCH_INDEX_QUERY_GO = chapter(
  'query',
  queryTheory,
  QUERY_FILES,
  'internal/query/parse.go',
  [
    {
      id: '4.1',
      label: 'Parse a query',
      file: 'internal/query/parse.go',
      summary: 'Parse: OR splits groups; each group is analyzed; terms inside a group are AND.',
    },
    {
      id: '4.2',
      label: 'Intersect postings',
      file: 'internal/query/bool.go',
      summary: 'Intersect: docs that appear in every sorted posting list.',
    },
    {
      id: '4.3',
      label: 'Union postings',
      file: 'internal/query/bool.go',
      summary: 'Union: docs that appear in any list; ids stay sorted and unique.',
    },
  ],
);

export const SEARCH_INDEX_RANK_GO = chapter(
  'rank',
  rankTheory,
  RANK_FILES,
  'internal/rank/bm25.go',
  [
    {
      id: '5.1',
      label: 'Collection stats',
      file: 'internal/rank/stats.go',
      summary: 'CollectStats: N, avgdl, and df for each query term.',
    },
    {
      id: '5.2',
      label: 'BM25 score',
      file: 'internal/rank/bm25.go',
      summary: 'IDF and Score with k1=1.2 and b=0.75.',
    },
    {
      id: '5.3',
      label: 'Top-k hits',
      file: 'internal/rank/topk.go',
      summary: 'TopK: sort by score descending, then doc id ascending; keep k.',
    },
  ],
);
