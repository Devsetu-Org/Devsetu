package raft

// RequestVote is the RPC handler a candidate calls to ask for our vote.
func (rf *Raft) RequestVote(args *RequestVoteArgs, reply *RequestVoteReply) {
	// ── TODO(1.3) — decide a vote ──────────────────────────────────────────
	panic("TODO(1.3)")
}

// logUpToDate reports whether a candidate whose last entry is
// (lastTerm, lastIndex) has a log at least as up to date as ours. mu held.
func (rf *Raft) logUpToDate(lastTerm, lastIndex int) bool {
	// ── TODO(1.2) — the election restriction ───────────────────────────────
	panic("TODO(1.2)")
}
