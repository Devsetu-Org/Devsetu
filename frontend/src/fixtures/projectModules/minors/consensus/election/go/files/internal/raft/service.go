package raft

import (
	"fmt"

	"github.com/devlabs/raftkv/internal/labrpc"
)

// Handle lets the network deliver an RPC to this node (labrpc.Handler).
func (rf *Raft) Handle(method string, data []byte) ([]byte, error) {
	if rf.killed() {
		return nil, labrpc.ErrDown
	}
	switch method {
	case methodRequestVote:
		var args RequestVoteArgs
		if err := labrpc.Decode(data, &args); err != nil {
			return nil, err
		}
		var reply RequestVoteReply
		rf.RequestVote(&args, &reply)
		return labrpc.Encode(&reply), nil
	case methodAppendEntries:
		var args AppendEntriesArgs
		if err := labrpc.Decode(data, &args); err != nil {
			return nil, err
		}
		var reply AppendEntriesReply
		rf.AppendEntries(&args, &reply)
		return labrpc.Encode(&reply), nil
	}
	return nil, fmt.Errorf("raft: unknown method %q", method)
}
