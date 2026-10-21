package raft

// Wire format of the two RPCs. Field names are exported so gob can carry them.

// RequestVoteArgs asks for a vote.
type RequestVoteArgs struct {
	Term         int // candidate's term
	CandidateID  int
	LastLogIndex int // index of the candidate's last log entry
	LastLogTerm  int // term of the candidate's last log entry
}

// RequestVoteReply answers it.
type RequestVoteReply struct {
	Term        int // the voter's current term, so a stale candidate can step down
	VoteGranted bool
}

// AppendEntriesArgs carries log entries, or none: then it is a heartbeat.
type AppendEntriesArgs struct {
	Term         int // leader's term
	LeaderID     int
	PrevLogIndex int // index of the entry just before Entries
	PrevLogTerm  int // term of that entry
	Entries      []LogEntry
	LeaderCommit int // leader's commitIndex
}

// AppendEntriesReply answers it.
type AppendEntriesReply struct {
	Term    int
	Success bool
	// ConflictIndex is set when Success is false because the logs disagree
	// at PrevLogIndex: the first index the leader should try again from.
	ConflictIndex int
}

const (
	methodRequestVote   = "Raft.RequestVote"
	methodAppendEntries = "Raft.AppendEntries"
)

// sendRequestVote calls peer's RequestVote. It blocks, so never call it with
// mu held. It returns false if the call was lost.
func (rf *Raft) sendRequestVote(peer int, args *RequestVoteArgs, reply *RequestVoteReply) bool {
	return rf.peers[peer].Call(methodRequestVote, args, reply)
}

// sendAppendEntries calls peer's AppendEntries. It blocks, so never call it
// with mu held. It returns false if the call was lost.
func (rf *Raft) sendAppendEntries(peer int, args *AppendEntriesArgs, reply *AppendEntriesReply) bool {
	return rf.peers[peer].Call(methodAppendEntries, args, reply)
}
