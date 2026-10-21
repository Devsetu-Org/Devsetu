## Where you are
<!-- mode: read-only -->

You have a Raft that elects, replicates, commits and survives crashes. This chapter turns it into what the minor promised: a **key/value store** that stays correct while servers die and the network splits.

```plaintext
   clients ──▶ Clerk ─── Put / Get / Delete ───▶ ┌──────────────────────┐
     ch 5                                        │ Server  ─▶  State    │
                                                 │   │          ▲       │
                                                 │   ▼          │ apply │
                                                 │  Raft  ──── log ─────┤
                                                 └──────────────────────┘
   ch 1-4: Raft (solved)       ch 5: the Server, the State, the Clerk
```

> [!scope] This chapter's job
> A replicated map with a client that finds the leader, retries safely, and never gets a stale or doubled answer. Raft itself does not change.

## From log to API
<!-- mode: read-only -->

### The replicated state machine

Raft agrees on a **sequence of byte strings**. The store gives them meaning: each command is an `Op` (`Put`, `Delete` or `Get`), and every server applies the same ops in the same order to its own in-memory map.

<!-- lang: go -->
```go
type Op struct {
	Kind     OpKind // OpGet, OpPut, OpDelete
	Key      []byte
	Value    []byte
	ClientID int64
	Seq      int64
}
```

`internal/kv` has four layers:

| File | Role |
| --- | --- |
| `state.go` | `State`: the map. Pure data, no Raft. **You write `Apply`.** |
| `server.go` | `Server`: glues Raft and `State` together. **You write `Apply` and `Execute`.** |
| `client.go` | `Clerk`: the client. **You write `do`.** |
| `op.go`, `node.go`, `cluster.go` | encoding, wiring, `StartCluster` (given) |
<!-- /lang -->

### A request's life

```plaintext
  Clerk.Put(k, v)
     │  Execute RPC to its best guess of the leader
     ▼
  Server.Execute        ── Start(op) ──▶ Raft: append, replicate, commit
     │  waits on a channel for log index i                      │
     │                                                          ▼
     │                               every server: Apply(i, op) → State.Apply
     │                                                          │
     └──────────── woken by Apply at index i ◀──────────────────┘
     ▼
  reply to the Clerk (or "not the leader, try X")
```

Only the leader's `Start` accepts. If the client asked a follower, the reply says so and carries a **hint**: who this follower believes leads.

## Why Get goes through the log
<!-- mode: read-only -->

### Stale reads

It is tempting to answer a `Get` from the leader's map: it holds the committed data, nothing to replicate. It is **wrong**, because a leader does not always know it is still the leader.

```plaintext
  5 servers. S1 leads term 3 and gets cut off together with S2.
  S3, S4, S5 elect S3 for term 4 and accept  Put("x", "new").
  S1 has not heard about term 4. A client asks S1:  Get("x")
  S1: "I am the leader" → returns "old".      ✘ the cluster has already moved on
```

Putting the `Get` **in the log** fixes it with no extra mechanism: an entry can only commit with a majority, and a deposed leader cannot get one. Its `Get` waits, times out, and the client tries elsewhere. It is slower than a read from memory, and obviously correct. Production systems keep correctness while skipping the log with leases or a "read index" round of heartbeats; the table at the end of this chapter lists them.

A bonus: a `Get` is a current-term entry, so committing it also commits any older entries a new leader inherited, which chapter 3 explained cannot commit on their own.

## Exactly once, with retries
<!-- mode: read-and-implement tasks:5.1 -->

### The same request, twice

A client sends `Put("x", "1")`. The leader appends it, replicates it, and commits it. The reply is lost. The client times out and retries: `Put("x", "1")` goes into the log **again**. Now the log holds the same logical request twice, and it gets worse:

```plaintext
  log:   1: Put x=1 (client A, seq 7)
         2: Put x=2 (client B, seq 3)
         3: Put x=1 (client A, seq 7)     ← A's retry, committed after B's write

  naive apply:   x = 1       ✘ B's write is silently undone
  correct:       x = 2       ✔ entry 3 is a duplicate and does nothing
```

