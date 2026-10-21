package raft

// RequestVote is the RPC handler a candidate calls to ask for our vote.
func (rf *Raft) RequestVote(args *RequestVoteArgs, reply *RequestVoteReply) {
	rf.mu.Lock()
	defer rf.mu.Unlock()

	// A newer term means whatever we were doing is stale: step down first, so
	// the vote below is decided in the candidate's term.
	if args.Term > rf.currentTerm {
		rf.becomeFollower(args.Term)
	}

	reply.Term = rf.currentTerm
	reply.VoteGranted = false

	if args.Term < rf.currentTerm {
		return
	}
	// One vote per term. Granting the same candidate twice is fine: its first
	// reply may have been lost, and it is asking again.
	canVote := rf.votedFor == -1 || rf.votedFor == args.CandidateID
	if canVote && rf.logUpToDate(args.LastLogTerm, args.LastLogIndex) {
		rf.votedFor = args.CandidateID
		rf.persist()
		rf.resetElectionTimer()
		reply.VoteGranted = true
	}
}

// logUpToDate reports whether a candidate whose last entry is
// (lastTerm, lastIndex) has a log at least as up to date as ours. A later last
// term wins; with equal last terms, the longer log wins. mu held.
func (rf *Raft) logUpToDate(lastTerm, lastIndex int) bool {
	if lastTerm != rf.lastLogTerm() {
		return lastTerm > rf.lastLogTerm()
	}
	return lastIndex >= rf.lastLogIndex()
}
