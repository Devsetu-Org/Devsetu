import type { ChapterReading } from './types';

/** Consensus minor, chapter 00: what Raft is, where it runs, and the plan. */
export const CONSENSUS_OVERVIEW: ChapterReading = {
  eyebrow: 'Consensus · Chapter 00',
  title: 'Consensus: agreeing when machines can fail',
  lede:
    'Start here before writing any code. We explain **why replicated systems need consensus**, how **Raft** elects a leader and replicates a log, where it runs in production, and exactly what you will build across the five chapters of this minor.',
  showBlogStamp: true,
  sections: [
    {
      id: 'why-consensus',
      title: 'Why agreement is hard',
      body: [
        'A single machine is easy: one process, one disk, one answer. Replicate that state across three or five machines and you get durability and availability when one dies — and a new problem: **what if they disagree?**',
        'Networks drop and delay packets. Processes crash and restart. Clocks drift. Two nodes can each believe they are in charge. Without a rule for who wins, a key/value store can return different values for the same key on different replicas, and a configuration change can leave the cluster split forever.',
      ],
      subsections: [
        {
          id: 'what-consensus-gives',
          title: 'What consensus gives you',
          body: [
            '**A single history.** Every node that stays up applies the same commands in the same order.',
            '**Safety under partitions.** A minority of the cluster cannot invent a conflicting history while the majority is elsewhere.',
            '**Progress when a majority is healthy.** Lose one of three, or two of five, and the rest can still elect a leader and serve writes.',
          ],
        },
        {
          id: 'not-magic',
          title: 'What it does not give you',
          body: [
            'Consensus does not make every replica answer instantly under a partition. When a minority is cut off, it must refuse to act as leader. That is the trade: **availability only with a majority**, in exchange for never serving two truths.',
          ],
        },
      ],
      callout: {
        kind: 'idea',
        title: 'Replicated state machine',
        body: [
          'The usual shape is: agree on a **log of commands**, then each node **applies** those commands to a local state machine (a map, a config store, a SQL engine). If the log is identical and apply is deterministic, the state machines stay identical. Consensus is the hard part of keeping the log identical.',
        ],
      },
    },
    {
      id: 'raft-in-brief',
      title: 'Raft in one page',
      body: [
        '**Raft** (Diego Ongaro and John Ousterhout, 2014) is a consensus protocol designed to be understandable. It has one leader at a time. Clients send writes to the leader; the leader appends them to its log and ships them to followers; once a majority has an entry, it is **committed** and safe to apply.',
      ],
      code: {
        language: 'plaintext',
        filename: 'a Raft term',
        code: [
          '   term 7',
          '   ┌────────┐  AppendEntries   ┌────────┐',
          '   │ leader │ ───────────────▶ │follower│',
          '   │  log   │ ◀─── ok / nack ── │  log   │',
          '   └────────┘                  └────────┘',
          '        │                           │',
          '        └──── majority has entry ───┘',
          '                    ▼',
          '              commit + apply → state machine',
        ].join('\n'),
      },
      bullets: [
        '**Terms.** Time is divided into numbered terms. At most one leader per term. Seeing a higher term makes any node step down.',
        '**Roles.** Follower, candidate, or leader. Followers answer votes and appends. Candidates ask for votes. Leaders push the log.',
        '**Election.** A follower that hears nothing from a leader times out, increments its term, and RequestVotes. A majority of votes makes it leader.',
        '**Log.** A sequence of `(term, command)` entries. The leader never overwrites its own committed prefix; followers truncate conflicting suffixes and catch up.',
        '**Commit.** An entry is committed when the leader knows a majority stores it. `commitIndex` only moves forward; apply walks from lastApplied to commitIndex.',
      ],
      callout: {
        kind: 'tip',
        title: 'Majority is the whole game',
        body: [
          'With 2f+1 nodes you tolerate f failures. Three nodes tolerate one; five tolerate two. A write is durable once a majority has it on disk — not once every replica has applied it.',
        ],
      },
    },
    {
      id: 'raft-vs-others',
      title: 'Raft, Paxos, and Multi-Paxos',
      body: [
        'Paxos solved consensus first and powers many systems still. Raft and Multi-Paxos are in the same family: they agree on a sequence of values. Raft packages the ideas with a strong leader and a vocabulary (terms, votes, AppendEntries) that maps cleanly onto code and tests.',
      ],
      table: {
        headers: ['', 'Raft (this minor)', 'Classic Paxos'],
        rows: [
          ['**Leadership**', 'One elected leader replicates the log', 'Proposers compete; Multi-Paxos often stabilises a leader'],
          ['**Unit of agreement**', 'Log entries in order', 'One value per instance; Multi-Paxos chains them'],
          ['**Teaching focus**', 'Roles, RPCs, and invariants you can test', 'Ballot numbers and acceptors'],
          ['**Production cousins**', 'etcd, Consul, TiKV’s Raft layer', 'Chubby, Spanner’s Paxos groups'],
        ],
      },
      after: [
        'This minor builds Raft. Once you have it, reading a Paxos paper is much easier: the same majority, the same “don’t forget a vote”, the same log of decided values.',
      ],
    },
    {
      id: 'how-it-works',
      title: 'How the pieces fit together',
      body: [
        'Each box below is one chapter. The transport under the RPCs is given (in-process at first, then a simple network); you own the Raft rules.',
      ],
      flows: [
        {
          title: 'Election',
          steps: [
            'Follower timeout',
            'Become candidate, new term',
            'RequestVote to peers',
            'Majority → leader',
          ],
        },
        {
          title: 'Write path',
          steps: [
            'Client → leader',
            'Append to log',
            'AppendEntries to followers',
            'Majority → commit',
            'Apply to state machine',
          ],
        },
        {
          title: 'After a crash',
          steps: [
            'Reload term, votedFor, log',
            'Start as follower',
            'Catch up or win an election',
          ],
        },
      ],
      after: [
        '**Election.** Randomised election timeouts stop split votes from looping forever. A vote is sticky for a term once persisted.',
        '**Replication.** AppendEntries carries the previous entry’s index and term so a follower can reject a gap or a conflict. The leader walks `nextIndex` backwards on rejection until the logs match.',
        '**Commit.** Only entries from the leader’s current term are newly committed by counting replicas (the paper’s rule that closes a subtle safety hole). Older entries ride along once a current-term entry is committed.',
        '**Persistence.** Before you grant a vote or reply success to AppendEntries, the durable state that Raft requires is on disk.',
        '**Clients.** A thin KV API turns Put/Delete into log commands and Get into a read of applied state (with a redirect if you contacted a follower).',
      ],
    },
    {
      id: 'where-its-used',
      title: 'Where Raft runs',
      body: [
        'Raft is the default consensus choice in a lot of cloud-native infrastructure:',
      ],
      table: {
        headers: ['System', 'What it is', 'How Raft shows up'],
        rows: [
          ['**etcd**', 'Kubernetes’ backing store', 'Replicated key/value; every watch and lease sits on a Raft log.'],
          ['**Consul**', 'Service discovery and config', 'Servers form a Raft quorum for the catalog and KV.'],
          ['**TiKV / TiDB**', 'Distributed SQL / KV', 'Each Region is a Raft group; leadership moves with the data.'],
          ['**CockroachDB**', 'Distributed SQL', 'Ranges replicate with Raft (MultiRaft).'],
          ['**MongoDB**', 'Document database', 'Replica sets use a Raft-inspired protocol for primary election and oplog.'],
          ['**RethinkDB**, **SOFAJRaft**, **HashiCorp raft**', 'Libraries and stores', 'Embedded Raft for metadata or user data.'],
        ],
      },
      after: [
        'When Kubernetes says etcd lost quorum, or TiKV says a Region is unavailable, you are looking at Raft’s majority rule in production.',
      ],
    },
    {
      id: 'why-it-matters',
      title: 'Why this matters if you run these systems',
      body: [
        'Operational pain with etcd, Consul, or TiKV is often Raft behaviour showing through:',
      ],
      bullets: [
        '**Lost quorum.** Too many nodes down or partitioned: no leader, no writes. Adding nodes does not help until a majority can talk.',
        '**Leader flaps.** Aggressive timeouts or overloaded leaders cause repeated elections; every election pauses writes briefly.',
        '**Slow followers.** A lagging follower keeps `matchIndex` low; if you size the cluster wrong, commit waits on the wrong peer.',
        '**Disk and fsync.** Raft’s safety assumes votes and log appends are durable. A lying disk or skipped fsync can elect two leaders across a crash.',
        '**Large logs.** Without snapshots (out of scope for v1), catch-up copies the whole log; production systems snapshot applied state for a reason.',
      ],
      after: [
        'After this minor those symptoms map to concrete mechanisms you wrote: timeouts, nextIndex, commitIndex, and persistence.',
      ],
    },
    {
      id: 'vocabulary',
      title: 'The words you will use',
      body: ['Every chapter uses these terms. Come back here whenever one is fuzzy.'],
      table: {
        headers: ['Term', 'Meaning'],
        rows: [
          ['**Term**', 'Monotonic logical clock; at most one leader per term'],
          ['**Follower / candidate / leader**', 'The three Raft roles'],
          ['**RequestVote**', 'RPC a candidate sends to gather a majority'],
          ['**AppendEntries**', 'RPC the leader uses to replicate log entries and as a heartbeat'],
          ['**Log entry**', 'A `(term, command)` pair at a log index'],
          ['**commitIndex**', 'Highest log index known to be stored on a majority'],
          ['**lastApplied**', 'Highest index already applied to the state machine'],
          ['**nextIndex / matchIndex**', 'Per-follower cursors the leader uses to send and track progress'],
          ['**State machine**', 'Deterministic apply of committed commands (here: a key/value map)'],
          ['**Quorum / majority**', 'More than half of the voting members'],
        ],
      },
    },
    {
      id: 'what-you-build',
      title: 'What you will build in this minor',
      body: [
        'Over five chapters you build **raftkv**, a small Raft cluster in Go that serves a replicated key/value API. A test harness drops messages, delays them, and kills nodes. Passing tests means the safety rules hold under those faults.',
      ],
      table: {
        headers: ['Chapter', 'You build', 'Done when'],
        rows: [
          [
            '**01 · Election**',
            'Timeouts, RequestVote, stepping up and down with terms',
            'A majority elects one leader per term; a partitioned minority cannot steal leadership forever',
          ],
          [
            '**02 · Replication**',
            'AppendEntries, nextIndex / matchIndex, conflict repair',
            'Followers’ logs become prefixes of the leader’s after enough rounds',
          ],
          [
            '**03 · Commit**',
            'commitIndex, apply loop, current-term commit rule',
            'Committed entries are never lost; uncommitted ones may be overwritten after a leader change',
          ],
          [
            '**04 · Persistence**',
            'Durable term, votedFor, and log; reload on start',
            'Kill a node mid-vote or mid-append, restart, and safety still holds',
          ],
          [
            '**05 · Clients**',
            'Put / Get / Delete over Raft, redirect to leader',
            'A client talking to any node eventually writes through the leader and reads applied state',
          ],
          [
            '**06 · Benchmark** (coming soon)',
            'Your cluster against the reference under the same fault schedule',
            'A report of correctness, failover time, and throughput versus the reference',
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
        '**Small tasks.** A chapter has two to four tasks, and each turns green as you finish it.',
        '**Faults are the tests.** The harness injects drops, delays, and crashes. Green means the invariants held.',
        '**Your code carries forward.** Each chapter starts from your own earlier work, with an opt-in reference solution if you get stuck.',
      ],
      after: [
        '**What you need:** comfortable Go (goroutines, channels, mutexes, `go test`). No distributed-systems background; every idea is introduced when it is needed.',
      ],
      callout: {
        kind: 'scope',
        title: 'Deliberately left out',
        body: [
          'Production Raft also has log snapshots, dynamic membership (joint consensus), read indexes / leases for linearizable reads, and batching. They matter, but each would double a chapter. This minor builds the core the rest sit on.',
        ],
      },
    },
  ],
  takeaways: [
    'Consensus lets replicas agree on one history of commands despite crashes and partitions.',
    'Raft uses a single leader per term, a replicated log, and majority votes for elections and commits.',
    'Safety first: a minority must not invent a conflicting committed history; availability needs a majority.',
    'etcd, Consul, TiKV, and CockroachDB all run on Raft (or a close cousin), and their outages often are quorum and election behaviour.',
    'Across five chapters you build election, replication, commit, persistence, and a replicated KV API in Go.',
  ],
};
