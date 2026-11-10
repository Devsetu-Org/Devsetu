# raftkv

Chapter 2: log replication. Election (chapter 1) is already solved in this starter.

```
raftkv/raft/replication.py         AppendEntries, replicate_to, Start   <- TODO 2.1–2.4
tests/test_replication.py          acceptance tests (given)
```

## Your work

| Task | Where | What |
| --- | --- | --- |
| 2.1 | `replication.py` `append_entries` | Refuse a log that does not line up; report conflict_index |
| 2.2 | `replication.py` `append_to_log` | Skip matching entries; cut at the first real conflict |
| 2.3 | `replication.py` `replicate_to` | Send from next_index; track match_index; back up on refusal |
| 2.4 | `replication.py` `start` | Leader appends, persists, and replicates |

## Running

```
make test
make run
```
