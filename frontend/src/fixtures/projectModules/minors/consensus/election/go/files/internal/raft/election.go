package raft

// becomeFollower steps down to follower. If term is newer than ours we adopt
// it and forget our vote: votes belong to a term. mu held.
func (rf *Raft) becomeFollower(term int) {
	// ── TODO(1.1) — a higher term always wins ──────────────────────────────
	//
	// Set rf.role to Follower.
	//
	// Only if term > rf.currentTerm: adopt it (rf.currentTerm = term), clear
	// the vote (rf.votedFor = -1) and the leader hint (rf.leaderID = -1), then
	// rf.persist().
	//
	// A call with the same term must keep votedFor. A candidate that loses to
	// a leader of its own term steps down through here, and it already voted
	// for itself.
	panic("TODO(1.1): becomeFollower — adopt the newer term, clear the vote")
}

// startElection turns this node into a candidate for a new term and asks every
// peer for a vote. It returns right away; the replies are counted by
// goroutines that finish later. mu held.
func (rf *Raft) startElection() {
	// ── TODO(1.4) — campaign ───────────────────────────────────────────────
	//
	//  1. rf.role = Candidate, rf.currentTerm++, vote for ourselves
	//     (rf.votedFor = rf.me), rf.leaderID = -1, rf.persist(), and
	//     rf.resetElectionTimer().
	//  2. Remember the term in a local variable and build one RequestVoteArgs
	//     from it and our last log entry.
	//  3. Keep a vote tally in a local `votes := 1` (our own). If that already
	//     makes a majority (a one-node cluster), rf.becomeLeader() and return.
	//  4. For every peer except ourselves, start a goroutine that calls
	//     rf.sendRequestVote WITHOUT holding the lock, and on success takes the
	//     lock and calls rf.handleVoteReply(term, &reply, &votes).
	//
	// The goroutines share `votes` and `args`; votes is only touched with mu
	// held, args is only read.
	panic("TODO(1.4): startElection — new term, vote for self, ask everyone")
}

// handleVoteReply counts one reply to the election that began in term. votes
// is the running tally, guarded by mu. mu held.
func (rf *Raft) handleVoteReply(term int, reply *RequestVoteReply, votes *int) {
	// ── TODO(1.5) — count votes, ignore stale ones ─────────────────────────
	//
	//  1. If reply.Term > rf.currentTerm: becomeFollower(reply.Term), return.
	//  2. A reply can arrive long after its election. Ignore it unless we are
	//     still a Candidate AND rf.currentTerm == term.
	//  3. If the vote was granted, *votes++; at rf.majority() call
	//     rf.becomeLeader().
	panic("TODO(1.5): handleVoteReply — count only fresh, granted votes")
}

// becomeLeader takes over for the current term and announces it immediately,
// so followers stop their own election timers. mu held.
func (rf *Raft) becomeLeader() {
	// ── TODO(1.5) — win ────────────────────────────────────────────────────
	//
	// Set rf.role = Leader and rf.leaderID = rf.me, reset the leader's
	// per-follower progress with rf.resetLeaderProgress(), and send the first
	// heartbeat right away with rf.broadcastAppend().
	panic("TODO(1.5): becomeLeader — take the job and announce it")
}
