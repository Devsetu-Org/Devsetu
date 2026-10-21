## Where you are
<!-- mode: read-only -->

Chapter 1 gave the cluster a leader. A leader with nothing to lead is not much use, so this chapter gives it a **log**: an ordered list of commands that the leader copies to every follower.

```plaintext
   ch 5      │   kv: Put / Get / Delete      │
   ch 4      │   persistence                 │
   ch 3      │   commit + apply              │
   ch 2      │   log replication             │ ◀──── you are here
   ch 1      │   election (solved)           │
```

> [!scope] This chapter's job
> Make follower logs converge on the leader's log, even after crashes, drops, duplicates and leader changes. **Nothing commits yet**: a command is replicated, not agreed. Chapter 3 decides which entries are safe.

## The log
<!-- mode: read-only -->

### Entries have an index and a term

The log is a sequence of entries. Each holds a command (opaque bytes, to Raft) and the **term** of the leader that created it. Positions are **indices**, starting at 1.

```plaintext
  index    1     2     3     4     5     6
        ┌─────┬─────┬─────┬─────┬─────┬─────┐
  leader│ t1  │ t1  │ t1  │ t2  │ t3  │ t3  │
        │ a   │ b   │ c   │ d   │ e   │ f   │
        └─────┴─────┴─────┴─────┴─────┴─────┘
  follow│ t1  │ t1  │ t1  │ t2  │                  ← a prefix of the leader's log
        └─────┴─────┴─────┴─────┘
  other │ t1  │ t1  │ t1  │ t2' │ t2' │            ← diverged: entries from a dead leader
        └─────┴─────┴─────┴─────┴─────┘
```

<!-- lang: go -->
In `raft.go`, `rf.log[0]` is a **sentinel**: index 0, term 0, never sent. Real entries start at `rf.log[1]`, so index 5 is `rf.log[5]` with no off-by-one. `lastLogIndex()` and `lastLogTerm()` work on an empty log too (both 0).
<!-- /lang -->

### The Log Matching property

Raft guarantees two things, and everything else follows from them:

1. If two logs have an entry with the **same index and term**, they hold the same command.
2. If two logs have an entry with the same index and term, the logs are **identical in every entry before it**.

A leader creates at most one entry per index per term, and never changes it, which gives (1). Property (2) is enforced by the check you write in this chapter: a follower accepts new entries only if its log matches the leader's at the entry just before them. The harness's monitor tests property (2) between every pair of nodes while your code runs.

## AppendEntries: the consistency check
<!-- mode: read-and-implement tasks:2.1 -->

### "The entry before these is (index, term)"

One RPC does heartbeats and replication. The leader sends the entries a follower is missing, plus a **fingerprint of what precedes them**.

| Field | Meaning |
| --- | --- |
| `Term`, `LeaderID` | Who is leading. Same handling as the heartbeats you already have. |
| `PrevLogIndex`, `PrevLogTerm` | The entry immediately before `Entries` in the leader's log |
| `Entries` | Entries to store after `PrevLogIndex`. Empty for a heartbeat. |
| `LeaderCommit` | The leader's commit index (used in chapter 3) |

The follower accepts only if **its log has an entry at `PrevLogIndex` with term `PrevLogTerm`**. By induction that means the two logs agree up to there. If not, it refuses, and the leader backs up and tries again with an earlier prefix.

```plaintext
  leader log:   [t1 t1 t2 t2 t3]            sends Prev=(3, t2), Entries=[t2 t3]

  follower A:   [t1 t1 t2]                  ✔ has (3, t2): append, now [t1 t1 t2 t2 t3]
  follower B:   [t1 t1]                     ✘ no index 3: "my log ends at 2, try from 3"
  follower C:   [t1 t1 t1 t1]               ✘ index 3 has t1, not t2: "my t1 run starts at 1"
```

### Telling the leader where to go

A plain refusal makes the leader step back one index at a time, one RPC per entry. A follower can say more. `ConflictIndex` is the first index the leader should try again from:

