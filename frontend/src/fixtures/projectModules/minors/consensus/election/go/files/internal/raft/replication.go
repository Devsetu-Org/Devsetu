package raft

import "time"

// Chapter 1 only needs heartbeats: empty AppendEntries that tell followers a
// leader is alive. Chapter 2 replaces this whole file with real replication.

// AppendEntries is the RPC handler a leader calls to say "I am still here".
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
	reply.Success = true
}

// broadcastAppend sends every follower a heartbeat. It returns at once. mu held.
func (rf *Raft) broadcastAppend() {
	rf.lastBroadcast = time.Now()
	for i := range rf.peers {
		if i != rf.me {
			go rf.sendHeartbeat(i)
		}
	}
}

func (rf *Raft) sendHeartbeat(peer int) {
	rf.mu.Lock()
	if rf.killed() || rf.role != Leader {
		rf.mu.Unlock()
		return
	}
	args := AppendEntriesArgs{Term: rf.currentTerm, LeaderID: rf.me}
	rf.mu.Unlock()

	var reply AppendEntriesReply
	if !rf.sendAppendEntries(peer, &args, &reply) {
		return
	}
	rf.mu.Lock()
	defer rf.mu.Unlock()
	if reply.Term > rf.currentTerm {
		rf.becomeFollower(reply.Term)
	}
}

// Start asks the cluster to replicate command. Not yet: there is no log
// replication until chapter 2, so nobody accepts.
func (rf *Raft) Start(command []byte) (index, term int, isLeader bool) {
	rf.mu.Lock()
	defer rf.mu.Unlock()
	return -1, rf.currentTerm, false
}