The fix is to give every request an identity. Each `Clerk` has a unique `ClientID` and numbers its requests `Seq = 1, 2, 3, …`, **one at a time**. A retry reuses the same `(ClientID, Seq)`. The state machine remembers the highest `Seq` it has applied for each client: any `Put` or `Delete` with a `Seq` it has already seen is a duplicate, and is skipped.

A `Get` changes nothing, so running it again is harmless; it always reads.

Because every server applies the same log, every server makes the same dedupe decisions and stays identical.

> [!warn] Copy the bytes
> `op.Value` belongs to the caller, and `Value` in a result is read by a caller you do not control. Store a **copy** on `Put`, return a **copy** on `Get`. Otherwise one client reusing its buffer changes data in the map.

<!-- lang: go -->
### `TODO(5.1)` — `State.Apply`

In `internal/kv/state.go`:

1. `fresh := op.Seq > s.lastSeq[op.ClientID]`; if `fresh`, record `s.lastSeq[op.ClientID] = op.Seq`.
2. `OpGet`: look up `s.data[string(op.Key)]` and return `Result{Value: <copy>, Found: ok}`. An empty stored value is still `Found`.
3. `OpPut`: if `fresh`, store a copy of `op.Value`.
4. `OpDelete`: if `fresh`, `delete(s.data, string(op.Key))`.
<!-- /lang -->

## The server
<!-- mode: read-and-implement tasks:5.2,5.3 -->

### Waiting for a log index

