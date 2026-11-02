/** Minors — small independent builds. A major may point at one; the reverse is not required. */

import type { LanguageId } from './languages';
import type { ProjectModule } from './projects';

export const MINORS_PATH = '/minors';

export interface MinorEntry {
  id: string;
  name: string;
  subtitle: string;
  blurb: string;
  about: string[];
  language?: string;
  facts: string[];
  status: 'ready' | 'planned';
  /**
   * Chaptered minors list their chapters here and open on a chapter list, like a
   * major. Minors without chapters open straight into one workspace.
   */
  chapters?: ProjectModule[];
  /**
   * Languages the build chapters are authored in, default first. Learners pick
   * one on the chapter list; each language keeps its own saved progress.
   */
  languages?: LanguageId[];
}

const B_TREE_CHAPTERS: ProjectModule[] = [
  {
    id: 'overview',
    label: 'Overview',
    subtitle: 'What a B-tree engine is, where it runs, and what you will build',
    blurb:
      'Why databases update pages in place, how a B+ tree stays balanced, which systems run on one, and the five chapters ahead.',
    status: 'ready',
    kind: 'reading',
  },
  {
    id: 'pager',
    label: 'Pager',
    subtitle: 'Fixed-size pages, a freelist, and durable page I/O',
    blurb:
      'The file is an array of pages. Allocate, free, read, and write them. Everything above this chapter talks in page numbers, not byte offsets.',
    status: 'ready',
  },
  {
    id: 'btree',
    label: 'B+ tree',
    subtitle: 'Search, insert, and split over the pager',
    blurb:
      'Internal pages hold separators; leaves hold keys and values and link sideways. Inserts split a full page and push a separator up.',
    status: 'ready',
  },
  {
    id: 'write-ahead-log',
    label: 'Write-ahead log',
    subtitle: 'Log the change before the page is durable',
    blurb:
      'Checksummed records, an fsync policy, and recovery that brings every dirty page back after a crash. Kill the process mid-write and lose nothing acknowledged.',
    status: 'ready',
  },
  {
    id: 'buffer-pool',
    label: 'Buffer pool',
    subtitle: 'Pin, unpin, evict, and flush dirty pages',
    blurb:
      'A fixed set of frames caches hot pages. The clock hand evicts cold ones; dirty pages hit the log and the pager before they leave.',
    status: 'ready',
  },
  {
    id: 'mutations',
    label: 'Mutations',
    subtitle: 'Delete, merge, and range scans',
    blurb:
      'Deletes may underflow a leaf: borrow from a sibling or merge and pull a separator down. Scans walk leaf links. The public Put / Get / Delete / Scan API is complete.',
    status: 'ready',
  },
  {
    id: 'benchmark',
    label: 'Benchmark',
    subtitle: 'Your engine against the reference, on the same machines and data',
    blurb:
      'Tune or rework your engine, then run it side by side with ours on identical hardware and workloads. Scored as a ratio to the reference.',
    status: 'planned',
  },
];

const LSM_TREE_CHAPTERS: ProjectModule[] = [
  {
    id: 'overview',
    label: 'Overview',
    subtitle: 'What an LSM tree is, where it runs, and what you will build',
    blurb:
      'Why databases buffer writes and merge sorted files instead of updating in place, which systems run on LSM trees, and the five chapters ahead.',
    status: 'ready',
    kind: 'reading',
  },
  {
    id: 'memtable',
    label: 'Memtable',
    subtitle: 'A skiplist, tombstones, and ordered scans',
    blurb:
      'The sorted in-memory buffer every write lands in. Deletes are writes, and a lookup answers found, deleted, or missing.',
    status: 'ready',
  },
  {
    id: 'write-ahead-log',
    label: 'Write-ahead log',
    subtitle: 'Append before acknowledging, replay on open',
    blurb:
      'Checksummed records, an fsync policy, and a torn tail truncated on recovery. Kill the process mid-write and lose nothing acknowledged.',
    status: 'ready',
  },
  {
    id: 'sstable',
    label: 'SSTable',
    subtitle: 'Flush the memtable to a sorted, immutable file',
    blurb:
      'Data blocks, an index block, and a checksummed footer. A point lookup reads one block, not the whole file.',
    status: 'ready',
  },
  {
    id: 'read-path',
    label: 'Read path',
    subtitle: 'Bloom filters and newest-first search',
    blurb:
      'Memtable first, then tables from newest to oldest. Bloom filters skip files that cannot hold the key; a merging iterator serves range scans.',
    status: 'ready',
  },
  {
    id: 'compaction',
    label: 'Compaction',
    subtitle: 'Merge tables, drop dead versions',
    blurb:
      'A k-way merge keeps the newest version of each key, drops tombstones with nothing left to hide, and swaps files atomically through a manifest.',
    status: 'ready',
  },
  {
    id: 'benchmark',
    label: 'Benchmark',
    subtitle: 'Your engine against the reference, on the same machines and data',
    blurb:
      'Tune or rework your engine, then run it side by side with ours on identical hardware and workloads, including a slice of real production traffic. Scored as a ratio to the reference.',
    status: 'planned',
  },
];

