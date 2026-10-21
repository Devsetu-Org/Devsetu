## Where you are
<!-- mode: read-only -->

The leader now copies its log to every follower. But a copy is not agreement: a leader can be deposed a moment after replicating an entry to one node. This chapter answers **which entries are safe, forever** and puts them to work.

```plaintext
   ch 5      │   kv: Put / Get / Delete      │
   ch 4      │   persistence                 │
   ch 3      │   commit + apply              │ ◀──── you are here
   ch 2      │   log replication (solved)    │
   ch 1      │   election (solved)           │
```

> [!scope] This chapter's job
> Advance `commitIndex` correctly on leaders and followers, and apply committed entries to a state machine in order, exactly once. After this chapter the cluster is a working replicated log.

## Replicated is not committed
<!-- mode: read-only -->

### The definition

An entry is **committed** when it is guaranteed to be in the log of every future leader. Once committed it can be applied to the state machine, and nobody can ever take it back. Everything before a committed entry is committed too, so one number describes it all: `commitIndex`, the highest committed index.

| Number | Who | Meaning |
| --- | --- | --- |
| `matchIndex[i]` | leader | the highest entry known stored on follower *i* |
| `commitIndex` | everyone | the highest entry known committed |
| `lastApplied` | everyone | the highest entry handed to the state machine; always `<= commitIndex` |

### Why a majority

An entry stored on a majority is on at least one node of **every** majority. A new leader needs votes from a majority, and the election restriction (chapter 1) only lets it win if its log is at least as up to date as every voter's. So a node holding the entry is always among the voters, and the winner has the entry too. A leader that counts a majority for an entry may commit it.

```plaintext
  5 nodes, entry stored on A B C:

      A  B  C  D  E
      ●  ●  ●  ○  ○        any 3 voters include at least one of A, B, C;
                           the winner's log is at least as good as that voter's, so it has the entry
```

## Committing as a leader
<!-- mode: read-and-implement tasks:3.1 -->

### The rule that surprises everyone

You might expect: "when an entry is on a majority, commit it." That is **almost** right, and the almost is the hardest idea in this chapter. A leader may commit by counting replicas **only for entries from its own term**. An entry from an earlier term that sits on a majority can still be overwritten.

```plaintext
  5 servers S1..S5. Entries show terms.

  (a) S1 leads term 2, writes entry t2 at index 2, replicates to S2 only.
        S1: [t1 t2]   S2: [t1 t2]   S3: [t1]   S4: [t1]   S5: [t1]

  (b) S1 crashes. S5 wins term 3 (votes: S3, S4, S5), writes t3 at index 2. Not replicated.
        S5: [t1 t3]

  (c) S5 crashes. S1 restarts, wins term 4, and starts replicating its old t2 entry.
      It reaches S3:    S1: [t1 t2]  S2: [t1 t2]  S3: [t1 t2]    ← t2 is on a MAJORITY
      If S1 commits it now (counting replicas) …

  (d) … and crashes again. S5, with last term 3, is more up to date than S2/S3/S4
      (last term 2). S5 wins term 5 and overwrites index 2 with t3 on everyone.
        a "committed" entry has been erased.
```

The fix: a leader commits an entry only if it is **from the leader's current term** and on a majority. Entries below it then commit too, as a side effect. In (c), S1 must first get a **t4** entry onto a majority; after that, S5 can no longer win (its last term 3 is behind) and the old t2 is safe.

> [!idea] This is why real implementations append a no-op on election
> A new leader with old uncommitted entries cannot commit them until it commits something from its own term. etcd and Consul append an empty entry at election to make that happen at once. This lab does not: `Start` is the only way entries arrive. So a new leader's inherited entries commit with the next command a client sends, and the tests below check exactly that. The key/value server in chapter 5 submits `Get` through the log, which doubles as the no-op.

### The loop

Walk candidates `N` from the end of the log down to `commitIndex + 1`:

```plaintext
  for N = lastLogIndex down to commitIndex+1:
      if log[N].term != currentTerm:  stop         ← terms never decrease along a log; everything below is older
      count = 1 (me) + peers with matchIndex >= N
      if count >= majority:  commitIndex = N ; wake the apply loop ; stop
```

The leader runs this after every successful reply (`advanceCommit` is already called from `replicateTo`).

<!-- lang: go -->
### `TODO(3.1)` — `advanceCommit`

In `internal/raft/commit.go`: do nothing unless `rf.role == Leader`. Loop `n` from `rf.lastLogIndex()` down to `rf.commitIndex+1`; `return` at the first entry whose `Term != rf.currentTerm`; count `1` plus `rf.matchIndex[i] >= n` for `i != rf.me`; at `rf.majority()` set `rf.commitIndex = n`, `rf.applyCond.Broadcast()`, and return.
<!-- /lang -->

