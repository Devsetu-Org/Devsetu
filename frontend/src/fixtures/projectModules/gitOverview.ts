import type { ChapterReading } from './types';

/** Git minor, chapter 00: content-addressed snapshots and the plan. */
export const GIT_OVERVIEW: ChapterReading = {
  eyebrow: 'Git · Chapter 00',
  title: 'Git: history as a graph of hashed snapshots',
  lede:
    'Start here before writing any code. We look at **what Git actually stores**, why every version is a hash, how commits form a DAG, and exactly what you will build across the five chapters of this minor.',
  showBlogStamp: true,
  sections: [
    {
      id: 'what-it-is',
      title: 'What Git is',
      body: [
        'Git is not a list of patches. It is a **content-addressed object store** plus a few names that point into it. Every file version is a blob. Every directory listing is a tree of hashes. Every commit points at one tree and at zero or more parent commits.',
        'Change a file, stage it, commit: you add objects. Old objects stay. Branches are movable names for commits. That is why Git can jump between versions without replaying a long patch chain.',
      ],
      subsections: [
        {
          id: 'content-addressed',
          title: 'Content addressing',
          body: [
            'Hash the bytes, store them under that hash. The same content is always the same object. Two commits that share an unchanged file share one blob. Corruption or a wrong write fails the hash check when you read it back.',
          ],
        },
        {
          id: 'not-a-backup',
          title: 'This minor stays local',
          body: [
            'No remotes, no packfiles, no rebase, no hooks. One repository directory, loose objects, one worktree, one index. That keeps the work on the object model and the merge, which is where the ideas live.',
          ],
        },
      ],
      callout: {
        kind: 'idea',
        title: 'Three object types',
        body: [
          '**Blob** — file bytes. **Tree** — sorted entries of `(mode, name, hash)`. **Commit** — tree hash, parents, author line, message. Everything else (branches, HEAD, the index) is a pointer or a cache on top.',
        ],
      },
    },
    {
      id: 'pipeline',
      title: 'From edit to commit',
      body: ['Follow one change through the pieces you will build.'],
      code: {
        language: 'plaintext',
        filename: 'a commit',
        code: [
          '  worktree/hello.txt  →  blob  (hash of file bytes)',
          '  index               →  stages path → blob hash',
          '  write-tree          →  tree (paths + blob hashes)',
          '  commit              →  commit (tree + parent + message)',
          '  refs/heads/main     →  points at that commit',
        ].join('\n'),
      },
      flows: [
        {
          title: 'Store',
          steps: ['Bytes', 'Hash', 'zlib object', 'objects/ab/cd…'],
        },
        {
          title: 'Names',
          steps: ['Index', 'write-tree', 'commit', 'update-ref'],
        },
      ],
      after: [
        '**Objects.** Hash and store. `cat-file` reads them back.',
        '**Refs.** `main` is a file with a commit hash. `HEAD` either names a branch or holds a raw hash (detached).',
        '**Index.** The staging area: which paths will go into the next tree.',
        '**Checkout.** Materialize a tree into the worktree. Refuse to overwrite uncommitted edits that would be lost.',
        '**Merge.** Find a common base, compare both tips to it, write one result or conflict markers.',
      ],
    },
    {
      id: 'what-you-build',
      title: 'What you will build in this minor',
      body: [
        'Over five chapters you build **tinygit**, a small Git in Go, Python, or C++. Commands mirror the real ones enough that the mental model transfers. Tests feed repositories and check objects, refs, and worktree files.',
      ],
      table: {
        headers: ['Chapter', 'You build', 'Done when'],
        rows: [
          [
            '**01 · Objects**',
            'Hash, zlib store, blob / tree / commit encode and decode',
            '`hash-object` and `cat-file` round-trip fixed fixtures',
          ],
          [
            '**02 · Refs**',
            'HEAD, branch refs, update-ref',
            'Create and move branch tips; symbolic HEAD resolves',
          ],
          [
            '**03 · Index**',
            'Staging format, add, status',
            'Staged / modified / untracked match a fixture',
          ],
          [
            '**04 · Commit and checkout**',
            'write-tree, commit, checkout',
            'Commit then checkout restores the tree',
          ],
          [
            '**05 · History and merge**',
            'log, tree diff, three-way merge',
            'FF, clean merge, and conflict fixtures all match',
          ],
          [
            '**06 · Benchmark** (coming soon)',
            'Your tinygit against the reference on the same repos',
            'Answers match, then you see how the time compares',
          ],
        ],
      },
    },
    {
      id: 'how-chapters-work',
      title: 'How each chapter works',
      body: [],
      bullets: [
        '**Theory on the left, code on the right.** Each chapter opens with a short read, then sends you into the repository with clearly marked `TODO` blocks.',
        '**Small tasks.** A chapter has a few tasks, and each turns green as you finish it.',
        '**Tests decide.** When `make test` passes, the chapter is complete.',
        '**Your code carries forward.** Each chapter starts from your own earlier work, with an opt-in reference solution if you get stuck.',
      ],
      after: [
        '**What you need:** comfortable in the language you pick (Go, Python, or C++). No prior Git internals. Every idea is introduced when it is needed.',
      ],
      callout: {
        kind: 'scope',
        title: 'Deliberately left out',
        body: [
          'Remotes, packfiles, delta compression, rebase, cherry-pick, submodules, hooks, and rename detection. Real Git has those. This minor builds the object model and the merge they all sit on.',
        ],
      },
    },
  ],
  takeaways: [
    'Git stores snapshots addressed by hash, not a linear list of patches.',
    'Blob, tree, and commit are the three object types that matter for day-to-day history.',
    'Branches and HEAD are names. The objects do not move when a branch does.',
    'The index is the next commit, half-built. Checkout and merge both write the worktree carefully.',
    'A three-way merge compares both tips to a shared base; conflicts are when both sides changed the same path.',
  ],
};
