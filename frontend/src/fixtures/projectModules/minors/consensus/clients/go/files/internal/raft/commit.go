package raft

// advanceCommit is the leader's commit rule: find the highest log index N that
// a majority stores and whose entry is from the current term, and commit it.
// Entries from older terms commit only as a side effect of a current-term
// entry above them. mu held.
func (rf *Raft) advanceCommit() {
	if rf.role != Leader {
		return
	}
	for n := rf.lastLogIndex(); n > rf.commitIndex; n-- {
		if rf.log[n].Term != rf.currentTerm {
			// Terms never decrease along a log, so everything below is older too.
			return
		}
		replicas := 1 // the leader itself
		for i := range rf.peers {
			if i != rf.me && rf.matchIndex[i] >= n {
				replicas++
			}
		}
		if replicas >= rf.majority() {
			rf.commitIndex = n
			rf.applyCond.Broadcast()
			return
		}
	}
}

// followerAdvanceCommit moves commitIndex toward what the leader says is
// committed, but never past lastNew, the last entry this RPC proved matches
// the leader's log. Entries beyond it may still be from a dead history. mu held.
func (rf *Raft) followerAdvanceCommit(leaderCommit, lastNew int) {
	c := min(leaderCommit, lastNew)
	if c > rf.commitIndex {
		rf.commitIndex = c
		rf.applyCond.Broadcast()
	}
}

// applyLoop hands committed entries to the state machine, in order, exactly
// once, until Kill. It runs in its own goroutine.
func (rf *Raft) applyLoop() {
	rf.mu.Lock()
	defer rf.mu.Unlock()
	for !rf.killed() {
		if rf.lastApplied >= rf.commitIndex {
			rf.applyCond.Wait()
			continue
		}
		first := rf.lastApplied + 1
		batch := append([]LogEntry(nil), rf.log[first:rf.commitIndex+1]...)
		rf.lastApplied = rf.commitIndex
		// Apply runs user code and may be slow: never hold the lock for it.
		rf.mu.Unlock()
		for k, e := range batch {
			if rf.killed() {
				break
			}
			if rf.sm != nil {
				rf.sm.Apply(first+k, e.Command)
			}
		}
		rf.mu.Lock()
	}
}
