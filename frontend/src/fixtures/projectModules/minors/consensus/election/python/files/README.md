# raftkv

A replicated key/value store built on Raft, in Python, built chapter by chapter.
This repo starts with leader election: a cluster of nodes that agree on who is in charge.

```
raftkv/__main__.py                 REPL over a 3-node cluster (given)
raftkv/labrpc/                     in-process RPC that drops, delays, duplicates (given)
raftkv/labharness/                 cluster, partitions, crashes, safety checks (given)
raftkv/storage/                    where a node keeps durable state (given)
raftkv/raft/raft.py                the Raft class, make, the ticker (given)
raftkv/raft/rpc.py                 wire types for the two RPCs (given)
raftkv/raft/replication.py         heartbeats only for now (given, chapter 2 rewrites it)
raftkv/raft/election.py            terms, candidates, leaders           <- TODO 1.1, 1.4, 1.5
raftkv/raft/vote.py                RequestVote                          <- TODO 1.2, 1.3
tests/test_election.py             acceptance tests (given)
```

## Your work

| Task | Where | What |
| --- | --- | --- |
| 1.1 | `election.py` `become_follower` | Adopt a newer term and forget the vote |
| 1.2 | `vote.py` `log_up_to_date` | The election restriction: only vote for a log at least as good as yours |
| 1.3 | `vote.py` `request_vote` | One vote per term; refuse stale terms |
| 1.4 | `election.py` `start_election` | New term, vote for yourself, ask everyone concurrently |
| 1.5 | `election.py` `handle_vote_reply`, `become_leader` | Count fresh votes; take the job on a majority |

## Running

```
make test     # python3 -m unittest discover -s tests -v
make run      # REPL: status | cut N | heal | crash N | restart N | quit
```

Try `make run`, then `status`, `cut 0` (cut the leader off), and `status` again a second later.
