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
    id: 'b-tree',
    name: 'B-tree',
    subtitle: 'Building a B+ tree storage engine',
    blurb:
      'The update-in-place engine behind Postgres and InnoDB: a pager, a B+ tree, a write-ahead log, and a buffer pool.',
    about: [
      'A B+ tree keeps every key in exactly one place. Leaves hold the data; internal pages hold only separators that guide a lookup down a short path. Pages update in place, so a write is a root-to-leaf walk and a page rewrite.',
      'Around the tree sit the pieces that make it a real engine: a pager that owns the page file and freelist, a write-ahead log so a crash loses nothing, and a buffer pool that keeps hot pages in memory. Each chapter ends with tests that prove that piece works.',
    ],
    language: 'Go',
    facts: [
      'Pager',
      'B+ tree',
      'Buffer pool',
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
      'The agreement protocol behind etcd and Consul: leader election, log replication, commits, and a replicated key/value store.',
    about: [
      'Distributed systems that must not disagree use a consensus protocol. Raft elects one leader per term, replicates a log to a majority, and applies committed entries to a state machine in the same order on every node.',
      'You build the pieces in order: election, AppendEntries, commit and apply, durable persistence, then a small client API on top. Network partitions and crashes are part of the tests from the start.',
    ],
    language: 'Go',
    facts: [
      'Raft',
      'Leader election',
      'Log replication',
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
      'The write-optimized engine behind RocksDB and Cassandra: a memtable, a write-ahead log, sorted tables on disk, and compaction.',
    about: [
      'An LSM tree turns random writes into sequential ones. Writes land in a sorted in-memory memtable, backed by a write-ahead log so a crash loses nothing. A full memtable is flushed to disk as an immutable sorted file, an SSTable.',
      'Reads check the memtable, then tables from newest to oldest, with Bloom filters skipping files that cannot hold the key. Compaction merges tables in the background, keeping the newest version of each key and dropping deleted data. Each chapter ends with tests that prove that piece works.',
    ],
    language: 'Go · Python · C++',
    facts: [
      'Skiplist',
      'SSTables',
      'Compaction',
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
