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

	// The log must contain PrevLogIndex with the leader's term, or appending
	// after it would leave a hole or splice onto a different history.
	if args.PrevLogIndex > rf.lastLogIndex() {
		reply.ConflictIndex = rf.lastLogIndex() + 1
		return
	}
	if t := rf.log[args.PrevLogIndex].Term; t != args.PrevLogTerm {
		// Skip the whole run of entries from the conflicting term at once.
		i := args.PrevLogIndex
		for i > 1 && rf.log[i-1].Term == t {
			i--
		}
		reply.ConflictIndex = i
		return
	}

	rf.appendToLog(args.PrevLogIndex, args.Entries)
	rf.followerAdvanceCommit(args.LeaderCommit, args.PrevLogIndex+len(args.Entries))
	reply.Success = true
}

// appendToLog places entries after prevIndex. An entry that matches what the
// log already holds at its index is left alone; at the first entry that does
// not match, the log is cut there and the rest of entries are appended.
// Matching entries are never truncated: a delayed or duplicated RPC can carry
// a shorter prefix of what we already have. mu held.
func (rf *Raft) appendToLog(prevIndex int, entries []LogEntry) {
	changed := false
	for k, e := range entries {
		idx := prevIndex + 1 + k
		if idx <= rf.lastLogIndex() {
			if rf.log[idx].Term == e.Term {
				continue
			}
			rf.log = rf.log[:idx]
		}
		rf.log = append(rf.log, e)
		changed = true
	}
	if changed {
		rf.persist()
	}
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
	rf.mu.Lock()
	if rf.killed() || rf.role != Leader {
		rf.mu.Unlock()
		return
	}
	next := rf.nextIndex[peer]
	args := AppendEntriesArgs{
		Term:         rf.currentTerm,
		LeaderID:     rf.me,
		PrevLogIndex: next - 1,
		PrevLogTerm:  rf.log[next-1].Term,
		Entries:      append([]LogEntry(nil), rf.log[next:]...),
		LeaderCommit: rf.commitIndex,
	}
	rf.mu.Unlock()

	var reply AppendEntriesReply
	if !rf.sendAppendEntries(peer, &args, &reply) {
		return
	}

	rf.mu.Lock()
	defer rf.mu.Unlock()
	if reply.Term > rf.currentTerm {
		rf.becomeFollower(reply.Term)
		return
	}
	// Stale reply: we are no longer the leader of the term we sent in.
	if rf.role != Leader || rf.currentTerm != args.Term {
		return
	}

	if reply.Success {
		// Replies can be duplicated or reordered, so only ever move forward.
		match := args.PrevLogIndex + len(args.Entries)
		if match > rf.matchIndex[peer] {
			rf.matchIndex[peer] = match
		}
		if rf.nextIndex[peer] < rf.matchIndex[peer]+1 {
			rf.nextIndex[peer] = rf.matchIndex[peer] + 1
		}
		rf.advanceCommit()
		return
	}

	// The follower's log disagrees at PrevLogIndex: back up and retry now.
	back := max(reply.ConflictIndex, 1)
	if back < rf.nextIndex[peer] {
		rf.nextIndex[peer] = max(back, rf.matchIndex[peer]+1)
		go rf.replicateTo(peer)
	}
}

// Start asks the cluster to replicate command. Only a leader accepts it: it
// appends the command to its own log and starts replicating. It returns the
// index and term the command will have if it is ever committed, and whether
// this node thought it was the leader. A true result is not a promise: the
// leader may lose power before the entry is committed.
func (rf *Raft) Start(command []byte) (index, term int, isLeader bool) {
	rf.mu.Lock()
	defer rf.mu.Unlock()
	if rf.killed() || rf.role != Leader {
		return -1, rf.currentTerm, false
	}
	rf.log = append(rf.log, LogEntry{Term: rf.currentTerm, Command: append([]byte(nil), command...)})
	rf.persist()
	rf.broadcastAppend()
	return rf.lastLogIndex(), rf.currentTerm, true
}
