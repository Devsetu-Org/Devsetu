/**
 * Consensus (Raft) chapters 1–5, Go only for now. Each starter repo is loaded
 * whole from its `go/files/` folder; `solution/` folders are never globbed, so
 * they stay out of the bundle.
 *
 * A task's `file` also marks which files the learner owns: the workspace
 * carries those files into later chapters, so they must be byte-identical in
 * every later starter (see AUTHORING.md).
 *
 * Unlike the LSM chapters, a few paths are a hook in an early chapter and a
 * task file in a later one (`replication.go`, `commit.go`, `persist.go`): the
 * early starter ships a small working version, and the chapter that owns the
 * path replaces it with TODOs. Carry-forward only ever looks at the chapters
 * before the current one, so a later chapter's hook never overwrites work.
 */

import type { ModuleTask, ProjectModuleContent } from './types';
import { theoryForLanguage } from './theoryLanguage';

import electionTheory from './minors/consensus/election/theory.md?raw';
import replicationTheory from './minors/consensus/replication/theory.md?raw';
import commitTheory from './minors/consensus/commit/theory.md?raw';
import persistenceTheory from './minors/consensus/persistence/theory.md?raw';
import clientsTheory from './minors/consensus/clients/theory.md?raw';

type RawFiles = Record<string, string>;

// Vite needs the glob options written out literally in each call.
const ELECTION_FILES = import.meta.glob<string>('./minors/consensus/election/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const REPLICATION_FILES = import.meta.glob<string>('./minors/consensus/replication/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const COMMIT_FILES = import.meta.glob<string>('./minors/consensus/commit/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const PERSISTENCE_FILES = import.meta.glob<string>('./minors/consensus/persistence/go/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const CLIENTS_FILES = import.meta.glob<string>('./minors/consensus/clients/go/files/**/*', {
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

export const CONSENSUS_VERIFY_LEAD =
  'Run these from the project root. The acceptance tests cover this chapter and every chapter before it, so a clean run means the cluster works so far.';

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
      if (!(path in repoFiles)) console.error(`consensus/${moduleId}: starter repo has no ${path}`);
    }
  }
  return {
    projectId: 'consensus',
    moduleId,
    language: 'go',
    theory: theoryForLanguage(theory, 'go'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: VERIFY,
    verifyLead: CONSENSUS_VERIFY_LEAD,
  };
}

export const CONSENSUS_ELECTION_GO = chapter(
  'election',
  electionTheory,
  ELECTION_FILES,
  'internal/raft/election.go',
  [
    {
      id: '1.1',
      label: 'Step down on a higher term',
      file: 'internal/raft/election.go',
      summary: 'becomeFollower: adopt the newer term and forget the vote; a same-term call keeps it.',
    },
    {
      id: '1.2',
      label: 'The election restriction',
      file: 'internal/raft/vote.go',
      summary: 'logUpToDate: a later last term wins, then the longer log.',
    },
    {
      id: '1.3',
      label: 'Grant at most one vote',
      file: 'internal/raft/vote.go',
      summary: 'RequestVote: refuse stale terms, vote once per term, persist before replying.',
    },
    {
      id: '1.4',
      label: 'Campaign',
      file: 'internal/raft/election.go',
      summary: 'startElection: new term, vote for yourself, ask every peer concurrently.',
    },
    {
      id: '1.5',
      label: 'Count votes and lead',
      file: 'internal/raft/election.go',
      summary: 'handleVoteReply ignores stale replies; becomeLeader announces itself at once.',
    },
  ],
);

export const CONSENSUS_REPLICATION_GO = chapter(
  'replication',
  replicationTheory,
  REPLICATION_FILES,
  'internal/raft/replication.go',
  [
    {
      id: '2.1',
      label: 'Check the previous entry',
      file: 'internal/raft/replication.go',
      summary: 'AppendEntries: refuse a log that does not line up and report ConflictIndex.',
    },
    {
      id: '2.2',
      label: 'Truncate only on conflict',
      file: 'internal/raft/replication.go',
      summary: 'appendToLog: skip entries you already have, cut at the first real mismatch.',
    },
    {
      id: '2.3',
      label: 'Replicate to one follower',
      file: 'internal/raft/replication.go',
      summary: 'replicateTo: send from nextIndex, move matchIndex up only, back up on refusal.',
    },
    {
      id: '2.4',
      label: 'Accept a command',
      file: 'internal/raft/replication.go',
      summary: 'Start: the leader appends, persists, and replicates at once.',
    },
  ],
);

export const CONSENSUS_COMMIT_GO = chapter(
  'commit',
  commitTheory,
  COMMIT_FILES,
  'internal/raft/commit.go',
  [
    {
      id: '3.1',
      label: 'Commit by majority',
      file: 'internal/raft/commit.go',
      summary: 'advanceCommit: highest majority-replicated index from the current term only.',
    },
    {
      id: '3.2',
      label: 'Follow the leader safely',
      file: 'internal/raft/commit.go',
      summary: 'followerAdvanceCommit: min(leaderCommit, last entry this RPC verified).',
    },
    {
      id: '3.3',
      label: 'Apply in order',
      file: 'internal/raft/commit.go',
      summary: 'applyLoop: lastApplied+1..commitIndex, once each, without holding the lock.',
    },
  ],
);

export const CONSENSUS_PERSISTENCE_GO = chapter(
  'persistence',
  persistenceTheory,
  PERSISTENCE_FILES,
  'internal/raft/persist.go',
  [
    {
      id: '4.1',
      label: 'Save term, vote and log',
      file: 'internal/raft/persist.go',
      summary: 'persist: encode the three durable fields and Save; panic if the save fails.',
    },
    {
      id: '4.2',
      label: 'Reload on start',
      file: 'internal/raft/persist.go',
      summary: 'readPersist: restore them; commitIndex and lastApplied are rebuilt, not stored.',
    },
    {
      id: '4.3',
      label: 'Atomic file save',
      file: 'internal/storage/file.go',
      summary: 'Save: temp file, fsync, rename over the state file, fsync the directory.',
    },
    {
      id: '4.4',
      label: 'Load the saved file',
      file: 'internal/storage/file.go',
      summary: 'Load: read the final file only; a missing file is an empty state.',
    },
  ],
);

export const CONSENSUS_CLIENTS_GO = chapter(
  'clients',
  clientsTheory,
  CLIENTS_FILES,
  'internal/kv/state.go',
  [
    {
      id: '5.1',
      label: 'Apply each write once',
      file: 'internal/kv/state.go',
      summary: 'State.Apply: Get / Put / Delete, with duplicates of (ClientID, Seq) ignored.',
    },
    {
      id: '5.2',
      label: 'Wake the waiting request',
      file: 'internal/kv/server.go',
      summary: 'Server.Apply: run the op, then answer whoever waits at that log index.',
    },
    {
      id: '5.3',
      label: 'Submit and wait',
      file: 'internal/kv/server.go',
      summary: 'Execute: Start, wait for the apply, notice lost leadership, redirect with a hint.',
    },
    {
      id: '5.4',
      label: 'Find the leader',
      file: 'internal/kv/client.go',
      summary: 'Clerk.do: retry the same (ClientID, Seq) across servers, following hints with care.',
    },
  ],
);
