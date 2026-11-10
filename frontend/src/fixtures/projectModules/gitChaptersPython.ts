/**
 * Git (tinygit) chapters 1–5, Python. Each starter repo is loaded whole from its
 * `python/files/` folder; `solution/` folders are never globbed, so they stay
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

const OBJECTS_FILES = import.meta.glob<string>('./minors/git/objects/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const REFS_FILES = import.meta.glob<string>('./minors/git/refs/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const INDEX_FILES = import.meta.glob<string>('./minors/git/index/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const COMMIT_CHECKOUT_FILES = import.meta.glob<string>(
  './minors/git/commit-checkout/python/files/**/*',
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
);
const HISTORY_MERGE_FILES = import.meta.glob<string>(
  './minors/git/history-merge/python/files/**/*',
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
      if (!(path in repoFiles)) console.error(`git/${moduleId}: starter repo has no ${path}`);
    }
  }
  return {
    projectId: 'git',
    moduleId,
    language: 'python',
    theory: theoryForLanguage(theory, 'python'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: VERIFY,
    verifyLead: GIT_VERIFY_LEAD,
  };
}

export const GIT_OBJECTS_PYTHON = chapter(
  'objects',
  objectsTheory,
  OBJECTS_FILES,
  'tinygit/object/hash.py',
  [
    {
      id: '1.1',
      label: 'Hash content',
      file: 'tinygit/object/hash.py',
      summary: 'hash_of: SHA-1 of the bytes into a Hash.',
    },
    {
      id: '1.2',
      label: 'Store put and get',
      file: 'tinygit/object/store.py',
      summary: 'put and get: zlib loose objects under objects/aa/bb… with header + content hashing.',
    },
    {
      id: '1.3',
      label: 'Blob put and get',
      file: 'tinygit/object/blob.py',
      summary: 'put_blob and get_blob: type blob wrappers around the store.',
    },
    {
      id: '1.4',
      label: 'Encode and decode trees',
      file: 'tinygit/object/tree.py',
      summary: 'encode_tree and decode_tree: sorted mode/name/hash entries.',
    },
    {
      id: '1.5',
      label: 'Encode and decode commits',
      file: 'tinygit/object/commit.py',
      summary: 'encode_commit and decode_commit: tree, parents, author, message.',
    },
  ],
);

export const GIT_REFS_PYTHON = chapter('refs', refsTheory, REFS_FILES, 'tinygit/ref/ref.py', [
  {
    id: '2.1',
    label: 'Read and write a ref',
    file: 'tinygit/ref/ref.py',
    summary: 'read and write: a ref file holds one commit hash.',
  },
  {
    id: '2.2',
    label: 'Symbolic HEAD',
    file: 'tinygit/ref/head.py',
    summary: 'read_head and resolve_head: symbolic ref or detached hash.',
  },
  {
    id: '2.3',
    label: 'Update-ref',
    file: 'tinygit/ref/update.py',
    summary: 'update_ref: move a ref, optionally compare-and-swap; HEAD follows its branch.',
  },
]);

export const GIT_INDEX_PYTHON = chapter('index', indexTheory, INDEX_FILES, 'tinygit/index/codec.py', [
  {
    id: '3.1',
    label: 'Index codec',
    file: 'tinygit/index/codec.py',
    summary: 'encode and decode: TINYIDX table of path, mode, hash.',
  },
  {
    id: '3.2',
    label: 'Add a file',
    file: 'tinygit/index/add.py',
    summary: 'add: blob the worktree file and stage its path.',
  },
  {
    id: '3.3',
    label: 'Status',
    file: 'tinygit/index/status.py',
    summary: 'status: staged, modified, and untracked against HEAD and the worktree.',
  },
]);

export const GIT_COMMIT_CHECKOUT_PYTHON = chapter(
  'commit-checkout',
  commitCheckoutTheory,
  COMMIT_CHECKOUT_FILES,
  'tinygit/worktree/write_tree.py',
  [
    {
      id: '4.1',
      label: 'Write-tree',
      file: 'tinygit/worktree/write_tree.py',
      summary: 'write_tree: nested trees from the index paths.',
    },
    {
      id: '4.2',
      label: 'Commit',
      file: 'tinygit/worktree/commit.py',
      summary: 'commit: tree + parent + message, then advance HEAD.',
    },
    {
      id: '4.3',
      label: 'Checkout',
      file: 'tinygit/worktree/checkout.py',
      summary: 'checkout: materialize a commit; refuse unsafe overwrites.',
    },
  ],
);

export const GIT_HISTORY_MERGE_PYTHON = chapter(
  'history-merge',
  historyMergeTheory,
  HISTORY_MERGE_FILES,
  'tinygit/diff/log.py',
  [
    {
      id: '5.1',
      label: 'Log walk',
      file: 'tinygit/diff/log.py',
      summary: 'log_walk: first-parent history, newest first.',
    },
    {
      id: '5.2',
      label: 'Tree diff',
      file: 'tinygit/diff/diff.py',
      summary: 'tree_diff: added, modified, and deleted paths between two trees.',
    },
    {
      id: '5.3',
      label: 'Merge-base',
      file: 'tinygit/merge/base.py',
      summary: 'merge_base: a common ancestor of two commits.',
    },
    {
      id: '5.4',
      label: 'Three-way merge',
      file: 'tinygit/merge/merge.py',
      summary: 'merge: fast-forward, clean merge, or conflict markers.',
    },
  ],
);
