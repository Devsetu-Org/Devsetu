/**
 * LSM tree chapters 2–5, Go only for now. Each starter repo is loaded whole
 * from its `go/files/` folder; `solution/` folders are never globbed, so they
 * stay out of the bundle.
 *
 * A task's `file` also marks which files the learner owns: the workspace
 * carries those files into later chapters, so they must be byte-identical in
 * every later starter (see AUTHORING.md).
 */

import type { ModuleTask, ProjectModuleContent } from './types';
import { LSM_VERIFY_LEAD } from './lsmTreeMinor';
import { theoryForLanguage } from './theoryLanguage';

import walTheory from './minors/lsm-tree/write-ahead-log/theory.md?raw';
import sstableTheory from './minors/lsm-tree/sstable/theory.md?raw';
import readPathTheory from './minors/lsm-tree/read-path/theory.md?raw';
import compactionTheory from './minors/lsm-tree/compaction/theory.md?raw';

type RawFiles = Record<string, string>;

// Vite needs the glob options written out literally in each call.
const WAL_FILES = import.meta.glob<string>('./minors/lsm-tree/write-ahead-log/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const SSTABLE_FILES = import.meta.glob<string>('./minors/lsm-tree/sstable/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const READ_PATH_FILES = import.meta.glob<string>('./minors/lsm-tree/read-path/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const COMPACTION_FILES = import.meta.glob<string>('./minors/lsm-tree/compaction/go/files/**/*', {
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
      if (!(path in repoFiles)) console.error(`lsm-tree/${moduleId}: starter repo has no ${path}`);
    }
  }
  return {
    projectId: 'lsm-tree',
    moduleId,
    language: 'go',
    theory: theoryForLanguage(theory, 'go'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: VERIFY,
    verifyLead: LSM_VERIFY_LEAD,
  };
}

export const LSM_TREE_WAL_GO = chapter(
  'write-ahead-log',
  walTheory,
  WAL_FILES,
  'internal/wal/record.go',
  [
    {
      id: '2.1',
      label: 'Frame a record',
      file: 'internal/wal/record.go',
      summary: 'encode: an 8-byte header (CRC-32C, length) in front of the payload.',
    },
    {
      id: '2.2',
      label: 'Append and fsync',
      file: 'internal/wal/writer.go',
      summary: 'Append: one write per record, fsync under SyncAlways.',
    },
    {
      id: '2.3',
      label: 'Replay to the torn tail',
      file: 'internal/wal/reader.go',
      summary: 'Replay: yield intact records, stop at the first bad one, report where.',
    },
    {
      id: '2.4',
      label: 'Recover on open',
      file: 'internal/db/recover.go',
      summary: 'recoverLog replays and cuts the torn tail; commit logs before it applies.',
    },
  ],
);

export const LSM_TREE_SSTABLE_GO = chapter(
  'sstable',
  sstableTheory,
  SSTABLE_FILES,
  'internal/sstable/build.go',
  [
    {
      id: '3.1',
      label: 'Fill and cut data blocks',
      file: 'internal/sstable/build.go',
      summary: 'add and flushBlock: entries in key order, one index entry per block.',
    },
    {
      id: '3.2',
      label: 'Index and footer',
      file: 'internal/sstable/build.go',
      summary: 'finish: index block, fixed-size footer, fsync.',
    },
    {
      id: '3.3',
      label: 'One-block lookups',
      file: 'internal/sstable/lookup.go',
      summary: 'open loads footer and index; get reads exactly one data block.',
    },
    {
      id: '3.4',
      label: 'Flush the memtable',
      file: 'internal/db/flush.go',
      summary: 'flush: write the table, rename it into place, then reset the log.',
    },
  ],
);

export const LSM_TREE_READ_PATH_GO = chapter(
  'read-path',
  readPathTheory,
  READ_PATH_FILES,
  'internal/bloom/bloom.go',
  [
    {
      id: '4.1',
      label: 'Build a Bloom filter',
      file: 'internal/bloom/bloom.go',
      summary: 'Finish: size the bit array and set k bits per key.',
    },
    {
      id: '4.2',
      label: 'Query a Bloom filter',
      file: 'internal/bloom/bloom.go',
      summary: 'MayContain: any clear bit means the key is definitely absent.',
    },
    {
      id: '4.3',
      label: 'Merge sorted streams',
      file: 'internal/iterator/merging.go',
      summary: 'Less and Next: heap by key then newest, skip older copies.',
    },
    {
      id: '4.4',
      label: 'Range scans',
      file: 'internal/db/scan.go',
      summary: 'Scan: merge newest first, hide tombstones, honor the range.',
    },
  ],
);

export const LSM_TREE_COMPACTION_GO = chapter(
  'compaction',
  compactionTheory,
  COMPACTION_FILES,
  'internal/compaction/compaction.go',
  [
    {
      id: '5.1',
      label: 'Merge and drop tombstones',
      file: 'internal/compaction/compaction.go',
      summary: 'Merge: newest version of each key; drop tombstones only at the bottom.',
    },
    {
      id: '5.2',
      label: 'Atomic manifest',
      file: 'internal/manifest/manifest.go',
      summary: 'Save: temp file, fsync, rename over MANIFEST, fsync the directory.',
    },
    {
      id: '5.3',
      label: 'Swap tables safely',
      file: 'internal/db/compact.go',
      summary: 'compactRange: write the output, commit the manifest, then delete inputs.',
    },
  ],
);
