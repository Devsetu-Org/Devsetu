package raft

// persistentState is what a node must remember across a crash: the three
// things Raft's safety argument depends on. Add "bytes" and "encoding/gob" to
// the imports when you use them.
type persistentState struct {
	CurrentTerm int
	VotedFor    int
	Log         []LogEntry // including the index-0 sentinel
}

// persist writes currentTerm, votedFor and the log to the store. Call sites
// already exist in vote.go, election.go and replication.go. mu held.
func (rf *Raft) persist() {
	// ── TODO(4.1) — save the three durable fields ──────────────────────────
}

// readPersist restores the state saved by persist, if any. Make calls it once
// before any goroutine starts, so no lock is needed.
func (rf *Raft) readPersist() {
	// ── TODO(4.2) — come back as the node that crashed ─────────────────────
}
