package raft

import (
	"bytes"
	"encoding/gob"
)

// persistentState is what a node must remember across a crash: the three
// things Raft's safety argument depends on.
type persistentState struct {
	CurrentTerm int
	VotedFor    int
	Log         []LogEntry // including the index-0 sentinel
}

// persist writes currentTerm, votedFor and the log to the store. Call it
// after every change to any of them and before replying to the RPC that caused
// the change. mu held.
func (rf *Raft) persist() {
	var buf bytes.Buffer
	state := persistentState{CurrentTerm: rf.currentTerm, VotedFor: rf.votedFor, Log: rf.log}
	if err := gob.NewEncoder(&buf).Encode(state); err != nil {
		panic("raft: encode state: " + err.Error())
	}
	if err := rf.store.Save(buf.Bytes()); err != nil {
		// A node that cannot write must not keep answering as if it had.
		panic("raft: save state: " + err.Error())
	}
}

// readPersist restores the state saved by persist, if any. Make calls it once
// before any goroutine starts, so no lock is needed.
func (rf *Raft) readPersist() {
	data, err := rf.store.Load()
	if err != nil {
		panic("raft: load state: " + err.Error())
	}
	if len(data) == 0 {
		return // first boot
	}
	var state persistentState
	if err := gob.NewDecoder(bytes.NewReader(data)).Decode(&state); err != nil {
		panic("raft: decode state: " + err.Error())
	}
	rf.currentTerm = state.CurrentTerm
	rf.votedFor = state.VotedFor
	rf.log = state.Log
	if len(rf.log) == 0 {
		rf.log = []LogEntry{{}}
	}
}
