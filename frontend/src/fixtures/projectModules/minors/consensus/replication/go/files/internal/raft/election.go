package raft

// becomeFollower steps down to follower. If term is newer than ours we adopt
// it and forget our vote: votes belong to a term. A same-term call keeps the
// vote, so a candidate that loses to a leader cannot vote twice. mu held.
func (rf *Raft) becomeFollower(term int) {
	rf.role = Follower
	if term > rf.currentTerm {
		rf.currentTerm = term
		rf.votedFor = -1
		rf.leaderID = -1
		rf.persist()
	}
}

// startElection turns this node into a candidate for a new term and asks every
// peer for a vote. It returns right away; the replies are counted by
// goroutines that finish later. mu held.
func (rf *Raft) startElection() {
	rf.role = Candidate
	rf.currentTerm++
	rf.votedFor = rf.me
	rf.leaderID = -1
	rf.persist()
	rf.resetElectionTimer()

	term := rf.currentTerm
	args := RequestVoteArgs{
		Term:         term,
		CandidateID:  rf.me,
		LastLogIndex: rf.lastLogIndex(),
		LastLogTerm:  rf.lastLogTerm(),
	}
	votes := 1 // our own
	if votes >= rf.majority() {
		rf.becomeLeader()
		return
	}
	for i := range rf.peers {
		if i == rf.me {
			continue
		}
		go func(peer int) {
			var reply RequestVoteReply
			if !rf.sendRequestVote(peer, &args, &reply) {
				return
			}
			rf.mu.Lock()
			defer rf.mu.Unlock()
			rf.handleVoteReply(term, &reply, &votes)
		}(i)
	}
}

// handleVoteReply counts one reply to the election that began in term. votes
// is the running tally, guarded by mu. mu held.
func (rf *Raft) handleVoteReply(term int, reply *RequestVoteReply, votes *int) {
	if reply.Term > rf.currentTerm {
		rf.becomeFollower(reply.Term)
		return
	}
	// A reply can arrive long after the election it belongs to: we may have
	// won, lost, or moved to a later term. Count it only if nothing changed.
	if rf.role != Candidate || rf.currentTerm != term || !reply.VoteGranted {
		return
	}
	*votes++
	if *votes >= rf.majority() {
		rf.becomeLeader()
	}
}

// becomeLeader takes over for the current term and announces it immediately,
// so followers stop their own election timers. mu held.
func (rf *Raft) becomeLeader() {
	rf.role = Leader
	rf.leaderID = rf.me
	rf.resetLeaderProgress()
	rf.broadcastAppend()
}