const QUERY_ENGINE_CHAPTERS: ProjectModule[] = [
  {
    id: 'overview',
    label: 'Overview',
    subtitle: 'How a SQL engine turns text into rows',
    blurb:
      'What a query engine is, how SELECT becomes a plan, which systems do this, and the five chapters ahead.',
    status: 'ready',
    kind: 'reading',
  },
  {
    id: 'lexer',
    label: 'Lexer',
    subtitle: 'Turn SQL text into tokens',
    blurb:
      'Keywords, identifiers, numbers, strings, and operators. The rest of the engine never sees raw characters.',
    status: 'ready',
  },
  {
    id: 'parser',
    label: 'Parser',
    subtitle: 'A SELECT statement as a tree',
    blurb:
      'Recursive descent builds an AST: target list, FROM, WHERE, and the comparison and AND expressions inside it.',
    status: 'ready',
  },
  {
    id: 'catalog',
    label: 'Catalog',
    subtitle: 'CREATE TABLE, INSERT, and typed rows',
    blurb:
      'Tables live in memory with a fixed schema. INT and TEXT columns, inserts that reject the wrong shape.',
    status: 'ready',
  },
  {
    id: 'execute',
    label: 'Execute',
    subtitle: 'Scan, filter, and project',
    blurb:
      'A sequential scan feeds a WHERE filter and a projection. SELECT name FROM users WHERE id = 1 returns rows.',
    status: 'ready',
  },
  {
    id: 'relational',
    label: 'Joins and aggregates',
    subtitle: 'JOIN, GROUP BY, ORDER BY, LIMIT',
    blurb:
      'Nested-loop inner joins, COUNT and SUM, grouping, a sort, and a limit. One pipeline, still no indexes.',
    status: 'ready',
  },
  {
    id: 'benchmark',
    label: 'Benchmark',
    subtitle: 'Your engine against the reference, on the same queries',
    blurb:
      'Run a fixed set of queries and data. Correct answers first, then time versus the reference.',
    status: 'planned',
  },
];

const GIT_CHAPTERS: ProjectModule[] = [
  {
    id: 'overview',
    label: 'Overview',
    subtitle: 'How Git stores history as a graph of snapshots',
    blurb:
      'Content-addressed objects, trees, commits, refs, and the five chapters ahead.',
    status: 'ready',
    kind: 'reading',
  },
  {
    id: 'objects',
    label: 'Objects',
    subtitle: 'Blobs, trees, commits, and a hash store',
    blurb:
      'Hash content, zlib-compress it, and store it under objects/ab/…. Round-trip hash-object and cat-file.',
    status: 'ready',
  },
  {
    id: 'refs',
    label: 'Refs',
    subtitle: 'HEAD, branches, and update-ref',
    blurb:
      'A ref is a name for a commit. HEAD is symbolic or detached. Switching branches moves a pointer, not the objects.',
    status: 'ready',
  },
  {
    id: 'index',
    label: 'Index',
    subtitle: 'The staging area between the worktree and a commit',
    blurb:
      'add stages blob hashes by path. status reports staged, modified, and untracked paths against HEAD and the worktree.',
    status: 'ready',
  },
  {
    id: 'commit-checkout',
    label: 'Commit and checkout',
    subtitle: 'Snapshots in, worktree out',
    blurb:
      'write-tree and commit turn the index into a commit. checkout materializes a tree into the worktree without clobbering local edits unsafely.',
    status: 'ready',
  },
  {
    id: 'history-merge',
    label: 'History and merge',
    subtitle: 'log, diff, and a three-way merge',
    blurb:
      'Walk parents for log. Diff two trees. Merge finds a base and combines tips, writing conflict markers when both sides changed the same path.',
    status: 'ready',
  },
  {
    id: 'benchmark',
    label: 'Benchmark',
    subtitle: 'Your git against the reference on the same repos',
    blurb:
      'Object walks, checkout, and merges on fixed fixtures. Correct answers first, then time versus the reference.',
    status: 'planned',
  },
];

