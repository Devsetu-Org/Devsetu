package raft

// Chapter 3 replaces this file. Until then nothing commits and nothing is
// applied: the hooks exist so replication can call them.

// advanceCommit is the leader's commit rule. mu held.
func (rf *Raft) advanceCommit() {}

// followerAdvanceCommit moves a follower's commitIndex toward leaderCommit,
// never past lastNew. mu held.
func (rf *Raft) followerAdvanceCommit(leaderCommit, lastNew int) {}

// applyLoop hands committed entries to the state machine until Kill.
func (rf *Raft) applyLoop() {}
