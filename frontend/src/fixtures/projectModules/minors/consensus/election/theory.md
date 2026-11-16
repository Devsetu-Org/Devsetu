## Election
<!-- mode: read-only -->

In the previous chapter you got the abstract shape of Raft: one leader per term, a replicated log, majority for safety. Now we dig in block by block. This chapter builds the first block: **who is in charge**.

![Raft stack chapter 1: election highlighted; later chapters are persistence, commit, replication, clients](/consensus/election/you-are-here.jpg)

> [!scope] This chapter's job
> A cluster of nodes that, when the network cooperates, settles on **exactly one leader**; that replaces it when it disappears; and that never lets a node cut off from the majority rule. No log yet. The leader sends empty heartbeats and that is all.

### What we are building

An **election** is how a Raft cluster picks a leader for a numbered **term**. Followers wait for heartbeats. Silence means the leader is gone (or was never there). One follower becomes a **candidate**, asks for votes, and — if a majority agrees — becomes leader and starts heartbeating so nobody else campaigns.

By the end of this chapter you have nodes that can:

- step down when they see a higher term
- grant at most one vote per term (and only to a candidate whose log is up to date)
- campaign concurrently and ignore stale replies
- take leadership and announce it immediately

No durable log yet — that is chapter 2. Persistence of the vote is a no-op hook for now; chapter 4 makes it real, and the calls you write here are what keep a restart safe.

### Three roles, one clock

Every node is always in one of three roles. Time is cut into numbered **terms**, and a term is Raft's logical clock: a higher term always means "later".

![Follower, candidate, and leader transitions; higher term always returns to follower](/consensus/election/roles-terms.jpg)

A follower waits. If it hears nothing from a leader for a **randomized election timeout**, it assumes the leader is gone, increments its term, votes for itself, and asks everybody else for a vote. A candidate that gets votes from a **majority** becomes the leader for that term and immediately sends heartbeats so nobody else starts an election.

### Two rules carry the whole protocol

1. **A node votes at most once per term.** Two candidates in one term cannot both reach a majority, because any two majorities share a node, and that node voted only once. So at most one leader per term.
2. **A higher term always wins.** Any message carrying a term higher than yours makes you adopt that term and become a follower. A stale leader or candidate cannot keep ruling after the cluster has moved on.

![Any two majorities share a node, so two candidates cannot both win the same term](/consensus/election/quorum.jpg)

A node cut off from the majority keeps timing out, keeps bumping its term, and keeps asking for votes nobody answers. It can **never** collect a majority, so it never leads. Its term runs far ahead, and that matters later: when the partition heals, its high term forces the whole cluster into a fresh election. Elections are cheap; two leaders are not.

> [!idea] Why randomized timeouts
> If every node used the same timeout they would all become candidates at the same instant, split the votes, and repeat forever. Each node picks a fresh random timeout (here 120 to 240 ms in tests) so one usually fires first and wins before the others wake up.

> [!tip] Majority is arithmetic
> With three nodes you need two votes (including your own). With five you need three. A partitioned singleton can raise its term forever and still never lead — that is the whole point of quorum.

### The test bench

There are no sockets. Each node is a Raft value, and they talk through `labrpc`, an in-process network that behaves like a bad real one: partitions, drops, duplicates, and delays. `labharness` wraps N nodes with a `Cluster`: disconnect, partition, crash, restart, check one leader. A background monitor samples every node several times per election timeout and fails the test the moment two nodes lead the same term — even if the test itself is looking elsewhere.

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
<!-- lang: python -->
### What is given

In `raftkv/raft`:

- `raft.py`: the `Raft` class, `make`, and a ticker thread that every few milliseconds checks the clock. A non-leader whose election deadline has passed calls your `start_election`; a leader whose heartbeat is due calls `broadcast_append`.
- `rpc.py`: the `RequestVoteArgs`/`Reply` and `AppendEntriesArgs`/`Reply` types.
- `replication.py`: just enough `append_entries` to carry heartbeats. Chapter 2 rewrites it.
- `persist.py`: `persist()` does nothing yet. **Call it anyway** whenever `current_term` or `voted_for` change. Chapter 4 makes it real, and the calls you write now will be what makes a restarted node safe.

> [!warn] The locking rule
> All state lives under `self.mu` (`threading.Lock`). Methods documented "mu held" run with the lock taken and must not take it again. **Never hold `self.mu` while calling `send_request_vote`**: an RPC can take tens of milliseconds, and the peer may be calling you at the same moment. Send without the lock, take it again for the reply.
<!-- /lang -->
<!-- lang: cpp -->
### What is given

In `src/raft`:

- `raft.cc` / `raft.h`: the `Raft` class, `Make`, and a ticker thread that every few milliseconds checks the clock. A non-leader whose election deadline has passed calls your `StartElection`; a leader whose heartbeat is due calls `BroadcastAppend`.
- `rpc` types: `RequestVoteArgs`/`Reply` and `AppendEntriesArgs`/`Reply`.
- `replication.cc`: just enough `AppendEntries` to carry heartbeats. Chapter 2 rewrites it.
- `persist.cc`: `Persist()` does nothing yet. **Call it anyway** whenever `current_term_` or `voted_for_` change. Chapter 4 makes it real, and the calls you write now will be what makes a restarted node safe.

> [!warn] The locking rule
> All state lives under `mu_`. Methods documented "mu held" run with the lock taken and must not take it again. **Never hold `mu_` while calling `SendRequestVote`**: an RPC can take tens of milliseconds, and the peer may be calling you at the same moment. Send without the lock, take it again for the reply.
<!-- /lang -->

## Votes and campaigns
<!-- mode: read-and-implement tasks:1.1,1.2,1.3,1.4 -->

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
<!-- lang: python -->
### `TODO(1.1)` — `become_follower`

In `raftkv/raft/election.py`:

- Set `self.role = FOLLOWER`.
- Only when `term > self.current_term`: set `self.current_term = term`, `self.voted_for = -1`, `self.leader_id = -1`, and call `self.persist()`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(1.1)` — `BecomeFollower`

In `src/raft/election.cc`:

- Set `role_ = Role::Follower`.
- Only when `term > current_term_`: set `current_term_ = term`, `voted_for_ = -1`, `leader_id_ = -1`, and call `Persist()`.
<!-- /lang -->

### The election restriction

Chapter 2 gives nodes logs, and a leader's log becomes everyone's log. If a node with a stale log could win, committed entries would vanish. So a node refuses to vote for a candidate whose log is **less up to date** than its own. "Up to date" compares the last entries:

1. A later **last term** is more up to date.
2. With equal last terms, the **longer** log is.

![Compare last term first; only then compare length — later term beats a longer older log](/consensus/election/election-restriction.jpg)

The logs are empty in this chapter, so every candidate passes. Write the function anyway: the tests seed logs directly, and chapter 2 depends on it.

<!-- lang: go -->
### `TODO(1.2)` — `logUpToDate`

In `internal/raft/vote.go`. Use `rf.lastLogTerm()` and `rf.lastLogIndex()`. Compare terms first; only when they are equal compare lengths.
<!-- /lang -->
<!-- lang: python -->
### `TODO(1.2)` — `log_up_to_date`

In `raftkv/raft/vote.py`. Use `self.last_log_term()` and `self.last_log_index()`. Compare terms first; only when they are equal compare lengths.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(1.2)` — `LogUpToDate`

In `src/raft/vote.cc`. Use `LastLogTerm()` and `LastLogIndex()`. Compare terms first; only when they are equal compare lengths.
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
<!-- lang: python -->
### `TODO(1.3)` — `request_vote`

In `raftkv/raft/vote.py`, with the lock held for the whole function:

1. If `args.term > self.current_term`, `self.become_follower(args.term)`.
2. Build a `RequestVoteReply` with `term=self.current_term` and `vote_granted=False`.
3. If `args.term < self.current_term`, return that reply.
4. If `self.voted_for` is `-1` or `args.candidate_id`, and `self.log_up_to_date(args.last_log_term, args.last_log_index)`: set `self.voted_for`, `self.persist()`, `self.reset_election_timer()`, `vote_granted=True`.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(1.3)` — `RequestVote`

In `src/raft/vote.cc`, with the lock held for the whole function:

1. If `args.term > current_term_`, `BecomeFollower(args.term)`.
2. Set `reply.term = current_term_` and `reply.vote_granted = false`.
3. If `args.term < current_term_`, return.
4. If `voted_for_` is `-1` or `args.candidate_id`, and `LogUpToDate(args.last_log_term, args.last_log_index)`: set `voted_for_`, `Persist()`, `ResetElectionTimer()`, `reply.vote_granted = true`.
<!-- /lang -->

### Ask everyone at once

When the ticker finds the election deadline passed it calls `startElection` with the lock held. The candidate

1. becomes a candidate, increments the term, votes for itself, saves that, and arms a new election timer (if this election fails, a new one starts after another random timeout);
2. sends `RequestVote` to every other node **concurrently**, so a slow or dead peer cannot delay the rest;
3. counts replies as they arrive.

```plaintext
   startElection (lock held)                    worker per peer
   ─────────────────────────                    ──────────────────
   term++ ; votedFor = me
   args := {term, me, lastLog}
   for each peer ───────────────────────────▶   send RequestVote   (no lock held)
   return                                       lock ; handleVoteReply ; unlock