const SHELL_CHAPTERS: ProjectModule[] = [
  {
    id: 'overview',
    label: 'Overview',
    subtitle: 'How a shell turns a line into processes',
    blurb:
      'Tokens, argv, pipes, redirection, and the five chapters ahead.',
    status: 'ready',
    kind: 'reading',
  },
  {
    id: 'lexer',
    label: 'Lexer',
    subtitle: 'Quotes, escapes, and tokens',
    blurb:
      'Split a line into words and operators. Single and double quotes, backslash escapes, and the pipe and redirect tokens.',
    status: 'ready',
  },
  {
    id: 'exec',
    label: 'Exec',
    subtitle: 'Run a simple command',
    blurb:
      'Look up a program on PATH, start it with argv, wait for it, and return its exit status. Builtins: cd and exit.',
    status: 'ready',
  },
  {
    id: 'redirects',
    label: 'Redirects',
    subtitle: '>, >>, <, and 2>',
    blurb:
      'Open files and wire them to stdin, stdout, or stderr before the child starts. Append versus truncate.',
    status: 'ready',
  },
  {
    id: 'pipes',
    label: 'Pipes',
    subtitle: 'a | b | c',
    blurb:
      'Connect stdout of one process to stdin of the next. Pipeline exit status follows the last command.',
    status: 'ready',
  },
  {
    id: 'jobs',
    label: 'Jobs',
    subtitle: 'Background and wait',
    blurb:
      'Trailing & starts a job without waiting. wait reaps it. A simple Ctrl-C story for the foreground pipeline.',
    status: 'ready',
  },
  {
    id: 'benchmark',
    label: 'Benchmark',
    subtitle: 'Your shell against the reference on the same scripts',
    blurb:
      'Gold scripts compare stdout, stderr, and exit status. Then time a fixed suite versus the reference.',
    status: 'planned',
  },
];

const SEARCH_CHAPTERS: ProjectModule[] = [
  {
    id: 'overview',
    label: 'Overview',
    subtitle: 'How search turns documents into ranked hits',
    blurb:
      'Tokens, postings, segments, queries, ranking, and the five chapters ahead.',
    status: 'ready',
    kind: 'reading',
  },
  {
    id: 'analyze',
    label: 'Analyze',
    subtitle: 'Text to tokens',
    blurb:
      'Lowercase, split on non-letters, drop stopwords. The rest of the index never sees raw prose.',
    status: 'ready',
  },
  {
    id: 'postings',
    label: 'Postings',
    subtitle: 'Term to document lists',
    blurb:
      'A posting is (docId, frequency). Build an in-memory map, then write a sorted on-disk segment.',
    status: 'ready',
  },
  {
    id: 'index',
    label: 'Index',
    subtitle: 'Add documents and flush segments',
    blurb:
      'Assign doc ids, keep a catalog of segments, flush when a threshold hits. Open an index from a directory.',
    status: 'ready',
  },
  {
    id: 'query',
    label: 'Query',
    subtitle: 'Boolean retrieval',
    blurb:
      'AND and OR over posting lists. Intersect and union keep doc ids sorted. Phrase matching is out of scope.',
    status: 'ready',
  },
  {
    id: 'rank',
    label: 'Rank',
    subtitle: 'BM25 over one collection',
    blurb:
      'Score each hit with BM25, sort descending, and return the top k. Ties break on doc id.',
    status: 'ready',
  },
  {
    id: 'benchmark',
    label: 'Benchmark',
    subtitle: 'Your index against the reference on the same corpus',
    blurb:
      'Fixed documents and queries. Correct hit sets and order first, then time versus the reference.',
    status: 'planned',
  },
];

