package raft

// Hooks for tests and the REPL. Production code never calls these.

// State is a consistent snapshot of one node.
type State struct {
	ID          int
	Term        int
	Role        Role
	VotedFor    int
	LeaderID    int
	Log         []LogEntry // real entries only: Log[0] is index 1
	CommitIndex int
	LastApplied int
}

// DebugState copies the node's state under the lock.
func (rf *Raft) DebugState() State {
	rf.mu.Lock()
	defer rf.mu.Unlock()
	return State{
		ID:          rf.me,
		Term:        rf.currentTerm,
		Role:        rf.role,
		VotedFor:    rf.votedFor,
		LeaderID:    rf.leaderID,
		Log:         append([]LogEntry(nil), rf.log[1:]...),
		CommitIndex: rf.commitIndex,
		LastApplied: rf.lastApplied,
	}
}

// DebugSeed overwrites the term and log, as if the node had lived through
// them. Call it before the node does anything else.
func (rf *Raft) DebugSeed(term int, entries []LogEntry) {
	rf.mu.Lock()
	defer rf.mu.Unlock()
	rf.currentTerm = term
	rf.log = append([]LogEntry{{}}, entries...)
	rf.persist()
}

// DebugElect makes the node start an election right now, as if its timer had
// fired. Tests use it with a huge election timeout to pick who campaigns.
func (rf *Raft) DebugElect() {
	rf.mu.Lock()
	defer rf.mu.Unlock()
	rf.startElection()
}
