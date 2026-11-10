/**
 * LSM tree chapters 2–5, C++. Each starter repo is loaded whole from its
 * `cpp/files/` folder; `solution/` folders are never globbed.
 */

import type { ModuleTask, ProjectModuleContent } from './types';
import { LSM_VERIFY_LEAD } from './lsmTreeMinor';
import { theoryForLanguage } from './theoryLanguage';

import walTheory from './minors/lsm-tree/write-ahead-log/theory.md?raw';
import sstableTheory from './minors/lsm-tree/sstable/theory.md?raw';
import readPathTheory from './minors/lsm-tree/read-path/theory.md?raw';
import compactionTheory from './minors/lsm-tree/compaction/theory.md?raw';

type RawFiles = Record<string, string>;

const WAL_FILES = import.meta.glob<string>('./minors/lsm-tree/write-ahead-log/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const SSTABLE_FILES = import.meta.glob<string>('./minors/lsm-tree/sstable/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const READ_PATH_FILES = import.meta.glob<string>('./minors/lsm-tree/read-path/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const COMPACTION_FILES = import.meta.glob<string>('./minors/lsm-tree/compaction/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

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
      if (!(path in repoFiles)) console.error(`lsm-tree/${moduleId}: starter repo has no ${path}`);
    }
  }
  return {
    projectId: 'lsm-tree',
    moduleId,
    language: 'cpp',
    theory: theoryForLanguage(theory, 'cpp'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: VERIFY,
    verifyLead: LSM_VERIFY_LEAD,
  };
}

export const LSM_TREE_WAL_CPP = chapter(
  'write-ahead-log',
  walTheory,
  WAL_FILES,
  'src/wal/record.cc',
  [
    {
      id: '2.1',
      label: 'Frame a record',
      file: 'src/wal/record.cc',
      summary: 'Encode: an 8-byte header (CRC-32C, length) in front of the payload.',
    },
    {
      id: '2.2',
      label: 'Append and fsync',
      file: 'src/wal/writer.cc',
      summary: 'Append: one write per record, fsync under SyncMode::kAlways.',
    },
    {
      id: '2.3',
      label: 'Replay to the torn tail',
      file: 'src/wal/reader.cc',
      summary: 'Replay: yield intact records, stop at the first bad one, report where.',
    },
    {
      id: '2.4',
      label: 'Recover on open',
      file: 'src/db/recover.cc',
      summary: 'RecoverLog replays and cuts the torn tail; Commit logs before it applies.',
    },
  ],
);

export const LSM_TREE_SSTABLE_CPP = chapter(
  'sstable',
  sstableTheory,
  SSTABLE_FILES,
  'src/sstable/build.cc',
  [
    {
      id: '3.1',
      label: 'Fill and cut data blocks',
      file: 'src/sstable/build.cc',
      summary: 'add and flushBlock: entries in key order, one index entry per block.',
    },
    {
      id: '3.2',
      label: 'Index and footer',
      file: 'src/sstable/build.cc',
      summary: 'finish: index block, fixed-size footer, fsync.',
    },
    {
      id: '3.3',
      label: 'One-block lookups',
      file: 'src/sstable/lookup.cc',
      summary: 'OpenFile loads footer and index; get reads exactly one data block.',
    },
    {
      id: '3.4',
      label: 'Flush the memtable',
      file: 'src/db/flush.cc',
      summary: 'flush: write the table, rename it into place, then reset the log.',
    },
  ],
);

export const LSM_TREE_READ_PATH_CPP = chapter(
  'read-path',
  readPathTheory,
  READ_PATH_FILES,
  'src/bloom/bloom.cc',
  [
    {
      id: '4.1',
      label: 'Build a Bloom filter',
      file: 'src/bloom/bloom.cc',
      summary: 'Finish: size the bit array and set k bits per key.',
    },
    {
      id: '4.2',
      label: 'Query a Bloom filter',
      file: 'src/bloom/bloom.cc',
      summary: 'MayContain: any clear bit means the key is definitely absent.',
    },
    {
      id: '4.3',
      label: 'Merge sorted streams',
      file: 'src/iterator/merging.cc',
      summary: 'Less and Next: heap by key then newest, skip older copies.',
    },
    {
      id: '4.4',
      label: 'Range scans',
      file: 'src/db/scan.cc',
      summary: 'Scan: merge newest first, hide tombstones, honor the range.',
    },
  ],
);

export const LSM_TREE_COMPACTION_CPP = chapter(
  'compaction',
  compactionTheory,
  COMPACTION_FILES,
  'src/compaction/compaction.cc',
  [
    {
      id: '5.1',
      label: 'Merge and drop tombstones',
      file: 'src/compaction/compaction.cc',
      summary: 'Merge: newest version of each key; drop tombstones only at the bottom.',
    },
    {
      id: '5.2',
      label: 'Atomic manifest',
      file: 'src/manifest/manifest.cc',
      summary: 'Save: temp file, fsync, rename over MANIFEST, fsync the directory.',
    },
    {
      id: '5.3',
      label: 'Swap tables safely',
      file: 'src/db/compact.cc',
      summary: 'compactRange: write the output, commit the manifest, then delete inputs.',
    },
  ],
);
