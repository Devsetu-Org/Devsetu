/**
 * B-tree chapters 1–5, Go only for now. Each starter repo is loaded whole from
 * its `go/files/` folder; `solution/` folders are never globbed, so they stay
 * out of the bundle.
 *
 * A task's `file` also marks which files the learner owns: the workspace
 * carries those files into later chapters, so they must be byte-identical in
 * every later starter (see minors/b-tree/AUTHORING.md).
 */

import type { ModuleTask, ProjectModuleContent } from './types';
import { B_TREE_VERIFY_LEAD } from './bTreeMinor';
import { theoryForLanguage } from './theoryLanguage';

import pagerTheory from './minors/b-tree/pager/theory.md?raw';
import btreeTheory from './minors/b-tree/btree/theory.md?raw';
import walTheory from './minors/b-tree/write-ahead-log/theory.md?raw';
import bufferPoolTheory from './minors/b-tree/buffer-pool/theory.md?raw';
import mutationsTheory from './minors/b-tree/mutations/theory.md?raw';

type RawFiles = Record<string, string>;

// Vite needs the glob options written out literally in each call.
const PAGER_FILES = import.meta.glob<string>('./minors/b-tree/pager/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const BTREE_FILES = import.meta.glob<string>('./minors/b-tree/btree/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const WAL_FILES = import.meta.glob<string>('./minors/b-tree/write-ahead-log/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const BUFFER_POOL_FILES = import.meta.glob<string>('./minors/b-tree/buffer-pool/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const MUTATIONS_FILES = import.meta.glob<string>('./minors/b-tree/mutations/go/files/**/*', {
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
      if (!(path in repoFiles)) console.error(`b-tree/${moduleId}: starter repo has no ${path}`);
    }
  }
  return {
    projectId: 'b-tree',
    moduleId,
    language: 'go',
    theory: theoryForLanguage(theory, 'go'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: VERIFY,
    verifyLead: B_TREE_VERIFY_LEAD,
  };
}

export const B_TREE_PAGER_GO = chapter(
  'pager',
  pagerTheory,
  PAGER_FILES,
  'internal/pager/readwrite.go',
  [
    {
      id: '1.1',
      label: 'Write a checksummed page',
      file: 'internal/pager/readwrite.go',
      summary: 'WritePage: copy the page, seal it with a CRC-32C trailer, write it at no * PageSize.',
    },
    {
      id: '1.2',
      label: 'Read and verify a page',
      file: 'internal/pager/readwrite.go',
      summary: 'ReadPage: read a whole page, reject a short read, reject a bad checksum.',
    },
    {
      id: '1.3',
      label: 'Allocate a page',
      file: 'internal/pager/alloc.go',
      summary: 'Allocate: pop the freelist, or grow the file by one blank page.',
    },
    {
      id: '1.4',
      label: 'Free a page',
      file: 'internal/pager/alloc.go',
      summary: 'Free: write a free page that points at the old head, then make it the head.',
    },
  ],
);

export const B_TREE_BTREE_GO = chapter(
  'btree',
  btreeTheory,
  BTREE_FILES,
  'internal/btree/search.go',
  [
    {
      id: '2.1',
      label: 'Search inside a page',
      file: 'internal/btree/search.go',
      summary: 'childIndex and leafIndex: binary search; a key equal to a separator goes right.',
    },
    {
      id: '2.2',
      label: 'Walk root to leaf',
      file: 'internal/btree/search.go',
      summary: 'findLeaf and Get: one page per level, from the root down to the leaf.',
    },
    {
      id: '2.3',
      label: 'Insert into a leaf',
      file: 'internal/btree/insert.go',
      summary: 'leafPut: keep keys sorted in step with values; overwrite an existing key.',
    },
    {
      id: '2.4',
      label: 'Split a page',
      file: 'internal/btree/insert.go',
      summary: 'split: a leaf copies its separator up, an internal page moves it up.',
    },
    {
      id: '2.5',
      label: 'Push splits up, grow a root',
      file: 'internal/btree/insert.go',
      summary: 'Insert and insert: recurse down, hand splits to the parent, make a new root.',
    },
  ],
);

export const B_TREE_WAL_GO = chapter(
  'write-ahead-log',
  walTheory,
  WAL_FILES,
  'internal/wal/record.go',
  [
    {
      id: '3.1',
      label: 'Frame a record',
      file: 'internal/wal/record.go',
      summary: 'encode: an 8-byte header (CRC-32C, length) in front of the payload.',
    },
    {
      id: '3.2',
      label: 'Append a batch and fsync',
      file: 'internal/wal/writer.go',
      summary: 'Append: encode the whole batch, one write, fsync under SyncAlways.',
    },
    {
      id: '3.3',
      label: 'Replay to the torn tail',
      file: 'internal/wal/reader.go',
      summary: 'scan: yield intact records with their end offsets; stop at the first bad one.',
    },
    {
      id: '3.4',
      label: 'Recover and commit',
      file: 'internal/db/recover.go',
      summary: 'recoverLog applies committed batches and cuts the log; commit logs before pages.',
    },
  ],
);

export const B_TREE_BUFFER_POOL_GO = chapter(
  'buffer-pool',
  bufferPoolTheory,
  BUFFER_POOL_FILES,
  'internal/buffer/pin.go',
  [
    {
      id: '4.1',
      label: 'Pin and unpin',
      file: 'internal/buffer/pin.go',
      summary: 'pin and Unpin: hit or load into a victim, count pins, remember the LSN of a dirty frame.',
    },
    {
      id: '4.2',
      label: 'Clock eviction',
      file: 'internal/buffer/evict.go',
      summary: 'victim: sweep the hand, skip pinned frames, give referenced frames a second chance.',
    },
    {
      id: '4.3',
      label: 'Flush after the log',
      file: 'internal/buffer/flush.go',
      summary: 'flushFrame: sync the log up to the frame’s LSN first, then write the page.',
    },
  ],
);

export const B_TREE_MUTATIONS_GO = chapter(
  'mutations',
  mutationsTheory,
  MUTATIONS_FILES,
  'internal/btree/delete.go',
  [
    {
      id: '5.1',
      label: 'Delete from a leaf',
      file: 'internal/btree/delete.go',
      summary: 'delete: remove the key from its leaf and report "underfull" up the recursion.',
    },
    {
      id: '5.2',
      label: 'Borrow or merge',
      file: 'internal/btree/delete.go',
      summary: 'rebalance: merge siblings that fit in one page and free one; otherwise redistribute.',
    },
    {
      id: '5.3',
      label: 'Shrink the root',
      file: 'internal/btree/delete.go',
      summary: 'Delete: an empty leaf root empties the tree; a keyless internal root is replaced by its child.',
    },
    {
      id: '5.4',
      label: 'Scan along the leaves',
      file: 'internal/db/scan.go',
      summary: 'Scan: one descent to start, then follow leaf links until end.',
    },
  ],
);
