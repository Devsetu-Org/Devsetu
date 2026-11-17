## Log replication
<!-- mode: read-only -->

Chapter 1 gave the cluster a leader. A leader with nothing to lead is not much use, so this chapter digs into the next block: a **log** — an ordered list of commands that the leader copies to every follower.

![Raft stack chapter 2: log replication highlighted after election](/consensus/replication/you-are-here.jpg)

> [!scope] This chapter's job
> Make follower logs converge on the leader's log, even after crashes, drops, duplicates and leader changes. **Nothing commits yet**: a command is replicated, not agreed. Chapter 3 decides which entries are safe.

### What we are building

The **log** is Raft's unit of history. Each entry holds a command (opaque bytes to Raft) and the **term** of the leader that created it. Positions are **indices**, starting at 1. The leader appends; followers accept only when their prefix matches; conflicts truncate the follower's suffix and catch up.

By the end of this chapter you have:

- a consistency check on every AppendEntries
- safe append that ignores stale duplicates
- per-follower `nextIndex` / `matchIndex` cursors
- `Start` so the rest of the world can give the cluster work

### Entries have an index and a term

![Leader log, a follower that is a clean prefix, and a diverged follower with conflicting terms](/consensus/replication/log-matching.jpg)

<!-- lang: go -->
In `raft.go`, `rf.log[0]` is a **sentinel**: index 0, term 0, never sent. Real entries start at `rf.log[1]`, so index 5 is `rf.log[5]` with no off-by-one. `lastLogIndex()` and `lastLogTerm()` work on an empty log too (both 0).
<!-- /lang -->
<!-- lang: python -->
In `raft.py`, `self.log[0]` is a **sentinel**: index 0, term 0, never sent. Real entries start at `self.log[1]`, so index 5 is `self.log[5]` with no off-by-one. `last_log_index()` and `last_log_term()` work on an empty log too (both 0).
<!-- /lang -->
<!-- lang: cpp -->
In the Raft class, `log_[0]` is a **sentinel**: index 0, term 0, never sent. Real entries start at `log_[1]`, so index 5 is `log_[5]` with no off-by-one. `LastLogIndex()` and `LastLogTerm()` work on an empty log too (both 0).
<!-- /lang -->

### The Log Matching property

Raft guarantees two things, and everything else follows from them:

1. If two logs have an entry with the **same index and term**, they hold the same command.
2. If two logs have an entry with the same index and term, the logs are **identical in every entry before it**.

A leader creates at most one entry per index per term, and never changes it, which gives (1). Property (2) is enforced by the check you write in this chapter: a follower accepts new entries only if its log matches the leader's at the entry just before them. The harness's monitor tests property (2) between every pair of nodes while your code runs.

> [!idea] Why the previous entry is enough
> If the follower matches at `(PrevLogIndex, PrevLogTerm)`, induction says the whole prefix matches. That is why one fingerprint — not a hash of the whole log — is enough to keep replicas aligned.

## AppendEntries
<!-- mode: read-and-implement tasks:2.1,2.2 -->

### "The entry before these is (index, term)"

One RPC does heartbeats and replication. The leader sends the entries a follower is missing, plus a **fingerprint of what precedes them**.

- `Term`, `LeaderID` — who is leading (same handling as the heartbeats you already have).
- `PrevLogIndex`, `PrevLogTerm` — the entry immediately before `Entries` in the leader's log.
- `Entries` — entries to store after `PrevLogIndex`. Empty for a heartbeat.
- `LeaderCommit` — the leader's commit index (used in chapter 3).

The follower accepts only if **its log has an entry at `PrevLogIndex` with term `PrevLogTerm`**. By induction that means the two logs agree up to there. If not, it refuses, and the leader backs up and tries again with an earlier prefix.

![Follower A matches Prev and appends; B is too short; C has the wrong term at Prev](/consensus/replication/consistency.jpg)

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
<!-- lang: python -->
### `TODO(2.1)` — `append_entries`

