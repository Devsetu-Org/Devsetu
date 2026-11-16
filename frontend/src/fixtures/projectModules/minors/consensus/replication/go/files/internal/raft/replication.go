package raft

import "time"

// AppendEntries is the RPC handler a leader calls to replicate entries, or,
// with none, to say "I am still here".
func (rf *Raft) AppendEntries(args *AppendEntriesArgs, reply *AppendEntriesReply) {
	rf.mu.Lock()
	defer rf.mu.Unlock()

	reply.Term = rf.currentTerm
	reply.Success = false
	if args.Term < rf.currentTerm {
		return // a deposed leader; its reply carries our term so it steps down
	}

	// The sender leads this term. Follow it, and do not start an election.
	rf.becomeFollower(args.Term)
	rf.leaderID = args.LeaderID
	rf.resetElectionTimer()
	reply.Term = rf.currentTerm

	// ── TODO(2.1) — refuse a log that does not line up ─────────────────────
	panic("TODO(2.1)")
}

// appendToLog places entries after prevIndex. mu held.
func (rf *Raft) appendToLog(prevIndex int, entries []LogEntry) {
	// ── TODO(2.2) — truncate only on a real conflict ───────────────────────
	panic("TODO(2.2)")
}

// broadcastAppend sends every follower whatever it is missing, or a heartbeat
// if it is up to date. It returns at once. mu held.
func (rf *Raft) broadcastAppend() {
	rf.lastBroadcast = time.Now()
	for i := range rf.peers {
		if i != rf.me {
			go rf.replicateTo(i)
		}
	}
}

// replicateTo sends one AppendEntries to peer and acts on the answer. It takes
// the lock itself and releases it around the RPC.
func (rf *Raft) replicateTo(peer int) {
	// ── TODO(2.3) — catch one follower up ──────────────────────────────────
	panic("TODO(2.3)")
}

// Start asks the cluster to replicate command. Only a leader accepts it. It
// returns the index and term the command will have if it is ever committed,
// and whether this node thought it was the leader. A true result is not a
// promise: the leader may lose power before the entry is committed.
func (rf *Raft) Start(command []byte) (index, term int, isLeader bool) {
	// ── TODO(2.4) — accept a command ───────────────────────────────────────
	panic("TODO(2.4)")
}