- **Log too short:** `ConflictIndex = lastLogIndex + 1`. Nothing in between can match.
- **Wrong term at `PrevLogIndex`:** `ConflictIndex` is the **first index of that run of same-term entries**. The leader created every entry of a term in one go, so if the last one is wrong the whole run is.

Correctness never depends on the hint; the leader just retries. It only decides whether a divergent follower costs one round trip or a thousand.

<!-- lang: go -->
### `TODO(2.1)` — `AppendEntries`

In `internal/raft/replication.go`. The prologue is given: it rejects stale terms, follows the leader, resets the election timer, and fills in `reply.Term`. Below it:

- `args.PrevLogIndex > rf.lastLogIndex()`: `reply.ConflictIndex = rf.lastLogIndex() + 1`, return.
- `rf.log[args.PrevLogIndex].Term != args.PrevLogTerm`: let `t` be that term; walk `i` down from `PrevLogIndex` while `i > 1 && rf.log[i-1].Term == t`; `reply.ConflictIndex = i`, return.
- Otherwise `rf.appendToLog(args.PrevLogIndex, args.Entries)`, then `rf.followerAdvanceCommit(args.LeaderCommit, args.PrevLogIndex+len(args.Entries))` (an empty hook until chapter 3), and `reply.Success = true`.

`PrevLogIndex` 0 always matches: that is the sentinel.
<!-- /lang -->

## Appending without breaking anything
<!-- mode: read-and-implement tasks:2.2 -->

### Truncate on conflict, not on contact

Once the check passes, the entries have to go into the log. The obvious version, "cut the log after `PrevLogIndex` and append", is wrong, and the network is why. RPCs can be **duplicated and delayed**, so a follower can receive an old `AppendEntries` carrying only the first two entries of a log it already holds five of.

```plaintext
  follower log:     [t1 t1 t2 t2 t2]
  late duplicate:   Prev=(0,0)  Entries=[t1 t1]

  naive "cut and append":   [t1 t1]            ✘ three entries gone; the leader may have
                                                 counted them toward a commit
  correct:                  [t1 t1 t2 t2 t2]   ✔ they already match; nothing to do
```

The rule: for each incoming entry, look at the slot it belongs to.

- Slot beyond the end of the log: **append**.
- Slot holds an entry with the **same term**: it is the same entry (Log Matching). **Skip.**
- Slot holds an entry with a **different term**: a real conflict. **Cut the log here** and append from this entry on. The cut entries came from a leader that lost.

> [!warn] A follower never deletes what it should keep
> A follower that acknowledged an entry may have helped a leader reach a majority for it. Truncating a matching entry because of a stale RPC can erase a committed entry, which is the one thing Raft must never do. Only a conflict with the *current* leader's log justifies deleting.

<!-- lang: go -->
### `TODO(2.2)` — `appendToLog`

In `internal/raft/replication.go`: for `k, e := range entries`, the slot is `idx := prevIndex + 1 + k`. If `idx <= rf.lastLogIndex()`: matching term, `continue`; otherwise `rf.log = rf.log[:idx]`. Then `rf.log = append(rf.log, e)` and remember that something changed. Call `rf.persist()` once at the end if it did.
<!-- /lang -->

## The leader's side
<!-- mode: read-and-implement tasks:2.3 -->

### Two numbers per follower

A leader tracks, for each follower, how far it has gotten:

| Field | Meaning | Optimistic or safe? |
| --- | --- | --- |
| `nextIndex[i]` | the next entry to send follower *i* | **a guess**: starts at the end of the leader's log and moves down on refusals |
| `matchIndex[i]` | the highest entry known stored on *i* | **a fact**: only moves up, only on a success reply |

```plaintext
  leader log: 1 2 3 4 5 6 7 8
  follower i: nextIndex = 9 (guess: "you are up to date")
      send Prev=(8), Entries=[]       ──▶  refused: "my log ends at 5, ConflictIndex 6"
      nextIndex = 6
      send Prev=(5), Entries=[6 7 8]  ──▶  ok
      matchIndex = 8, nextIndex = 9
```

`becomeLeader` already reset these (`resetLeaderProgress`): `nextIndex` just past the leader's log, `matchIndex` zero. Chapter 3 computes commit from `matchIndex`, so it must never claim more than the follower has confirmed.