In `raftkv/raft/replication.py`. The prologue is given: it rejects stale terms, follows the leader, resets the election timer, and fills in `reply.term`. Below it:

- `args.prev_log_index > self.last_log_index()`: `reply.conflict_index = self.last_log_index() + 1`, return.
- `self.log[args.prev_log_index].term != args.prev_log_term`: let `t` be that term; walk `i` down from `prev_log_index` while `i > 1 and self.log[i-1].term == t`; `reply.conflict_index = i`, return.
- Otherwise `self.append_to_log(args.prev_log_index, args.entries)`, then `self.follower_advance_commit(args.leader_commit, args.prev_log_index + len(args.entries))` (an empty hook until chapter 3), and `reply.success = True`.

`prev_log_index` 0 always matches: that is the sentinel.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(2.1)` — `AppendEntries`

In `src/raft/replication.cc`. The prologue is given: it rejects stale terms, follows the leader, resets the election timer, and fills in `reply.term`. Below it:

- `args.prev_log_index > LastLogIndex()`: `reply.conflict_index = LastLogIndex() + 1`, return.
- `log_[args.prev_log_index].term != args.prev_log_term`: let `t` be that term; walk `i` down from `prev_log_index` while `i > 1 && log_[i-1].term == t`; `reply.conflict_index = i`, return.
- Otherwise `AppendToLog(args.prev_log_index, args.entries)`, then `FollowerAdvanceCommit(args.leader_commit, args.prev_log_index + args.entries.size())` (an empty hook until chapter 3), and `reply.success = true`.

`prev_log_index` 0 always matches: that is the sentinel.
<!-- /lang -->

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
<!-- lang: python -->
### `TODO(2.2)` — `append_to_log`

In `raftkv/raft/replication.py`: for each `(k, e)` in `enumerate(entries)`, the slot is `idx = prev_index + 1 + k`. If `idx <= self.last_log_index()`: matching term, `continue`; otherwise truncate with `self.log = self.log[:idx]`. Then append a copy of `e` and remember that something changed. Call `self.persist()` once at the end if it did.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(2.2)` — `AppendToLog`

In `src/raft/replication.cc`: for each entry at offset `k`, the slot is `idx = prev_index + 1 + k`. If `idx <= LastLogIndex()`: matching term, continue; otherwise truncate `log_` to `idx`. Then push the entry and remember that something changed. Call `Persist()` once at the end if it did.
<!-- /lang -->

## Leading the log
<!-- mode: read-and-implement tasks:2.3,2.4 -->

### Two numbers per follower

A leader tracks, for each follower, how far it has gotten:

- `nextIndex[i]` — the next entry to send follower *i*. **A guess**: starts at the end of the leader's log and moves down on refusals.
- `matchIndex[i]` — the highest entry known stored on *i*. **A fact**: only moves up, only on a success reply.

![nextIndex backs up on ConflictIndex then advances; matchIndex only rises on success](/consensus/replication/cursors.jpg)

`becomeLeader` already reset these (`resetLeaderProgress`): `nextIndex` just past the leader's log, `matchIndex` zero. Chapter 3 computes commit from `matchIndex`, so it must never claim more than the follower has confirmed.

### Handling a reply

Replies are asynchronous, and the leader keeps sending heartbeats while it waits, so it can have **several RPCs in flight to one follower**, and replies can arrive late, twice, or in the wrong order.

- **`reply.Term` is higher:** step down with `becomeFollower`.
- **Not the leader of `args.Term` any more:** ignore the reply.
- **Success:** `matchIndex = PrevLogIndex + len(Entries)`, but only if that is **higher** than what is recorded. A late reply to an older, shorter RPC must not move it back. Then `nextIndex = matchIndex + 1`.
- **Refusal:** set `nextIndex` to the follower's hint, but only if that **lowers** it and never to or below `matchIndex`. Then retry immediately with another `replicateTo`; waiting for the next heartbeat would make catching up 25 ms per step.

> [!tip] Copy the entries
> Sharing the leader's log buffer with an in-flight RPC is unsafe: the log keeps growing under the next `Start`. Copy the entries while the lock is held, then send.

