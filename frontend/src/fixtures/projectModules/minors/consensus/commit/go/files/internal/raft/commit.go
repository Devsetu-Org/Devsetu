package raft

// advanceCommit is the leader's commit rule: find the highest log index N that
// a majority stores and whose entry is from the current term, and commit it.
// mu held.
func (rf *Raft) advanceCommit() {
	// ── TODO(3.1) — commit by majority, current term only ──────────────────
	panic("TODO(3.1)")
}

// followerAdvanceCommit moves commitIndex toward what the leader says is
// committed, but never past lastNew, the last entry this RPC proved matches
// the leader's log. mu held.
func (rf *Raft) followerAdvanceCommit(leaderCommit, lastNew int) {
	// ── TODO(3.2) — a follower trusts only what was verified ───────────────
	panic("TODO(3.2)")
}

// applyLoop hands committed entries to the state machine, in order, exactly
// once, until Kill. It runs in its own goroutine.
func (rf *Raft) applyLoop() {
	// ── TODO(3.3) — apply, in order, outside the lock ──────────────────────
	panic("TODO(3.3)")
}
