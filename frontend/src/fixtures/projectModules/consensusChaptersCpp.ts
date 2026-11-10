/**
 * Consensus (Raft) chapters 1–5, C++. Each starter repo is loaded whole from
 * its `cpp/files/` folder; `solution/` folders are never globbed.
 */

import type { ModuleTask, ProjectModuleContent } from './types';
import { theoryForLanguage } from './theoryLanguage';
import { CONSENSUS_VERIFY_LEAD } from './consensusChaptersGo';

import electionTheory from './minors/consensus/election/theory.md?raw';
import replicationTheory from './minors/consensus/replication/theory.md?raw';
import commitTheory from './minors/consensus/commit/theory.md?raw';
import persistenceTheory from './minors/consensus/persistence/theory.md?raw';
import clientsTheory from './minors/consensus/clients/theory.md?raw';

type RawFiles = Record<string, string>;

const ELECTION_FILES = import.meta.glob<string>('./minors/consensus/election/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const REPLICATION_FILES = import.meta.glob<string>('./minors/consensus/replication/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const COMMIT_FILES = import.meta.glob<string>('./minors/consensus/commit/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const PERSISTENCE_FILES = import.meta.glob<string>('./minors/consensus/persistence/cpp/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const CLIENTS_FILES = import.meta.glob<string>('./minors/consensus/clients/cpp/files/**/*', {
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
      if (!(path in repoFiles)) console.error(`consensus/${moduleId}: starter repo has no ${path}`);
    }
  }
  return {
    projectId: 'consensus',
    moduleId,
    language: 'cpp',
    theory: theoryForLanguage(theory, 'cpp'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: VERIFY,
    verifyLead: CONSENSUS_VERIFY_LEAD,
  };
}

export const CONSENSUS_ELECTION_CPP = chapter(
  'election',
  electionTheory,
  ELECTION_FILES,
  'src/raft/election.cc',
  [
    {
      id: '1.1',
      label: 'Step down on a higher term',
      file: 'src/raft/election.cc',
      summary: 'BecomeFollower: adopt the newer term and forget the vote; a same-term call keeps it.',
    },
    {
      id: '1.2',
      label: 'The election restriction',
      file: 'src/raft/vote.cc',
      summary: 'LogUpToDate: a later last term wins, then the longer log.',
    },
    {
      id: '1.3',
      label: 'Grant at most one vote',
      file: 'src/raft/vote.cc',
      summary: 'RequestVote: refuse stale terms, vote once per term, persist before replying.',
    },
    {
      id: '1.4',
      label: 'Campaign',
      file: 'src/raft/election.cc',
      summary: 'StartElection: new term, vote for yourself, ask every peer concurrently.',
    },
    {
      id: '1.5',
      label: 'Count votes and lead',
      file: 'src/raft/election.cc',
      summary: 'HandleVoteReply ignores stale replies; BecomeLeader announces itself at once.',
    },
  ],
);

export const CONSENSUS_REPLICATION_CPP = chapter(
  'replication',
  replicationTheory,
  REPLICATION_FILES,
  'src/raft/replication.cc',
  [
    {
      id: '2.1',
      label: 'Check the previous entry',
      file: 'src/raft/replication.cc',
      summary: 'AppendEntries: refuse a log that does not line up and report ConflictIndex.',
    },
    {
      id: '2.2',
      label: 'Truncate only on conflict',
      file: 'src/raft/replication.cc',
      summary: 'AppendToLog: skip entries you already have, cut at the first real mismatch.',
    },
    {
      id: '2.3',
      label: 'Replicate to one follower',
      file: 'src/raft/replication.cc',
      summary: 'ReplicateTo: send from nextIndex, move matchIndex up only, back up on refusal.',
    },
    {
      id: '2.4',
      label: 'Accept a command',
      file: 'src/raft/replication.cc',
      summary: 'Start: the leader appends, persists, and replicates at once.',
    },
  ],
);

export const CONSENSUS_COMMIT_CPP = chapter(
  'commit',
  commitTheory,
  COMMIT_FILES,
  'src/raft/commit.cc',
  [
    {
      id: '3.1',
      label: 'Commit by majority',
      file: 'src/raft/commit.cc',
      summary: 'AdvanceCommit: highest majority-replicated index from the current term only.',
    },
    {
      id: '3.2',
      label: 'Follow the leader safely',
      file: 'src/raft/commit.cc',
      summary: 'FollowerAdvanceCommit: min(leaderCommit, last entry this RPC verified).',
    },
    {
      id: '3.3',
      label: 'Apply in order',
      file: 'src/raft/commit.cc',
      summary: 'ApplyLoop: lastApplied+1..commitIndex, once each, without holding the lock.',
    },
  ],
);

export const CONSENSUS_PERSISTENCE_CPP = chapter(
  'persistence',
  persistenceTheory,
  PERSISTENCE_FILES,
  'src/raft/persist.cc',
  [
    {
      id: '4.1',
      label: 'Save term, vote and log',
      file: 'src/raft/persist.cc',
      summary: 'Persist: encode the three durable fields and Save; throw if the save fails.',
    },
    {
      id: '4.2',
      label: 'Reload on start',
      file: 'src/raft/persist.cc',
      summary: 'ReadPersist: restore them; commitIndex and lastApplied are rebuilt, not stored.',
    },
    {
      id: '4.3',
      label: 'Atomic file save',
      file: 'src/storage/file.cc',
      summary: 'Save: temp file, fsync, rename over the state file, fsync the directory.',
    },
    {
      id: '4.4',
      label: 'Load the saved file',
      file: 'src/storage/file.cc',
      summary: 'Load: read the final file only; a missing file is an empty state.',
    },
  ],
);

export const CONSENSUS_CLIENTS_CPP = chapter(
  'clients',
  clientsTheory,
  CLIENTS_FILES,
  'src/kv/state.cc',
  [
    {
      id: '5.1',
      label: 'Apply each write once',
      file: 'src/kv/state.cc',
      summary: 'State::Apply: Get / Put / Delete, with duplicates of (ClientID, Seq) ignored.',
    },
    {
      id: '5.2',
      label: 'Wake the waiting request',
      file: 'src/kv/server.cc',
      summary: 'Server::Apply: run the op, then answer whoever waits at that log index.',
    },
    {
      id: '5.3',
      label: 'Submit and wait',
      file: 'src/kv/server.cc',
      summary: 'Execute: Start, wait for the apply, notice lost leadership, redirect with a hint.',
    },
    {
      id: '5.4',
      label: 'Find the leader',
      file: 'src/kv/client.cc',
      summary: 'Clerk::Do: retry the same (ClientID, Seq) across servers, following hints with care.',
    },
  ],
);
