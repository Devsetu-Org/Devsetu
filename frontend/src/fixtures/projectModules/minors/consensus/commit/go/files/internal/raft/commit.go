package raft

// advanceCommit is the leader's commit rule: find the highest log index N that
// a majority stores and whose entry is from the current term, and commit it.
// mu held.
func (rf *Raft) advanceCommit() {
	// ── TODO(3.1) — commit by majority, current term only ──────────────────
	//
	// Do nothing unless we are the leader. Then try N from rf.lastLogIndex()
	// down to rf.commitIndex+1:
	//
	//  - If rf.log[N].Term != rf.currentTerm, stop. Terms never decrease along
	//    a log, so every lower index is older too. An entry from an earlier
	//    term may be on a majority and still be overwritten by a later leader
	//    (Figure 8 in the Raft paper); it commits only as a side effect of a
	//    current-term entry above it.
	//  - Count replicas: the leader itself (1) plus every peer i != rf.me with
	//    rf.matchIndex[i] >= N.
	//  - At rf.majority() replicas, set rf.commitIndex = N, wake the apply
	//    loop with rf.applyCond.Broadcast(), and return.
	panic("TODO(3.1): advanceCommit — majority matchIndex, current-term entries only")
}

// followerAdvanceCommit moves commitIndex toward what the leader says is
// committed, but never past lastNew, the last entry this RPC proved matches
// the leader's log. mu held.
func (rf *Raft) followerAdvanceCommit(leaderCommit, lastNew int) {
	// ── TODO(3.2) — a follower trusts only what was verified ───────────────
	//
	// Entries after lastNew may be from a dead history that the leader has not
	// overwritten yet, even if leaderCommit is larger. Compute
	// min(leaderCommit, lastNew); if that is above rf.commitIndex, move
	// commitIndex up to it and rf.applyCond.Broadcast(). commitIndex never goes
	// down.
	panic("TODO(3.2): followerAdvanceCommit — min(leaderCommit, last verified entry)")
}

// applyLoop hands committed entries to the state machine, in order, exactly
// once, until Kill. It runs in its own goroutine.
func (rf *Raft) applyLoop() {
	// ── TODO(3.3) — apply, in order, outside the lock ──────────────────────
	//
	// Lock rf.mu for the whole loop (defer the unlock) and loop while
	// !rf.killed():
	//
	//  - If rf.lastApplied >= rf.commitIndex, rf.applyCond.Wait() and go
	//    round again (Wait releases the lock while it sleeps).
	//  - Otherwise copy the entries lastApplied+1 .. commitIndex out of the
	//    log, set rf.lastApplied = rf.commitIndex, UNLOCK, call
	//    rf.sm.Apply(index, command) for each in order (skip if rf.sm is nil,
	//    stop early if rf.killed()), then lock again.
	//
	// Apply is the state machine's code and may be slow or take its own locks:
	// never call it with rf.mu held. Only this goroutine applies, so order is
	// preserved even though the lock is dropped.
	panic("TODO(3.3): applyLoop — apply lastApplied+1..commitIndex in order, exactly once")
}
