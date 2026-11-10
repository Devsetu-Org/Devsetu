/**
 * B-tree chapters 1–5, Python. Each starter repo is loaded whole from
 * its `python/files/` folder; `solution/` folders are never globbed, so they stay
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
const PAGER_FILES = import.meta.glob<string>('./minors/b-tree/pager/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const BTREE_FILES = import.meta.glob<string>('./minors/b-tree/btree/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const WAL_FILES = import.meta.glob<string>('./minors/b-tree/write-ahead-log/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const BUFFER_POOL_FILES = import.meta.glob<string>('./minors/b-tree/buffer-pool/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const MUTATIONS_FILES = import.meta.glob<string>('./minors/b-tree/mutations/python/files/**/*', {
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
      if (!(path in repoFiles)) console.error(`b-tree/${moduleId}: starter repo has no ${path}`);
    }
  }
  return {
    projectId: 'b-tree',
    moduleId,
    language: 'python',
    theory: theoryForLanguage(theory, 'python'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: VERIFY,
    verifyLead: B_TREE_VERIFY_LEAD,
  };
}

export const B_TREE_PAGER_PYTHON = chapter(
  'pager',
  pagerTheory,
  PAGER_FILES,
  'btreekv/pager/readwrite.py',
  [
    {
      id: '1.1',
      label: 'Write a checksummed page',
      file: 'btreekv/pager/readwrite.py',
      summary: 'write_page: copy the page, seal it with a CRC-32C trailer, write it at no * PAGE_SIZE.',
    },
    {
      id: '1.2',
      label: 'Read and verify a page',
      file: 'btreekv/pager/readwrite.py',
      summary: 'read_page: read a whole page, reject a short read, reject a bad checksum.',
    },
    {
      id: '1.3',
      label: 'Allocate a page',
      file: 'btreekv/pager/alloc.py',
      summary: 'allocate: pop the freelist, or grow the file by one blank page.',
    },
    {
      id: '1.4',
      label: 'Free a page',
      file: 'btreekv/pager/alloc.py',
      summary: 'free: write a free page that points at the old head, then make it the head.',
    },
  ],
);

export const B_TREE_BTREE_PYTHON = chapter(
  'btree',
  btreeTheory,
  BTREE_FILES,
  'btreekv/btree/search.py',
  [
    {
      id: '2.1',
      label: 'Search inside a page',
      file: 'btreekv/btree/search.py',
      summary: 'child_index and leaf_index: binary search; a key equal to a separator goes right.',
    },
    {
      id: '2.2',
      label: 'Walk root to leaf',
      file: 'btreekv/btree/search.py',
      summary: 'find_leaf and get: one page per level, from the root down to the leaf.',
    },
    {
      id: '2.3',
      label: 'Insert into a leaf',
      file: 'btreekv/btree/insert.py',
      summary: 'leaf_put: keep keys sorted in step with values; overwrite an existing key.',
    },
    {
      id: '2.4',
      label: 'Split a page',
      file: 'btreekv/btree/insert.py',
      summary: 'split: a leaf copies its separator up, an internal page moves it up.',
    },
    {
      id: '2.5',
      label: 'Push splits up, grow a root',
      file: 'btreekv/btree/insert.py',
      summary: 'insert: recurse down, hand splits to the parent, make a new root.',
    },
  ],
);

export const B_TREE_WAL_PYTHON = chapter(
  'write-ahead-log',
  walTheory,
  WAL_FILES,
  'btreekv/wal/record.py',
  [
    {
      id: '3.1',
      label: 'Frame a record',
      file: 'btreekv/wal/record.py',
      summary: 'encode: an 8-byte header (CRC-32C, length) in front of the payload.',
    },
    {
      id: '3.2',
      label: 'Append a batch and fsync',
      file: 'btreekv/wal/writer.py',
      summary: 'append: encode the whole batch, one write, fsync under SyncAlways.',
    },
    {
      id: '3.3',
      label: 'Replay to the torn tail',
      file: 'btreekv/wal/reader.py',
      summary: 'scan: yield intact records with their end offsets; stop at the first bad one.',
    },
    {
      id: '3.4',
      label: 'Recover and commit',
      file: 'btreekv/db/recover.py',
      summary: 'recover_log applies committed batches and cuts the log; commit logs before pages.',
    },
  ],
);

export const B_TREE_BUFFER_POOL_PYTHON = chapter(
  'buffer-pool',
  bufferPoolTheory,
  BUFFER_POOL_FILES,
  'btreekv/buffer/pin.py',
  [
    {
      id: '4.1',
      label: 'Pin and unpin',
      file: 'btreekv/buffer/pin.py',
      summary: 'pin and unpin: hit or load into a victim, count pins, remember the LSN of a dirty frame.',
    },
    {
      id: '4.2',
      label: 'Clock eviction',
      file: 'btreekv/buffer/evict.py',
      summary: 'victim: sweep the hand, skip pinned frames, give referenced frames a second chance.',
    },
    {
      id: '4.3',
      label: 'Flush after the log',
      file: 'btreekv/buffer/flush.py',
      summary: "flush_frame: sync the log up to the frame's LSN first, then write the page.",
    },
  ],
);

export const B_TREE_MUTATIONS_PYTHON = chapter(
  'mutations',
  mutationsTheory,
  MUTATIONS_FILES,
  'btreekv/btree/delete.py',
  [
    {
      id: '5.1',
      label: 'Delete from a leaf',
      file: 'btreekv/btree/delete.py',
      summary: 'delete: remove the key from its leaf and report "underfull" up the recursion.',
    },
    {
      id: '5.2',
      label: 'Borrow or merge',
      file: 'btreekv/btree/delete.py',
      summary: 'rebalance: merge siblings that fit in one page and free one; otherwise redistribute.',
    },
    {
      id: '5.3',
      label: 'Shrink the root',
      file: 'btreekv/btree/delete.py',
      summary: 'Delete: an empty leaf root empties the tree; a keyless internal root is replaced by its child.',
    },
    {
      id: '5.4',
      label: 'Scan along the leaves',
      file: 'btreekv/db/scan.py',
      summary: 'scan: one descent to start, then follow leaf links until end.',
    },
  ],
);
