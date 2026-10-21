package raft

// RequestVote is the RPC handler a candidate calls to ask for our vote.
func (rf *Raft) RequestVote(args *RequestVoteArgs, reply *RequestVoteReply) {
	// ── TODO(1.3) — decide a vote ──────────────────────────────────────────
	//
	// Take the lock (defer the unlock), then:
	//
	//  1. If args.Term is newer than ours, becomeFollower(args.Term) first, so
	//     the rest is decided in the candidate's term.
	//  2. Fill reply.Term with our current term and start with
	//     reply.VoteGranted = false.
	//  3. If args.Term is older than ours, refuse.
	//  4. Grant the vote only if we have not voted this term, or already voted
	//     for this very candidate (its first reply may have been lost), and
	//     logUpToDate says its log is at least as good as ours.
	//  5. On a grant: set rf.votedFor, call rf.persist(), call
	//     rf.resetElectionTimer(), and set reply.VoteGranted.
	//
	// Do not reset the election timer when you refuse: a candidate we reject
	// must not be able to keep us from ever campaigning.
	panic("TODO(1.3): RequestVote — grant at most one vote per term")
}

// logUpToDate reports whether a candidate whose last entry is
// (lastTerm, lastIndex) has a log at least as up to date as ours. mu held.
func (rf *Raft) logUpToDate(lastTerm, lastIndex int) bool {
	// ── TODO(1.2) — the election restriction ───────────────────────────────
	//
	// Compare last log terms first: the later term is more up to date. If the
	// terms are equal, the longer log is. Equal logs are up to date.
	//
	// Use rf.lastLogTerm() and rf.lastLogIndex().
	panic("TODO(1.2): logUpToDate — later last term wins, then longer log")
}
