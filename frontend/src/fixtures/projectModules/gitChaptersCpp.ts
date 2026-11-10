/**
 * Git (tinygit) chapters 1–5, C++. Each starter repo is loaded whole from its
 * `cpp/files/` folder; `solution/` folders are never globbed, so they stay
 * out of the bundle.
 *
 * A task's `file` also marks which files the learner owns: the workspace
 * carries those files into later chapters, so they must be byte-identical in
 * every later starter (see minors/git/AUTHORING.md).
 */

import type { ModuleTask, ProjectModuleContent } from './types';
import { GIT_VERIFY_LEAD } from './gitMinor';
import { theoryForLanguage } from './theoryLanguage';

import objectsTheory from './minors/git/objects/theory.md?raw';
import refsTheory from './minors/git/refs/theory.md?raw';
import indexTheory from './minors/git/index/theory.md?raw';
import commitCheckoutTheory from './minors/git/commit-checkout/theory.md?raw';
import historyMergeTheory from './minors/git/history-merge/theory.md?raw';

type RawFiles = Record<string, string>;

const OBJECTS_FILES = import.meta.glob<string>('./minors/git/objects/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const REFS_FILES = import.meta.glob<string>('./minors/git/refs/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const INDEX_FILES = import.meta.glob<string>('./minors/git/index/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const COMMIT_CHECKOUT_FILES = import.meta.glob<string>(
  './minors/git/commit-checkout/cpp/files/**/*',
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
);
const HISTORY_MERGE_FILES = import.meta.glob<string>(
  './minors/git/history-merge/cpp/files/**/*',
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
);

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
      if (!(path in repoFiles)) console.error(`git/${moduleId}: starter repo has no ${path}`);
    }
  }
  return {
    projectId: 'git',
    moduleId,
    language: 'cpp',
    theory: theoryForLanguage(theory, 'cpp'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: VERIFY,
    verifyLead: GIT_VERIFY_LEAD,
  };
}

export const GIT_OBJECTS_CPP = chapter('objects', objectsTheory, OBJECTS_FILES, 'src/object/hash.cc', [
  {
    id: '1.1',
    label: 'Hash content',
    file: 'src/object/hash.cc',
    summary: 'HashOf: SHA-1 of the bytes into a Hash.',
  },
  {
    id: '1.2',
    label: 'Store put and get',
    file: 'src/object/store.cc',
    summary: 'Put and Get: zlib loose objects under objects/aa/bb… with header + content hashing.',
  },
  {
    id: '1.3',
    label: 'Blob put and get',
    file: 'src/object/blob.cc',
    summary: 'PutBlob and GetBlob: type blob wrappers around the store.',
  },
  {
    id: '1.4',
    label: 'Encode and decode trees',
    file: 'src/object/tree.cc',
    summary: 'EncodeTree and DecodeTree: sorted mode/name/hash entries.',
  },
  {
    id: '1.5',
    label: 'Encode and decode commits',
    file: 'src/object/commit.cc',
    summary: 'EncodeCommit and DecodeCommit: tree, parents, author, message.',
  },
]);

export const GIT_REFS_CPP = chapter('refs', refsTheory, REFS_FILES, 'src/ref/ref.cc', [
  {
    id: '2.1',
    label: 'Read and write a ref',
    file: 'src/ref/ref.cc',
    summary: 'ReadRef and WriteRef: a ref file holds one commit hash.',
  },
  {
    id: '2.2',
    label: 'Symbolic HEAD',
    file: 'src/ref/head.cc',
    summary: 'ReadHEAD and ResolveHEAD: symbolic ref or detached hash.',
  },
  {
    id: '2.3',
    label: 'Update-ref',
    file: 'src/ref/update.cc',
    summary: 'UpdateRef: move a ref, optionally compare-and-swap; HEAD follows its branch.',
  },
]);

export const GIT_INDEX_CPP = chapter('index', indexTheory, INDEX_FILES, 'src/index/codec.cc', [
  {
    id: '3.1',
    label: 'Index codec',
    file: 'src/index/codec.cc',
    summary: 'EncodeIndex and DecodeIndex: TINYIDX table of path, mode, hash.',
  },
  {
    id: '3.2',
    label: 'Add a file',
    file: 'src/index/add.cc',
    summary: 'Add: blob the worktree file and stage its path.',
  },
  {
    id: '3.3',
    label: 'Status',
    file: 'src/index/status.cc',
    summary: 'Status: staged, modified, and untracked against HEAD and the worktree.',
  },
]);

export const GIT_COMMIT_CHECKOUT_CPP = chapter(
  'commit-checkout',
  commitCheckoutTheory,
  COMMIT_CHECKOUT_FILES,
  'src/worktree/write_tree.cc',
  [
    {
      id: '4.1',
      label: 'Write-tree',
      file: 'src/worktree/write_tree.cc',
      summary: 'WriteTree: nested trees from the index paths.',
    },
    {
      id: '4.2',
      label: 'Commit',
      file: 'src/worktree/commit.cc',
      summary: 'CommitWorktree: tree + parent + message, then advance HEAD.',
    },
    {
      id: '4.3',
      label: 'Checkout',
      file: 'src/worktree/checkout.cc',
      summary: 'Checkout: materialize a commit; refuse unsafe overwrites.',
    },
  ],
);

export const GIT_HISTORY_MERGE_CPP = chapter(
  'history-merge',
  historyMergeTheory,
  HISTORY_MERGE_FILES,
  'src/diff/log.cc',
  [
    {
      id: '5.1',
      label: 'Log walk',
      file: 'src/diff/log.cc',
      summary: 'LogWalk: first-parent history, newest first.',
    },
    {
      id: '5.2',
      label: 'Tree diff',
      file: 'src/diff/diff.cc',
      summary: 'TreeDiff: added, modified, and deleted paths between two trees.',
    },
    {
      id: '5.3',
      label: 'Merge-base',
      file: 'src/merge/base.cc',
      summary: 'MergeBase: a common ancestor of two commits.',
    },
    {
      id: '5.4',
      label: 'Three-way merge',
      file: 'src/merge/merge.cc',
      summary: 'Merge: fast-forward, clean merge, or conflict markers.',
    },
  ],
);
