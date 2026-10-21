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
	//
	// The leader says "the entry before these is (PrevLogIndex, PrevLogTerm)".
	// Appending after anything else would leave a hole or splice onto a
	// different history.
	//
	//  - If PrevLogIndex is past our last entry, set reply.ConflictIndex to
	//    rf.lastLogIndex()+1 and return (Success stays false).
	//  - If we have that index but with a different term t, set
	//    reply.ConflictIndex to the FIRST index of our run of term-t entries
	//    (walk back while the previous entry also has term t, never below 1),
	//    and return. The leader then skips the whole run in one step.
	//
	// When the check passes, call rf.appendToLog(args.PrevLogIndex,
	// args.Entries), then rf.followerAdvanceCommit(args.LeaderCommit,
	// args.PrevLogIndex+len(args.Entries)) (a no-op until chapter 3), and set
	// reply.Success = true.
	panic("TODO(2.1): AppendEntries — check PrevLogIndex/PrevLogTerm, report ConflictIndex")
}

// appendToLog places entries after prevIndex. mu held.
func (rf *Raft) appendToLog(prevIndex int, entries []LogEntry) {
	// ── TODO(2.2) — truncate only on a real conflict ───────────────────────
	//
	// Walk entries; entry k belongs at index prevIndex+1+k.
	//
	//  - If that index is inside our log and the terms match, the entry is
	//    already there: skip it. Do NOT truncate. A delayed or duplicated RPC
	//    can carry a shorter prefix of what we have, and cutting the log back
	//    would throw away entries we already acknowledged.
	//  - If the index is inside our log and the terms differ, cut the log at
	//    that index (rf.log = rf.log[:idx]) and fall through to append.
	//  - Past the end of the log, append the entry.
	//
	// If anything changed, call rf.persist() once at the end.
	panic("TODO(2.2): appendToLog — skip matching entries, cut at the first conflict")
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
	//
	// Under the lock: return if killed or not the leader. Build the args from
	// rf.nextIndex[peer]: PrevLogIndex = next-1, PrevLogTerm = that entry's
	// term, Entries = a COPY of rf.log[next:] (the log may change while the
	// RPC is in flight), LeaderCommit = rf.commitIndex. Unlock, then send.
	//
	// After a reply, lock again and:
	//  - reply.Term > rf.currentTerm: becomeFollower(reply.Term), return.
	//  - Ignore the reply unless we are still the leader of args.Term.
	//  - Success: matchIndex[peer] = PrevLogIndex+len(Entries), but only ever
	//    upward (replies can be duplicated or reordered); then
	//    nextIndex[peer] = matchIndex[peer]+1 (never lower than it was), and
	//    call rf.advanceCommit() (a no-op until chapter 3).
	//  - Failure: back nextIndex[peer] up to reply.ConflictIndex (at least 1,
	//    never at or below matchIndex[peer]), but only if that moves it down,
	//    and retry at once with `go rf.replicateTo(peer)`.
	panic("TODO(2.3): replicateTo — send entries from nextIndex, track matchIndex, back up on refusal")
}

// Start asks the cluster to replicate command. Only a leader accepts it. It
// returns the index and term the command will have if it is ever committed,
// and whether this node thought it was the leader. A true result is not a
// promise: the leader may lose power before the entry is committed.
func (rf *Raft) Start(command []byte) (index, term int, isLeader bool) {
	// ── TODO(2.4) — accept a command ───────────────────────────────────────
	//
	// Under the lock: if killed or not the leader, return -1, rf.currentTerm,
	// false. Otherwise append LogEntry{Term: rf.currentTerm, Command: a copy
	// of command}, rf.persist(), rf.broadcastAppend(), and return the new
	// entry's index, the current term, and true.
	panic("TODO(2.4): Start — append to the leader's log and replicate")
}
