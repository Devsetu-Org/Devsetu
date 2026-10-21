## Where you are
<!-- mode: read-only -->

Chapter 00 explained why replicated systems need agreement and gave the plan: elect a leader, replicate a log, commit it, survive crashes, put a key/value API on top. This chapter builds the first box: **who is in charge**.

```plaintext
   clients ──▶ ┌──────────────────────────────┐
     ch 5      │   kv: Put / Get / Delete      │
               ├──────────────────────────────┤
     ch 4      │   persistence: survive a crash│
     ch 3      │   commit + apply              │
     ch 2      │   log replication             │
     ch 1      │   election: terms and votes   │ ◀──── you are here
               └──────────────────────────────┘
```

> [!scope] This chapter's job
> A cluster of nodes that, when the network cooperates, settles on **exactly one leader**; that replaces it when it disappears; and that never lets a node cut off from the majority rule. No log yet. The leader sends empty heartbeats and that is all.

## Roles and terms
<!-- mode: read-only -->

### Three roles, one clock

Every node is always in one of three roles. Time is cut into numbered **terms**, and a term is Raft's logical clock: a higher term always means "later".

```plaintext
                  times out, starts election
          ┌───────────────────────────────────────┐
          │                                       ▼
    ┌──────────┐   hears a leader        ┌───────────────┐
    │ follower │ ◀────────────────────── │   candidate   │ ──┐ timeout:
    └──────────┘   or a higher term      └───────┬───────┘   │ new election,
          ▲                                      │ majority  │ term + 1
          │ higher term seen                     ▼ of votes  │
          │                              ┌───────────────┐   │
          └───────────────────────────── │    leader     │   │
                                         └───────────────┘ ◀─┘ (no: stays candidate)
```

A follower waits. If it hears nothing from a leader for a **randomized election timeout**, it assumes the leader is gone, increments its term, votes for itself, and asks everybody else for a vote. A candidate that gets votes from a **majority** becomes the leader for that term and immediately sends heartbeats so nobody else starts an election.

### Two rules carry the whole protocol

| Rule | Why it matters |
| --- | --- |
| **A node votes at most once per term.** | Two candidates in one term cannot both reach a majority, because any two majorities share a node, and that node voted only once. So at most one leader per term. |
| **A higher term always wins.** Any message carrying a term higher than yours makes you adopt that term and become a follower. | A stale leader or candidate cannot keep ruling after the cluster has moved on. |

> [!idea] Why randomized timeouts
> If every node used the same timeout they would all become candidates at the same instant, split the votes, and repeat forever. Each node picks a fresh random timeout (here 120 to 240 ms in tests) so one usually fires first and wins before the others wake up.

### What a minority can and cannot do

A node cut off from the majority keeps timing out, keeps bumping its term, and keeps asking for votes nobody answers. It can **never** collect a majority, so it never leads. Its term runs far ahead, and that matters later: when the partition heals, its high term forces the whole cluster into a fresh election. Elections are cheap; two leaders are not.

## The test bench
<!-- mode: read-only -->

### Everything runs in one process

<!-- lang: go -->
There are no sockets. Each node is a `raft.Raft` value, and they talk through `internal/labrpc`, an in-process network that behaves like a bad real one:

| Fault | What the network does |
| --- | --- |
| **Partition** | Calls between groups fail after a short delay. |
| **Drop** | A request or its reply vanishes. The caller cannot tell which. |
| **Duplicate** | The same request is delivered twice. |
| **Delay** | Messages arrive late, so replies from old elections show up in new ones. |

`internal/labharness` wraps N nodes with a `Cluster`: `Disconnect`, `Partition`, `Crash`, `Restart`, `CheckOneLeader`. A background monitor samples every node several times per election timeout and fails the test the moment two nodes lead the same term, even if the test itself is looking elsewhere. That is how a subtle bug gets caught while you are not asking about it.
<!-- /lang -->

<!-- lang: go -->
### What is given

In `internal/raft`:

- `raft.go`: the `Raft` struct, `Make`, and `ticker`, a goroutine that every few milliseconds checks the clock. A non-leader whose election deadline has passed calls your `startElection`; a leader whose heartbeat is due calls `broadcastAppend`.
- `rpc.go`: the `RequestVoteArgs`/`Reply` and `AppendEntriesArgs`/`Reply` types.
- `replication.go`: just enough `AppendEntries` to carry heartbeats. Chapter 2 rewrites it.
- `persist.go`: `persist()` does nothing yet. **Call it anyway** whenever `currentTerm` or `votedFor` change. Chapter 4 makes it real, and the calls you write now will be what makes a restarted node safe.

