package raft

// Chapter 4 replaces this file. Until then a node forgets everything when it
// stops, which is fine while nothing restarts. The call sites are already in
// place: the code you write in chapters 1 and 2 calls persist() whenever
// currentTerm, votedFor or the log change.

// persist saves currentTerm, votedFor and the log. mu held.
func (rf *Raft) persist() {}

// readPersist restores what persist saved. Make calls it before any
// goroutine starts.
func (rf *Raft) readPersist() {}