const CONSENSUS_CHAPTERS: ProjectModule[] = [
  {
    id: 'overview',
    label: 'Overview',
    subtitle: 'What consensus is, where Raft runs, and what you will build',
    blurb:
      'Why replicated systems need agreement, how Raft elects a leader and replicates a log, and the five chapters ahead.',
    status: 'ready',
    kind: 'reading',
  },
  {
    id: 'election',
    label: 'Election',
    subtitle: 'Terms, votes, and becoming leader',
    blurb:
      'Followers time out, become candidates, and RequestVote. A majority makes a leader; a higher term makes everyone step down.',
    status: 'ready',
  },
  {
    id: 'replication',
    label: 'Replication',
    subtitle: 'AppendEntries and keeping logs aligned',
    blurb:
      'The leader pushes log entries to followers. Matching indices and conflict resolution keep every replica’s log a prefix of the leader’s.',
    status: 'ready',
  },
  {
    id: 'commit',
    label: 'Commit',
    subtitle: 'Majority ack, commitIndex, and apply',
    blurb:
      'An entry is committed once a majority has it. Nodes advance commitIndex and apply entries to a state machine in order.',
    status: 'ready',
  },
  {
    id: 'persistence',
    label: 'Persistence',
    subtitle: 'Durable log, term, and votedFor',
    blurb:
      'Crash mid-term and come back with the same vote and log. Replay rebuilds in-memory state; nothing acknowledged is lost.',
    status: 'ready',
  },
  {
    id: 'clients',
    label: 'Clients',
    subtitle: 'A replicated key/value API',
    blurb:
      'Clients talk to the leader. Puts and deletes become log entries; gets read the applied state. Redirects when you hit a follower.',
    status: 'ready',
  },
  {
    id: 'benchmark',
    label: 'Benchmark',
    subtitle: 'Your cluster against the reference, under partitions',
    blurb:
      'Run the same workload and fault schedule against your Raft and ours. Correctness first, then throughput and failover time.',
    status: 'planned',
  },
];