> [!warn] The locking rule
> All state lives in the `Raft` struct under `rf.mu`. Functions documented "mu held" run with the lock taken and must not take it again (Go mutexes are not reentrant). **Never hold `rf.mu` while calling `sendRequestVote`**: an RPC can take tens of milliseconds, and the node on the other end may be calling you at the same moment. Send without the lock, take it again for the reply.
<!-- /lang -->

## Terms and stepping down
<!-- mode: read-and-implement tasks:1.1 -->

### One function every path uses

Seeing a newer term happens in many places: in a vote request, in a vote reply, in a heartbeat, in a heartbeat reply. Each one must do exactly the same thing, so it lives in one function.

```plaintext
  becomeFollower(term):
     role = Follower
     if term > currentTerm:
         currentTerm = term
         votedFor    = -1        ← a vote belongs to a term; a new term, a fresh vote
         persist()
```

The `if term > currentTerm` matters in the other direction too. A candidate that loses to a leader **of its own term** also calls `becomeFollower` with the same term. It must not forget its vote: it voted for itself in this term, and handing out a second vote in the same term is how two leaders happen.

<!-- lang: go -->
### `TODO(1.1)` — `becomeFollower`

In `internal/raft/election.go`:

- Set `rf.role = Follower`.
- Only when `term > rf.currentTerm`: set `rf.currentTerm = term`, `rf.votedFor = -1`, `rf.leaderID = -1`, and call `rf.persist()`.
<!-- /lang -->

## Granting votes
<!-- mode: read-and-implement tasks:1.2,1.3 -->

### The election restriction

Chapter 2 gives nodes logs, and a leader's log becomes everyone's log. If a node with a stale log could win, committed entries would vanish. So a node refuses to vote for a candidate whose log is **less up to date** than its own. "Up to date" compares the last entries:

1. A later **last term** is more up to date.
2. With equal last terms, the **longer** log is.

```plaintext
  my log:        [t1 t1 t2 t2]       last = (index 4, term 2)

  candidate A:   [t1 t1 t3]          last = (3, term 3)  ✔ later term beats longer log
  candidate B:   [t1 t1 t2]          last = (3, term 2)  ✘ same term, shorter
  candidate C:   [t1 t1 t2 t2]       last = (4, term 2)  ✔ equal is good enough
```

The logs are empty in this chapter, so every candidate passes. Write the function anyway: the tests seed logs directly, and chapter 2 depends on it.

<!-- lang: go -->
### `TODO(1.2)` — `logUpToDate`

In `internal/raft/vote.go`. Use `rf.lastLogTerm()` and `rf.lastLogIndex()`. Compare terms first; only when they are equal compare lengths.
<!-- /lang -->

### Deciding a vote

`RequestVote` is a handler: a candidate calls it over the network and waits for the reply. The order of the checks matters.

```plaintext
  RequestVote(term T, candidate C, lastLog):
     if T > currentTerm:   becomeFollower(T)        ← first, so the rest runs in term T
     reply.Term = currentTerm
     if T < currentTerm:   refuse                   ← a stale candidate
     if votedFor is none or == C, and log is up to date:
         votedFor = C; persist(); reset timer; grant
     else: refuse
```

Two details that tests look for:

- **Granting the same candidate twice is correct.** Its first reply may have been dropped, and it asks again. Refusing would not violate safety, but it can stall an election.
- **Reset the election timer only when you grant.** If refusing also reset it, a candidate with a stale log could keep every other node from ever campaigning.

> [!tip] Persist before you reply
> The reply is a promise: "you have my vote this term". If the node crashed right after sending it and forgot, it could vote again after restarting. `persist()` goes between changing `votedFor` and returning. It does nothing yet; the habit is the point.

<!-- lang: go -->
### `TODO(1.3)` — `RequestVote`

In `internal/raft/vote.go`, with the lock held for the whole function:

1. If `args.Term > rf.currentTerm`, `rf.becomeFollower(args.Term)`.
2. Set `reply.Term = rf.currentTerm` and `reply.VoteGranted = false`.
3. If `args.Term < rf.currentTerm`, return.
4. If `rf.votedFor` is `-1` or `args.CandidateID`, and `rf.logUpToDate(args.LastLogTerm, args.LastLogIndex)`: set `rf.votedFor`, `rf.persist()`, `rf.resetElectionTimer()`, `reply.VoteGranted = true`.
<!-- /lang -->

## Campaigning
<!-- mode: read-and-implement tasks:1.4 -->

### Ask everyone at once