## Committing as a follower
<!-- mode: read-and-implement tasks:3.2 -->

### Followers learn it from the leader

Every `AppendEntries` carries `LeaderCommit`. A follower moves its own `commitIndex` toward it, with one catch: it can only trust entries **it knows match the leader's log**.

```plaintext
  follower log:   [t1 t1 t2 t2 t2]            (the last three may be from a dead leader)
  heartbeat:      Prev=(0,0), Entries=[], LeaderCommit=4

  commit 4?   ✘  this RPC verified nothing: the follower's entries 1..4 are unproven
  commit min(4, 0+0) = 0   ✔

  later RPC:      Prev=(2,t1), Entries=[], LeaderCommit=9
  commit min(9, 2) = 2     ✔  index 2 was just proved to match
```

`lastNew` is the index of the last entry **this RPC** proved: `PrevLogIndex + len(Entries)`. The follower's log may be longer, but anything past `lastNew` is unverified. `commitIndex` also never decreases: a stale heartbeat can carry a smaller `LeaderCommit`.

<!-- lang: go -->
### `TODO(3.2)` — `followerAdvanceCommit`

In `internal/raft/commit.go`: compute `min(leaderCommit, lastNew)`; if it is greater than `rf.commitIndex`, set it and `rf.applyCond.Broadcast()`. Your chapter 2 `AppendEntries` already calls this after appending.
<!-- /lang -->

## The apply loop
<!-- mode: read-and-implement tasks:3.3 -->

### From the log to the state machine

Committed entries are only useful once something runs them. Each node hands them, in order, to a **state machine**: a deterministic function of the commands it has seen. Same commands, same order, same state, on every node.

<!-- lang: go -->
The state machine is the `StateMachine` interface in `raft.go`:

```go
type StateMachine interface {
	Apply(index int, command []byte)
}
```

The test harness plugs in a recorder that checks every apply: in order, no gaps, no repeats, and the same command at the same index on every server. In chapter 5 the key/value store is the state machine.
<!-- /lang -->

The apply loop is one goroutine that sleeps until `commitIndex` moves, then applies `lastApplied+1 .. commitIndex`. Two details:

- **Do not hold the lock while applying.** `Apply` is someone else's code. It may be slow, or take locks of its own; if it called back into Raft while you held `rf.mu`, you would deadlock. Copy the batch out, bump `lastApplied`, unlock, apply, lock again.
- **Exactly one applier.** Only this goroutine applies, so order survives dropping the lock.

> [!warn] Wait in a loop
> `sync.Cond.Wait` can return when the condition is false (and `Kill` wakes you to exit). Always `for` around the condition, never `if`.

<!-- lang: go -->
### `TODO(3.3)` — `applyLoop`

In `internal/raft/commit.go`:

1. `rf.mu.Lock()` once, with a deferred `Unlock`. `for !rf.killed() { ... }`.
2. If `rf.lastApplied >= rf.commitIndex`: `rf.applyCond.Wait()` and `continue`.
3. Otherwise copy `rf.log[rf.lastApplied+1 : rf.commitIndex+1]`, remember the first index, set `rf.lastApplied = rf.commitIndex`, `rf.mu.Unlock()`.
4. For each entry in order: stop if `rf.killed()`; skip if `rf.sm == nil`; `rf.sm.Apply(index, command)`. Then `rf.mu.Lock()`.
<!-- /lang -->

## Try it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test     # chapters 1-3 acceptance tests
make race     # the same tests with the race detector
make run      # a REPL over a 3-node cluster
```
<!-- /lang -->

```plaintext
> start a
> start b
> status
node 0  follower  term 1  votedFor 1  log 2  commit 2  applied 2
node 1  leader    term 1  votedFor 1  log 2  commit 2  applied 2
node 2  follower  term 1  votedFor 1  log 2  commit 2  applied 2
> cut 0
> cut 2
> start lonely
> status
node 1  leader    term 1  votedFor 1  log 3  commit 2  applied 2   ← stored on 1 of 3: not committed
```

The tests check the chapter's three promises: committed entries are never lost, uncommitted ones may be overwritten after a leader change, and an old-term entry does not commit by counting replicas alone.

> [!check] Before you move on
> Say these out loud:
>
> 1. An entry is committed when it is guaranteed to be in every future leader's log. A majority plus the election restriction gives that.
> 2. A leader counts replicas to commit only entries from its **own term**; older entries commit underneath them.
> 3. A follower commits `min(leaderCommit, last entry this RPC verified)`, and `commitIndex` never goes down.
> 4. `lastApplied <= commitIndex`, and the state machine sees each index once, in order, without the Raft lock held.
> 5. Uncommitted entries are allowed to disappear. That is not a bug.
