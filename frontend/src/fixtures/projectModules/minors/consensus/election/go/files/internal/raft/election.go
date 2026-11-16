package raft

// becomeFollower steps down to follower. If term is newer than ours we adopt
// it and forget our vote: votes belong to a term. mu held.
func (rf *Raft) becomeFollower(term int) {
	// ── TODO(1.1) — a higher term always wins ──────────────────────────────
	panic("TODO(1.1)")
}

// startElection turns this node into a candidate for a new term and asks every
// peer for a vote. It returns right away; the replies are counted by
// goroutines that finish later. mu held.
func (rf *Raft) startElection() {
	// ── TODO(1.4) — campaign ───────────────────────────────────────────────
	panic("TODO(1.4)")
}

// handleVoteReply counts one reply to the election that began in term. votes
// is the running tally, guarded by mu. mu held.
func (rf *Raft) handleVoteReply(term int, reply *RequestVoteReply, votes *int) {
	// ── TODO(1.5) — count votes, ignore stale ones ─────────────────────────
	panic("TODO(1.5)")
}

// becomeLeader takes over for the current term and announces it immediately,
// so followers stop their own election timers. mu held.
func (rf *Raft) becomeLeader() {
	// ── TODO(1.5) — win ────────────────────────────────────────────────────
	panic("TODO(1.5)")
}