<!-- lang: go -->
### `TODO(2.3)` — `replicateTo`

In `internal/raft/replication.go`. `broadcastAppend` (given) starts one `replicateTo` goroutine per follower. In `replicateTo`:

1. Lock; return if `rf.killed()` or not the leader. Build `AppendEntriesArgs` from `next := rf.nextIndex[peer]`: `PrevLogIndex: next-1`, `PrevLogTerm: rf.log[next-1].Term`, a **copy** of `rf.log[next:]`, `LeaderCommit: rf.commitIndex`. Unlock.
2. `rf.sendAppendEntries(peer, &args, &reply)`; if the call was lost, return.
3. Lock again and handle the reply as above. On success call `rf.advanceCommit()` (an empty hook until chapter 3).
<!-- /lang -->
<!-- lang: python -->
### `TODO(2.3)` — `replicate_to`

In `raftkv/raft/replication.py`. `broadcast_append` (given) starts one `replicate_to` thread per follower. In `replicate_to`:

1. Take `self.mu`; return if dead or not the leader. Build `AppendEntriesArgs` from `nxt = self.next_index[peer]`: `prev_log_index=nxt-1`, `prev_log_term=self.log[nxt-1].term`, a **copy** of `self.log[nxt:]`, `leader_commit=self.commit_index`. Release the lock.
2. `self.send_append_entries(peer, args)`; if the call was lost, return.
3. Take the lock again and handle the reply as above. On success call `self.advance_commit()` (an empty hook until chapter 3).
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(2.3)` — `ReplicateTo`

In `src/raft/replication.cc`. `BroadcastAppend` (given) starts one `ReplicateTo` thread per follower. In `ReplicateTo`:

1. Lock; return if killed or not the leader. Build `AppendEntriesArgs` from `next = next_index_[peer]`: previous index/term, a **copy** of `log_` from `next` onward, `leader_commit = commit_index_`. Unlock.
2. `SendAppendEntries`; if the call was lost, return.
3. Lock again and handle the reply as above. On success call `AdvanceCommit()` (an empty hook until chapter 3).
<!-- /lang -->

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
<!-- lang: python -->
### `TODO(2.4)` — `start`

In `raftkv/raft/replication.py`, with the lock held: if dead or `self.role != LEADER` return `-1, self.current_term, False`. Otherwise append a `LogEntry` with `term=self.current_term` and a **copy** of the command, `self.persist()`, `self.broadcast_append()`, and return `self.last_log_index(), self.current_term, True`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(2.4)` — `Start`

In `src/raft/replication.cc`, with the lock held: if killed or not leader return `{-1, current_term_, false}`. Otherwise append a `LogEntry` with `current_term_` and a copy of the command, `Persist()`, `BroadcastAppend()`, and return `{LastLogIndex(), current_term_, true}`.
<!-- /lang -->

### Try it

<!-- lang: go -->
```bash
make test     # chapter 1 and chapter 2 acceptance tests
make race     # the same tests with the race detector
make run      # a REPL over a 3-node cluster
```
<!-- /lang -->
<!-- lang: python -->
```bash
make test     # chapter 1 and chapter 2 acceptance tests
make run      # a REPL over a 3-node cluster
```
<!-- /lang -->
<!-- lang: cpp -->
```bash
make test     # chapter 1 and chapter 2 acceptance tests
make asan     # AddressSanitizer build of the same tests
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
> 1. A follower accepts entries only if its log has `(PrevLogIndex, PrevLogTerm)`. That is what keeps logs prefix-consistent.
> 2. It truncates only at a real conflict, never because an RPC is short or old.
> 3. `matchIndex` is a fact and only rises. `nextIndex` is a guess and moves both ways.
> 4. Replies to an AppendEntries can be late, duplicated or reordered, so each one is checked against the current state.
> 5. `Start` returning `true` means "accepted", not "committed".

Replicated is not committed. Chapter 3 decides **which entries are safe forever**, advances `commitIndex`, and applies them to a state machine in order.
