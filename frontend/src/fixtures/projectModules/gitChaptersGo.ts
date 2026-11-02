/**
 * Git (tinygit) chapters 1–5, Go only for now. Each starter repo is loaded whole
 * from its `go/files/` folder; `solution/` folders are never globbed, so they
 * stay out of the bundle.
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

// Vite needs the glob options written out literally in each call.
const OBJECTS_FILES = import.meta.glob<string>('./minors/git/objects/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const REFS_FILES = import.meta.glob<string>('./minors/git/refs/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const INDEX_FILES = import.meta.glob<string>('./minors/git/index/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const COMMIT_CHECKOUT_FILES = import.meta.glob<string>(
  './minors/git/commit-checkout/go/files/**/*',
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
);
const HISTORY_MERGE_FILES = import.meta.glob<string>(
  './minors/git/history-merge/go/files/**/*',
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
      if (!(path in repoFiles)) console.error(`git/${moduleId}: starter repo has no ${path}`);
    }
  }
  return {
    projectId: 'git',
    moduleId,
    language: 'go',
    theory: theoryForLanguage(theory, 'go'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: VERIFY,
    verifyLead: GIT_VERIFY_LEAD,
  };
}

export const GIT_OBJECTS_GO = chapter('objects', objectsTheory, OBJECTS_FILES, 'internal/object/hash.go', [
  {
    id: '1.1',
    label: 'Hash content',
    file: 'internal/object/hash.go',
    summary: 'HashOf: SHA-1 of the bytes into a Hash.',
  },
  {
    id: '1.2',
    label: 'Store put and get',
    file: 'internal/object/store.go',
    summary: 'Put and Get: zlib loose objects under objects/aa/bb… with header + content hashing.',
  },
  {
    id: '1.3',
    label: 'Blob put and get',
    file: 'internal/object/blob.go',
    summary: 'PutBlob and GetBlob: type blob wrappers around the store.',
  },
  {
    id: '1.4',
    label: 'Encode and decode trees',
    file: 'internal/object/tree.go',
    summary: 'EncodeTree and DecodeTree: sorted mode/name/hash entries.',
  },
  {
    id: '1.5',
    label: 'Encode and decode commits',
    file: 'internal/object/commit.go',
    summary: 'EncodeCommit and DecodeCommit: tree, parents, author, message.',
  },
]);

export const GIT_REFS_GO = chapter('refs', refsTheory, REFS_FILES, 'internal/ref/ref.go', [
  {
    id: '2.1',
    label: 'Read and write a ref',
    file: 'internal/ref/ref.go',
    summary: 'Read and Write: a ref file holds one commit hash.',
  },
  {
    id: '2.2',
    label: 'Symbolic HEAD',
    file: 'internal/ref/head.go',
    summary: 'ReadHEAD and ResolveHEAD: symbolic ref or detached hash.',
  },
  {
    id: '2.3',
    label: 'Update-ref',
    file: 'internal/ref/update.go',
    summary: 'UpdateRef: move a ref, optionally compare-and-swap; HEAD follows its branch.',
  },
]);

export const GIT_INDEX_GO = chapter('index', indexTheory, INDEX_FILES, 'internal/index/codec.go', [
  {
    id: '3.1',
    label: 'Index codec',
    file: 'internal/index/codec.go',
    summary: 'Encode and Decode: TINYIDX table of path, mode, hash.',
  },
  {
    id: '3.2',
    label: 'Add a file',
    file: 'internal/index/add.go',
    summary: 'Add: blob the worktree file and stage its path.',
  },
  {
    id: '3.3',
    label: 'Status',
    file: 'internal/index/status.go',
    summary: 'Status: staged, modified, and untracked against HEAD and the worktree.',
  },
]);

export const GIT_COMMIT_CHECKOUT_GO = chapter(
  'commit-checkout',
  commitCheckoutTheory,
  COMMIT_CHECKOUT_FILES,
  'internal/worktree/write_tree.go',
  [
    {
      id: '4.1',
      label: 'Write-tree',
      file: 'internal/worktree/write_tree.go',
      summary: 'WriteTree: nested trees from the index paths.',
    },
    {
      id: '4.2',
      label: 'Commit',
      file: 'internal/worktree/commit.go',
      summary: 'Commit: tree + parent + message, then advance HEAD.',
    },
    {
      id: '4.3',
      label: 'Checkout',
      file: 'internal/worktree/checkout.go',
      summary: 'Checkout: materialize a commit; refuse unsafe overwrites.',
    },
  ],
);

export const GIT_HISTORY_MERGE_GO = chapter(
  'history-merge',
  historyMergeTheory,
  HISTORY_MERGE_FILES,
  'internal/diff/log.go',
  [
    {
      id: '5.1',
      label: 'Log walk',
      file: 'internal/diff/log.go',
      summary: 'LogWalk: first-parent history, newest first.',
    },
    {
      id: '5.2',
      label: 'Tree diff',
      file: 'internal/diff/diff.go',
      summary: 'TreeDiff: added, modified, and deleted paths between two trees.',
    },
    {
      id: '5.3',
      label: 'Merge-base',
      file: 'internal/merge/base.go',
      summary: 'MergeBase: a common ancestor of two commits.',
    },
    {
      id: '5.4',
      label: 'Three-way merge',
      file: 'internal/merge/merge.go',
      summary: 'Merge: fast-forward, clean merge, or conflict markers.',
    },
  ],
);