When the ticker finds the election deadline passed it calls `startElection` with the lock held. The candidate

1. becomes a candidate, increments the term, votes for itself, saves that, and arms a new election timer (if this election fails, a new one starts after another random timeout);
2. sends `RequestVote` to every other node **concurrently**, one goroutine each, so a slow or dead peer cannot delay the rest;
3. counts replies as they arrive.

```plaintext
   startElection (lock held)                    goroutine per peer
   ─────────────────────────                    ──────────────────
   term++ ; votedFor = me
   args := {term, me, lastLog}
   for each peer ───────────────────────────▶   send RequestVote   (no lock held)
   return                                       lock ; handleVoteReply ; unlock
```

The goroutines outlive `startElection`, and the world moves while they wait. By the time a reply arrives this node may have become leader, lost to another candidate, or started a later election in a higher term. The next section is about handling that.

<!-- lang: go -->
### `TODO(1.4)` — `startElection`

In `internal/raft/election.go`:

1. `rf.role = Candidate`, `rf.currentTerm++`, `rf.votedFor = rf.me`, `rf.leaderID = -1`, `rf.persist()`, `rf.resetElectionTimer()`.
2. `term := rf.currentTerm`, and build a `RequestVoteArgs` with the last log index and term.
3. `votes := 1`. If `votes >= rf.majority()` already (a one-node cluster) call `rf.becomeLeader()` and return.
4. For each peer except yourself, `go func(peer int) { ... }(i)`: call `rf.sendRequestVote(peer, &args, &reply)`; if it succeeds, lock `rf.mu` and call `rf.handleVoteReply(term, &reply, &votes)`.

`votes` is shared by every goroutine. It is only read or written with `rf.mu` held, so it needs no atomics.
<!-- /lang -->

## Winning
<!-- mode: read-and-implement tasks:1.5 -->

### Stale replies are the whole difficulty

A reply to a vote request is only meaningful if the election it belongs to is still the current one. Check it in this order:

```plaintext
  handleVoteReply(term, reply, votes):
     if reply.Term > currentTerm:  becomeFollower(reply.Term); return    ← someone is ahead of us
     if role != Candidate or currentTerm != term:  return                ← a reply to an old election
     if reply.VoteGranted:  votes++ ; if votes >= majority: becomeLeader()
```

Without the second check, a grant from term 4 can be counted toward term 6, handing a node a majority it never won. The harness's one-leader-per-term monitor is there to catch exactly that.

### Taking the job

`becomeLeader` is short: set the role, remember who the leader is (yourself), reset the per-follower progress that chapter 2 will use, and **send a heartbeat immediately**. Waiting for the next tick would give a slow follower time to time out and start a competing election.

<!-- lang: go -->
### `TODO(1.5)` — `handleVoteReply` and `becomeLeader`

In `internal/raft/election.go`:

- `handleVoteReply`: the three checks above. Reaching `rf.majority()` votes calls `rf.becomeLeader()`.
- `becomeLeader`: `rf.role = Leader`, `rf.leaderID = rf.me`, `rf.resetLeaderProgress()`, `rf.broadcastAppend()`.

`broadcastAppend` is given: in this chapter it sends empty heartbeats.
<!-- /lang -->

## Try it
<!-- mode: read-only -->

<!-- lang: go -->
```bash
make test     # every acceptance test
make race     # the same tests with the race detector
make run      # a REPL over a 3-node cluster
```
<!-- /lang -->

Try the REPL:

```plaintext
> status
node 0  follower  term 1   votedFor 2  log 0   commit 0   applied 0
node 1  follower  term 1   votedFor 2  log 0   commit 0   applied 0
node 2  leader    term 1   votedFor 2  log 0   commit 0   applied 0
> cut 2
> status            (a second later)
node 0  leader    term 2   votedFor 0  log 0   commit 0   applied 0
node 1  follower  term 2   votedFor 0  log 0   commit 0   applied 0
node 2  leader    term 1   votedFor 2  log 0   commit 0   applied 0
> heal
> status
node 2  follower  term 2   ...
```

Node 2 still believes it leads term 1 while it is cut off. That is allowed: it cannot do anything with the belief, and the moment it hears term 2 it steps down.

> [!check] Before you move on
> Say these out loud:
>
> 1. A node votes at most once per term, and that is why a term has at most one leader.
> 2. Any message with a higher term makes the receiver adopt it and become a follower.
> 3. A candidate counts a vote only if it is still a candidate in the term it asked.
> 4. A node cut off from the majority can raise its term forever and still never lead.
> 5. Randomized timeouts keep split votes from repeating.