```

The workers outlive `startElection`, and the world moves while they wait. By the time a reply arrives this node may have become leader, lost to another candidate, or started a later election in a higher term. The next page is about handling that.

<!-- lang: go -->
### `TODO(1.4)` — `startElection`

In `internal/raft/election.go`:

1. `rf.role = Candidate`, `rf.currentTerm++`, `rf.votedFor = rf.me`, `rf.leaderID = -1`, `rf.persist()`, `rf.resetElectionTimer()`.
2. `term := rf.currentTerm`, and build a `RequestVoteArgs` with the last log index and term.
3. `votes := 1`. If `votes >= rf.majority()` already (a one-node cluster) call `rf.becomeLeader()` and return.
4. For each peer except yourself, `go func(peer int) { ... }(i)`: call `rf.sendRequestVote(peer, &args, &reply)`; if it succeeds, lock `rf.mu` and call `rf.handleVoteReply(term, &reply, &votes)`.

`votes` is shared by every goroutine. It is only read or written with `rf.mu` held, so it needs no atomics.
<!-- /lang -->
<!-- lang: python -->
### `TODO(1.4)` — `start_election`

In `raftkv/raft/election.py`:

1. `self.role = CANDIDATE`, `self.current_term += 1`, `self.voted_for = self.me`, `self.leader_id = -1`, `self.persist()`, `self.reset_election_timer()`.
2. `term = self.current_term`, and build a `RequestVoteArgs` with the last log index and term.
3. `votes = [1]`. If `votes[0] >= self.majority()` already (a one-node cluster) call `self.become_leader()` and return.
4. For each peer except yourself, start a daemon `threading.Thread`: call `self.send_request_vote(peer, args)`; if it succeeds, take `self.mu` and call `self.handle_vote_reply(term, reply, votes)`.

`votes` is a one-element list shared by every thread. It is only read or written with `self.mu` held.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(1.4)` — `StartElection`

In `src/raft/election.cc`:

1. `role_ = Role::Candidate`, `current_term_++`, `voted_for_ = me_`, `leader_id_ = -1`, `Persist()`, `ResetElectionTimer()`.
2. Capture `term = current_term_`, and build a `RequestVoteArgs` with the last log index and term.
3. `votes = 1`. If `votes >= Majority()` already (a one-node cluster) call `BecomeLeader()` and return.
4. For each peer except yourself, start a thread: call `SendRequestVote`; if it succeeds, lock `mu_` and call `HandleVoteReply(term, reply, votes)`.

`votes` is shared by every thread. It is only read or written with `mu_` held.
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
<!-- lang: python -->
### `TODO(1.5)` — `handle_vote_reply` and `become_leader`

In `raftkv/raft/election.py`:

- `handle_vote_reply`: the three checks above. Reaching `self.majority()` votes calls `self.become_leader()`. `votes` is a one-element list; increment `votes[0]`.
- `become_leader`: `self.role = LEADER`, `self.leader_id = self.me`, `self.reset_leader_progress()`, `self.broadcast_append()`.

`broadcast_append` is given: in this chapter it sends empty heartbeats.
<!-- /lang -->
<!-- lang: cpp -->
### `TODO(1.5)` — `HandleVoteReply` and `BecomeLeader`

In `src/raft/election.cc`:

- `HandleVoteReply`: the three checks above. Reaching `Majority()` votes calls `BecomeLeader()`.
- `BecomeLeader`: `role_ = Role::Leader`, `leader_id_ = me_`, `ResetLeaderProgress()`, `BroadcastAppend()`.

`BroadcastAppend` is given: in this chapter it sends empty heartbeats.
<!-- /lang -->

### Try it

<!-- lang: go -->
```bash
make test     # every acceptance test
make race     # the same tests with the race detector
make run      # a REPL over a 3-node cluster
```
<!-- /lang -->
<!-- lang: python -->
```bash
make test     # every acceptance test
make run      # a REPL over a 3-node cluster
```
<!-- /lang -->
<!-- lang: cpp -->
```bash
make test     # every acceptance test
make asan     # AddressSanitizer build of the same tests
make run      # a REPL over a 3-node cluster
```
<!-- /lang -->

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
> 1. A node votes at most once per term, and that is why a term has at most one leader.
> 2. Any message with a higher term makes the receiver adopt it and become a follower.
> 3. A candidate counts a vote only if it is still a candidate in the term it asked.
> 4. A node cut off from the majority can raise its term forever and still never lead.
> 5. Randomized timeouts keep split votes from repeating.

A leader with nothing to lead is not much use. Chapter 2 adds the **log**: AppendEntries, conflict repair, and `Start`, so the leader can copy commands to followers.