`Execute` hands an op to Raft with `Start`, which returns the log **index** the op will have if it commits. Then it must wait for the apply of that index, which happens on another goroutine (Raft's apply loop). Waiters are kept in a map from index to a one-slot channel.

```plaintext
  Execute                                   Raft's apply loop
  ───────                                   ─────────────────
  lock s.mu
  idx = rf.Start(op)
  waiters[idx] = ch
  unlock
  wait on ch (or timeout) ◀─────────────── Apply(idx, cmd): state.Apply ; waiters[idx] <- result
```

Two traps live here:

1. **Start and registration must be one atomic step.** If you `Start`, unlock, and then register, a fast commit can be applied before the waiter exists. The result is delivered to nobody and `Execute` waits until its timeout.
2. **The entry at your index may not be yours.** A leader can append your op at index 5, lose leadership, and the new leader can commit a *different* entry at 5. Your channel is woken, but by someone else's op. `Apply` therefore sends back the op's `(ClientID, Seq)`, and `Execute` compares it with its own. A mismatch means "I was deposed": reply `ErrNotLeader`. If the op never applies at all, the timeout answers.

### The three replies

| Reply | Meaning | What the client does |
| --- | --- | --- |
| success | committed and applied; for a `Get`, the value | return it |
| `ErrNotLeader` + hint | wrong server, or deposed | go to the hint, or the next server |
| `ErrTimeout` | accepted but not committed in time (likely a leader cut off from its majority) | try another server |

<!-- lang: go -->
### `TODO(5.2)` — `Server.Apply`

In `internal/kv/server.go`. Raft calls it from its apply loop, in log order, with no Raft lock held.

- `decodeOp(command)`; return on error.
- Lock `s.mu`, `result := s.state.Apply(op)`.
- If `ch, ok := s.waiters[index]`: `delete` it and send `applied{clientID: op.ClientID, seq: op.Seq, result: result}`. The channel has room for one value, so the send does not block.

### `TODO(5.3)` — `Server.Execute`

In the same file. Set `reply.Leader = -1` first.

1. `ch := make(chan applied, 1)`. Lock `s.mu`; `index, _, ok := s.rf.Start(encodeOp(args.Op))`. If `!ok`: unlock, `reply.Err = ErrNotLeader`, `reply.Leader = s.rf.Leader()`, return. Otherwise, if `s.waiters[index]` already exists, `close` it; then `s.waiters[index] = ch` and unlock.
2. `select` on `ch` and `time.After(s.timeout)`.
3. From `ch`: if it is closed or the `(clientID, seq)` differ from `args.Op`, reply `ErrNotLeader` with the leader hint. Otherwise copy `Value` and `Found` into the reply.
4. On timeout: under `s.mu`, delete the waiter if `s.waiters[index] == ch`, and reply `ErrTimeout`.
<!-- /lang -->

## The client
<!-- mode: read-and-implement tasks:5.4 -->

### Finding the leader

A `Clerk` does not know who leads. It starts with a guess and tries servers until one commits its request:

```plaintext
  do(op):   stamp op with (ClientID, ++seq)
            until deadline:
                reply = servers[guess].Execute(op)
                ok?                         → return it
                not leader with a hint?     → guess = hint
                otherwise                   → guess = next server
                a full lap of failures?     → sleep a little; an election may be running
            return ErrUnavailable
```

Every retry sends the **same** `Op`, same `Seq`. That is what makes the retry safe.

### A hint is only a hint

A follower's idea of who leads can be out of date: it keeps pointing at a leader that has since been deposed (for example one sitting in a minority partition). If the clerk blindly follows hints it can bounce between a stale follower and the stale leader forever, never reaching the real one. So: **follow a hint, unless that server just failed**; then fall back to the next server round-robin. The tests include a partition that makes exactly this loop possible.

### What the client cannot know

`ErrUnavailable` means "I did not hear back in time". The request may have committed. Clients that need to know must read the key again. This is inherent to any system that can lose a reply, and it is why the `(ClientID, Seq)` pair exists.

<!-- lang: go -->
### `TODO(5.4)` — `Clerk.do`

In `internal/kv/client.go`:

1. `ck.seq++`, `op.ClientID = ck.id`, `op.Seq = ck.seq`, `deadline := time.Now().Add(ck.Timeout)`.
2. Loop until the deadline: `var reply ExecuteReply`; `ok := ck.ends[ck.leader].Call("KV.Execute", &ExecuteArgs{Op: op}, &reply)`. If `ok && reply.Err == ""`, return `Result{Value: reply.Value, Found: reply.Found}, nil`.
3. Otherwise choose the next server: the hint (`reply.Leader`, when `ok`, `reply.Err == ErrNotLeader`, in range, and that server did not fail in the last lap of attempts), else `(ck.leader + 1) % len(ck.ends)`. Remember which server failed on which attempt in a small map.
4. After every `len(ck.ends)` failed attempts, `time.Sleep(25 * time.Millisecond)`.
5. After the deadline, `return Result{}, ErrUnavailable`.
<!-- /lang -->

## Try it, and what is next
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test     # all five chapters, end to end
make race     # the same tests with the race detector
make run      # a 5-server store
```
<!-- /lang -->

```plaintext
> put city lisbon
ok
> leader
server 3
> split 3,4              cut the leader and one more off from the rest
> put city porto         a clerk reaches the majority side; the minority cannot commit
ok
> heal
> get city
"porto"
> crash 0
> get city
"porto"
```

### What you built, and what production adds

You have the core of etcd, Consul and CockroachDB's replication layer. A real system continues with:

| Missing here | Why it matters |
| --- | --- |
| **Snapshots** | The log grows forever and a restart replays all of it. Real nodes snapshot the state machine and discard the log prefix. |
| **A leader no-op** | A new leader commits inherited entries at once instead of waiting for a client. |
| **Cheaper reads** | Leader leases, or ReadIndex (a heartbeat round) instead of a log entry per `Get`. |
| **Membership changes** | Adding and removing servers safely, one at a time or with joint consensus. |
| **Incremental persistence** | An append-only log file instead of rewriting the whole state on every change. |
| **Real sockets and clocks** | Here the network is in-process and time is real, so tests rely on timeouts being generous. |

The next chapter, the benchmark, runs your cluster and the reference one under the same workload and fault schedule.

> [!check] Before you move on
> Say these out loud:
>
> 1. Every operation, even a `Get`, goes through the log, so a deposed leader cannot answer.
> 2. A retry carries the same `(ClientID, Seq)`, and the state machine applies each write once.
> 3. `Start` and registering the waiter happen under one lock, and the apply carries the op's identity so a deposed leader is noticed.
> 4. A redirect is a hint; a client that follows hints blindly can loop on a stale one.
> 5. `ErrUnavailable` means "unknown", not "failed".