export const MINORS: MinorEntry[] = [
  {
    id: 'git',
    name: 'Git',
    subtitle: 'Building a tiny Git',
    blurb:
      'Content-addressed blobs and trees, a staging index, commits that form a DAG, then log, diff, and a three-way merge.',
    about: [
      'Git stores every version of every file as a hashed object. Directories are trees of those hashes. A commit points at a tree and at parent commits, so history is a graph of snapshots, not a list of patches.',
      'You build tinygit: init, hash-object, cat-file, add, status, commit, checkout, log, diff, and merge. Loose objects only. No remotes, no packfiles, no rebase. Each chapter ends with tests that prove that piece works.',
    ],
    language: 'Go',
    facts: [
      'Objects',
      'Index',
      'Merge',
      `${GIT_CHAPTERS.filter((c) => c.kind !== 'reading').length} chapters`,
    ],
    status: 'planned',
    chapters: GIT_CHAPTERS,
    languages: ['go'],
  },
  {
    id: 'shell',
    name: 'Shell',
    subtitle: 'Building a Unix shell',
    blurb:
      'Tokenize a line, run a program, wire redirects and pipes, then background jobs and wait.',
    about: [
      'A shell is a small language that starts processes. Words become argv. Operators open files or connect pipes. The hard part is getting the file descriptors right before the child runs.',
      'You build tinysh: a lexer with quotes, exec with PATH and builtins, redirects, pipelines, and a light jobs chapter. Gold scripts compare stdout, stderr, and exit status to a fixed reference. No job-control TTY full story, no functions, no $(…).',
    ],
    language: 'Go',
    facts: [
      'Lexer',
      'Pipes',
      'Jobs',
      `${SHELL_CHAPTERS.filter((c) => c.kind !== 'reading').length} chapters`,
    ],
    status: 'planned',
    chapters: SHELL_CHAPTERS,
    languages: ['go'],
  },
  {
    id: 'search-index',
    name: 'Search index',
    subtitle: 'Building a full-text index',
    blurb:
      'Analyze text into tokens, write posting lists, flush segments, answer boolean queries, and rank with BM25.',
    about: [
      'Search is not SQL. Documents become tokens; tokens become sorted lists of document ids; a query walks those lists and ranks the survivors.',
      'You build findx: an analyzer, on-disk postings segments, an index that flushes, boolean AND/OR retrieval, and BM25 ranking. No phrase queries, no positional index, no distributed shards. Each chapter ends with tests that prove that piece works.',
    ],
    language: 'Go',
    facts: [
      'Postings',
      'BM25',
      'Segments',
      `${SEARCH_CHAPTERS.filter((c) => c.kind !== 'reading').length} chapters`,
    ],
    status: 'planned',
    chapters: SEARCH_CHAPTERS,
    languages: ['go'],
  },
  {
    id: 'query-engine',
    name: 'Query engine',
    subtitle: 'Building a SQL engine',
    blurb:
      'The path from a SELECT string to rows: a lexer, a parser, a catalog, and an executor that filters, joins, and aggregates.',
    about: [
      'A SQL engine reads text and returns rows. The text is split into tokens, parsed into a tree, checked against a catalog of tables, then executed as a pipeline of scans, filters, joins, and aggregates.',
      'You build a small dialect: CREATE TABLE, INSERT, and SELECT with WHERE, inner JOIN, GROUP BY, ORDER BY, and LIMIT. Tables live in memory. There is no optimizer and no index. Each chapter ends with tests that prove that piece works.',
    ],
    language: 'Go',
    facts: [
      'SQL',
      'Parser',
      'Executor',
      `${QUERY_ENGINE_CHAPTERS.filter((c) => c.kind !== 'reading').length} chapters`,
    ],
    status: 'planned',
    chapters: QUERY_ENGINE_CHAPTERS,
    languages: ['go'],
  },
  {
    id: 'b-tree',
    name: 'B-tree',
    subtitle: 'Building a B+ tree storage engine',
    blurb:
      'Postgres stores rows in a tree of pages. A write rewrites the leaf that holds the key. You add the log that survives a crash, and the pool that keeps hot pages in memory.',
    about: [
      'A B+ tree keeps every key in exactly one place. Leaves hold the data; internal pages hold only separators that guide a lookup down a short path. Pages update in place, so a write is a root-to-leaf walk and a page rewrite.',
      'Around the tree sit the pieces that make it a real engine: a pager that owns the page file and freelist, a write-ahead log so a crash loses nothing, and a buffer pool that keeps hot pages in memory. Each chapter ends with tests that prove that piece works.',
    ],
    language: 'Go',
    facts: [
      'Pager',
      'B+ tree',
      `${B_TREE_CHAPTERS.filter((c) => c.kind !== 'reading').length} chapters`,
    ],
    status: 'planned',
    chapters: B_TREE_CHAPTERS,
    languages: ['go'],
  },
  {
    id: 'consensus',
    name: 'Consensus',
    subtitle: 'Building Raft',
    blurb:
      'etcd keeps one history by electing a leader and copying its log to a majority. You build the election, the copy step, and a small store that applies the same entries on every node.',
    about: [
      'Distributed systems that must not disagree use a consensus protocol. Raft elects one leader per term, replicates a log to a majority, and applies committed entries to a state machine in the same order on every node.',
      'You build the pieces in order: election, AppendEntries, commit and apply, durable persistence, then a small client API on top. Network partitions and crashes are part of the tests from the start.',
    ],
    language: 'Go',
    facts: [
      'Raft',
      'Election',
      `${CONSENSUS_CHAPTERS.filter((c) => c.kind !== 'reading').length} chapters`,
    ],
    status: 'planned',
    chapters: CONSENSUS_CHAPTERS,
    languages: ['go'],
  },
  {
    id: 'lsm-tree',
    name: 'LSM tree',
    subtitle: 'Building an LSM storage engine',
    blurb:
      'RocksDB turns random writes into sorted files. New keys land in memory, then flush to disk. A background merge keeps only the newest value of each key.',
    about: [
      'An LSM tree turns random writes into sequential ones. Writes land in a sorted in-memory memtable, backed by a write-ahead log so a crash loses nothing. A full memtable is flushed to disk as an immutable sorted file, an SSTable.',
      'Reads check the memtable, then tables from newest to oldest, with Bloom filters skipping files that cannot hold the key. Compaction merges tables in the background, keeping the newest version of each key and dropping deleted data. Each chapter ends with tests that prove that piece works.',
    ],
    language: 'Go · Python · C++',
    facts: [
      'Skiplist',
      'SSTables',
      `${LSM_TREE_CHAPTERS.filter((c) => c.kind !== 'reading').length} chapters`,
    ],
    status: 'planned',
    chapters: LSM_TREE_CHAPTERS,
    languages: ['go', 'python', 'cpp'],
  },
];

export function getMinor(id: string | null | undefined): MinorEntry | null {
  if (!id) return null;
  return MINORS.find((m) => m.id === id) || null;
}

export function getMinorChapter(
  minor: MinorEntry | null | undefined,
  chapterId: string | null | undefined,
): ProjectModule | null {
  if (!minor?.chapters || !chapterId) return null;
  return minor.chapters.find((c) => c.id === chapterId) || null;
}

export function minorsFor(ids: string[] | undefined): MinorEntry[] {
  if (!ids || ids.length === 0) return [];
  return ids.map((id) => getMinor(id)).filter((m): m is MinorEntry => m != null);
}
