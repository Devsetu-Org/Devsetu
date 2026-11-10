/**
 * Consensus (Raft) chapters 1–5, Python. Each starter repo is loaded whole from
 * its `python/files/` folder; `solution/` folders are never globbed.
 *
 * A task's `file` also marks which files the learner owns: the workspace
 * carries those files into later chapters, so they must be byte-identical in
 * every later starter (see AUTHORING.md).
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

const ELECTION_FILES = import.meta.glob<string>('./minors/consensus/election/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const REPLICATION_FILES = import.meta.glob<string>(
  './minors/consensus/replication/python/files/**/*',
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
);
const COMMIT_FILES = import.meta.glob<string>('./minors/consensus/commit/python/files/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const PERSISTENCE_FILES = import.meta.glob<string>(
  './minors/consensus/persistence/python/files/**/*',
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
);
const CLIENTS_FILES = import.meta.glob<string>('./minors/consensus/clients/python/files/**/*', {
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
      if (!(path in repoFiles)) console.error(`consensus/${moduleId}: starter repo has no ${path}`);
    }
  }
  return {
    projectId: 'consensus',
    moduleId,
    language: 'python',
    theory: theoryForLanguage(theory, 'python'),
    entryFile,
    files: repoFiles,
    tasks,
    verify: VERIFY,
    verifyLead: CONSENSUS_VERIFY_LEAD,
  };
}

export const CONSENSUS_ELECTION_PYTHON = chapter(
  'election',
  electionTheory,
  ELECTION_FILES,
  'raftkv/raft/election.py',
  [
    {
      id: '1.1',
      label: 'Step down on a higher term',
      file: 'raftkv/raft/election.py',
      summary: 'become_follower: adopt the newer term and forget the vote; a same-term call keeps it.',
    },
    {
      id: '1.2',
      label: 'The election restriction',
      file: 'raftkv/raft/vote.py',
      summary: 'log_up_to_date: a later last term wins, then the longer log.',
    },
    {
      id: '1.3',
      label: 'Grant at most one vote',
      file: 'raftkv/raft/vote.py',
      summary: 'request_vote: refuse stale terms, vote once per term, persist before replying.',
    },
    {
      id: '1.4',
      label: 'Campaign',
      file: 'raftkv/raft/election.py',
      summary: 'start_election: new term, vote for yourself, ask every peer concurrently.',
    },
    {
      id: '1.5',
      label: 'Count votes and lead',
      file: 'raftkv/raft/election.py',
      summary: 'handle_vote_reply ignores stale replies; become_leader announces itself at once.',
    },
  ],
);

export const CONSENSUS_REPLICATION_PYTHON = chapter(
  'replication',
  replicationTheory,
  REPLICATION_FILES,
  'raftkv/raft/replication.py',
  [
    {
      id: '2.1',
      label: 'Check the previous entry',
      file: 'raftkv/raft/replication.py',
      summary: 'append_entries: refuse a log that does not line up and report conflict_index.',
    },
    {
      id: '2.2',
      label: 'Truncate only on conflict',
      file: 'raftkv/raft/replication.py',
      summary: 'append_to_log: skip entries you already have, cut at the first real mismatch.',
    },
    {
      id: '2.3',
      label: 'Replicate to one follower',
      file: 'raftkv/raft/replication.py',
      summary: 'replicate_to: send from next_index, move match_index up only, back up on refusal.',
    },
    {
      id: '2.4',
      label: 'Accept a command',
      file: 'raftkv/raft/replication.py',
      summary: 'start: the leader appends, persists, and replicates at once.',
    },
  ],
);

export const CONSENSUS_COMMIT_PYTHON = chapter(
  'commit',
  commitTheory,
  COMMIT_FILES,
  'raftkv/raft/commit.py',
  [
    {
      id: '3.1',
      label: 'Commit by majority',
      file: 'raftkv/raft/commit.py',
      summary: 'advance_commit: highest majority-replicated index from the current term only.',
    },
    {
      id: '3.2',
      label: 'Follow the leader safely',
      file: 'raftkv/raft/commit.py',
      summary: 'follower_advance_commit: min(leader_commit, last entry this RPC verified).',
    },
    {
      id: '3.3',
      label: 'Apply in order',
      file: 'raftkv/raft/commit.py',
      summary: 'apply_loop: last_applied+1..commit_index, once each, without holding the lock.',
    },
  ],
);

export const CONSENSUS_PERSISTENCE_PYTHON = chapter(
  'persistence',
  persistenceTheory,
  PERSISTENCE_FILES,
  'raftkv/raft/persist.py',
  [
    {
      id: '4.1',
      label: 'Save term, vote and log',
      file: 'raftkv/raft/persist.py',
      summary: 'persist: encode the three durable fields and save; raise if the save fails.',
    },
    {
      id: '4.2',
      label: 'Reload on start',
      file: 'raftkv/raft/persist.py',
      summary: 'read_persist: restore them; commit_index and last_applied are rebuilt, not stored.',
    },
    {
      id: '4.3',
      label: 'Atomic file save',
      file: 'raftkv/storage/file.py',
      summary: 'save: temp file, fsync, rename over the state file, fsync the directory.',
    },
    {
      id: '4.4',
      label: 'Load the saved file',
      file: 'raftkv/storage/file.py',
      summary: 'load: read the final file only; a missing file is an empty state.',
    },
  ],
);

export const CONSENSUS_CLIENTS_PYTHON = chapter(
  'clients',
  clientsTheory,
  CLIENTS_FILES,
  'raftkv/kv/state.py',
  [
    {
      id: '5.1',
      label: 'Apply each write once',
      file: 'raftkv/kv/state.py',
      summary: 'State.apply: Get / Put / Delete, with duplicates of (client_id, seq) ignored.',
    },
    {
      id: '5.2',
      label: 'Wake the waiting request',
      file: 'raftkv/kv/server.py',
      summary: 'Server.apply: run the op, then answer whoever waits at that log index.',
    },
    {
      id: '5.3',
      label: 'Submit and wait',
      file: 'raftkv/kv/server.py',
      summary: 'execute: Start, wait for the apply, notice lost leadership, redirect with a hint.',
    },
    {
      id: '5.4',
      label: 'Find the leader',
      file: 'raftkv/kv/client.py',
      summary: 'Clerk.do: retry the same (client_id, seq) across servers, following hints with care.',
    },
  ],
);
