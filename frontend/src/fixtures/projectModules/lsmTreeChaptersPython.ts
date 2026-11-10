/**
 * LSM tree chapters 2–5, Python. Each starter repo is loaded whole from its
 * `python/files/` folder; `solution/` folders are never globbed.
 */

import type { ModuleTask, ProjectModuleContent } from './types';
import { LSM_VERIFY_LEAD } from './lsmTreeMinor';
import { theoryForLanguage } from './theoryLanguage';

import walTheory from './minors/lsm-tree/write-ahead-log/theory.md?raw';
import sstableTheory from './minors/lsm-tree/sstable/theory.md?raw';
import readPathTheory from './minors/lsm-tree/read-path/theory.md?raw';
import compactionTheory from './minors/lsm-tree/compaction/theory.md?raw';

type RawFiles = Record<string, string>;

const WAL_FILES = import.meta.glob<string>('./minors/lsm-tree/write-ahead-log/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const SSTABLE_FILES = import.meta.glob<string>('./minors/lsm-tree/sstable/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const READ_PATH_FILES = import.meta.glob<string>('./minors/lsm-tree/read-path/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const COMPACTION_FILES = import.meta.glob<string>('./minors/lsm-tree/compaction/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

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
      if (!(path in repoFiles)) console.error(`lsm-tree/${moduleId}: starter repo has no ${path}`);
    }
  }
  return {
    projectId: 'lsm-tree',
    moduleId,
    language: 'python',
    theory: theoryForLanguage(theory, 'python'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: VERIFY,
    verifyLead: LSM_VERIFY_LEAD,
  };
}

export const LSM_TREE_WAL_PYTHON = chapter(
  'write-ahead-log',
  walTheory,
  WAL_FILES,
  'lsmkv/wal/record.py',
  [
    {
      id: '2.1',
      label: 'Frame a record',
      file: 'lsmkv/wal/record.py',
      summary: 'encode: an 8-byte header (CRC-32C, length) in front of the payload.',
    },
    {
      id: '2.2',
      label: 'Append and fsync',
      file: 'lsmkv/wal/writer.py',
      summary: 'append: one write per record, fsync under SyncMode.ALWAYS.',
    },
    {
      id: '2.3',
      label: 'Replay to the torn tail',
      file: 'lsmkv/wal/reader.py',
      summary: 'replay: yield intact records, stop at the first bad one, report where.',
    },
    {
      id: '2.4',
      label: 'Recover on open',
      file: 'lsmkv/db/recover.py',
      summary: 'recover_log replays and cuts the torn tail; commit logs before it applies.',
    },
  ],
);

export const LSM_TREE_SSTABLE_PYTHON = chapter(
  'sstable',
  sstableTheory,
  SSTABLE_FILES,
  'lsmkv/sstable/build.py',
  [
    {
      id: '3.1',
      label: 'Fill and cut data blocks',
      file: 'lsmkv/sstable/build.py',
      summary: 'add and flush_block: entries in key order, one index entry per block.',
    },
    {
      id: '3.2',
      label: 'Index and footer',
      file: 'lsmkv/sstable/build.py',
      summary: 'finish: index block, fixed-size footer, fsync.',
    },
    {
      id: '3.3',
      label: 'One-block lookups',
      file: 'lsmkv/sstable/lookup.py',
      summary: 'open loads footer and index; get reads exactly one data block.',
    },
    {
      id: '3.4',
      label: 'Flush the memtable',
      file: 'lsmkv/db/flush.py',
      summary: 'flush: write the table, rename it into place, then reset the log.',
    },
  ],
);

export const LSM_TREE_READ_PATH_PYTHON = chapter(
  'read-path',
  readPathTheory,
  READ_PATH_FILES,
  'lsmkv/bloom/bloom.py',
  [
    {
      id: '4.1',
      label: 'Build a Bloom filter',
      file: 'lsmkv/bloom/bloom.py',
      summary: 'finish: size the bit array and set k bits per key.',
    },
    {
      id: '4.2',
      label: 'Query a Bloom filter',
      file: 'lsmkv/bloom/bloom.py',
      summary: 'may_contain: any clear bit means the key is definitely absent.',
    },
    {
      id: '4.3',
      label: 'Merge sorted streams',
      file: 'lsmkv/iterator/merging.py',
      summary: 'Less and next: heap by key then newest, skip older copies.',
    },
    {
      id: '4.4',
      label: 'Range scans',
      file: 'lsmkv/db/scan.py',
      summary: 'scan: merge newest first, hide tombstones, honor the range.',
    },
  ],
);

export const LSM_TREE_COMPACTION_PYTHON = chapter(
  'compaction',
  compactionTheory,
  COMPACTION_FILES,
  'lsmkv/compaction/compaction.py',
  [
    {
      id: '5.1',
      label: 'Merge and drop tombstones',
      file: 'lsmkv/compaction/compaction.py',
      summary: 'Merge: newest version of each key; drop tombstones only at the bottom.',
    },
    {
      id: '5.2',
      label: 'Atomic manifest',
      file: 'lsmkv/manifest/manifest.py',
      summary: 'save: temp file, fsync, rename over MANIFEST, fsync the directory.',
    },
    {
      id: '5.3',
      label: 'Swap tables safely',
      file: 'lsmkv/db/compact.py',
      summary: 'compact_range: write the output, commit the manifest, then delete inputs.',
    },
  ],
);
