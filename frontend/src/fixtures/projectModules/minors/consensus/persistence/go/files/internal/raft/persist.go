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
	//
	// Gob-encode a persistentState{rf.currentTerm, rf.votedFor, rf.log} into a
	// bytes.Buffer and hand the bytes to rf.store.Save. If Save fails, panic: a
	// node that cannot write must not keep answering as if it had, because the
	// reply it is about to send is a promise.
	//
	// persist is called with the lock held and BEFORE the RPC reply goes out.
}

// readPersist restores the state saved by persist, if any. Make calls it once
// before any goroutine starts, so no lock is needed.
func (rf *Raft) readPersist() {
	// ── TODO(4.2) — come back as the node that crashed ─────────────────────
	//
	// rf.store.Load returns nil on first boot: then leave the fresh state
	// alone. Otherwise gob-decode a persistentState and copy currentTerm,
	// votedFor and log back. Keep the sentinel: if the decoded log is empty,
	// use []LogEntry{{}}.
	//
	// Do not restore commitIndex or lastApplied. They are rebuilt: the leader
	// tells us what is committed, and the state machine replays from index 1.
}