### Handling a reply

Replies are asynchronous, and the leader keeps sending heartbeats while it waits, so it can have **several RPCs in flight to one follower**, and replies can arrive late, twice, or in the wrong order.

- **`reply.Term` is higher:** step down with `becomeFollower`.
- **Not the leader of `args.Term` any more:** ignore the reply.
- **Success:** `matchIndex = PrevLogIndex + len(Entries)`, but only if that is **higher** than what is recorded. A late reply to an older, shorter RPC must not move it back. Then `nextIndex = matchIndex + 1`.
- **Refusal:** set `nextIndex` to the follower's hint, but only if that **lowers** it and never to or below `matchIndex`. Then retry immediately with another `replicateTo`; waiting for the next heartbeat would make catching up 25 ms per step.

> [!tip] Copy the entries
> `Entries: rf.log[next:]` shares memory with the leader's log. The RPC is sent after you release the lock, and the log keeps growing under the next `Start`. Copy the slice while the lock is held.

<!-- lang: go -->
### `TODO(2.3)` — `replicateTo`

In `internal/raft/replication.go`. `broadcastAppend` (given) starts one `replicateTo` goroutine per follower. In `replicateTo`:

1. Lock; return if `rf.killed()` or not the leader. Build `AppendEntriesArgs` from `next := rf.nextIndex[peer]`: `PrevLogIndex: next-1`, `PrevLogTerm: rf.log[next-1].Term`, a **copy** of `rf.log[next:]`, `LeaderCommit: rf.commitIndex`. Unlock.
2. `rf.sendAppendEntries(peer, &args, &reply)`; if the call was lost, return.
3. Lock again and handle the reply as above. On success call `rf.advanceCommit()` (an empty hook until chapter 3).
<!-- /lang -->

## Accepting commands
<!-- mode: read-and-implement tasks:2.4 -->

### Start

`Start(command)` is how the rest of the world gives the cluster work. Only the leader may accept; everyone else says no, and the caller looks for the leader.

```plaintext
  Start(cmd) on the leader:
     append {term: currentTerm, cmd} to the log        index = lastLogIndex
     persist()
     broadcastAppend()                                  don't wait for the next heartbeat
     return index, term, true
```

> [!idea] A `true` is not a promise
> `Start` returns before anything is replicated. The entry might never be committed: the leader can be cut off a moment later and a new leader will overwrite the entry. `Start` returns the index and term so a caller can later check whether *its* command is what ended up there. Chapter 5's server does exactly that.

<!-- lang: go -->
### `TODO(2.4)` — `Start`

In `internal/raft/replication.go`, with the lock held: if `rf.killed()` or `rf.role != Leader` return `-1, rf.currentTerm, false`. Otherwise append `LogEntry{Term: rf.currentTerm, Command: <a copy of command>}`, `rf.persist()`, `rf.broadcastAppend()`, and return `rf.lastLogIndex(), rf.currentTerm, true`.
<!-- /lang -->

## Try it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test     # chapter 1 and chapter 2 acceptance tests
make race     # the same tests with the race detector
make run      # a REPL over a 3-node cluster
```
<!-- /lang -->

```plaintext
> start hello
node 1 accepted "hello" at index 1
> start world
> cut 0
> start while-away
> heal
> log 0
  1  term 1  hello
  2  term 1  world
  3  term 1  while-away        ← node 0 caught up after the partition healed
```

The `commit` column stays at 0 for now. The entries are on every node, but nobody has said they are safe.

> [!check] Before you move on
> Say these out loud:
>
> 1. A follower accepts entries only if its log has `(PrevLogIndex, PrevLogTerm)`. That is what keeps logs prefix-consistent.
> 2. It truncates only at a real conflict, never because an RPC is short or old.
> 3. `matchIndex` is a fact and only rises. `nextIndex` is a guess and moves both ways.
> 4. Replies to an AppendEntries can be late, duplicated or reordered, so each one is checked against the current state.
> 5. `Start` returning `true` means "accepted", not "committed".
