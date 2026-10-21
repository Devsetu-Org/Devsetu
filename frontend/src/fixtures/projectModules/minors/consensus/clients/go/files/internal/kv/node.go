package kv

import (
	"fmt"
	"sync"
	"time"

	"github.com/devlabs/raftkv/internal/labrpc"
	"github.com/devlabs/raftkv/internal/raft"
	"github.com/devlabs/raftkv/internal/storage"
)

// Server is one node of the store: a Raft peer plus the State it feeds.
type Server struct {
	me      int
	rf      *raft.Raft
	timeout time.Duration // how long Execute waits for a commit

	mu      sync.Mutex // guards state and waiters
	state   *State
	waiters map[int]chan applied // log index -> the Execute call waiting on it
}

// applied is what Apply hands to the Execute call waiting on an index.
type applied struct {
	clientID, seq int64
	result        Result
}

// StartServer boots node me. peers[j] calls node j.
func StartServer(me int, peers []raft.Peer, store storage.Store, timing raft.Timing, seed int64) *Server {
	s := &Server{
		me:      me,
		timeout: 600 * time.Millisecond,
		state:   NewState(),
		waiters: map[int]chan applied{},
	}
	s.rf = raft.Make(raft.Config{Me: me, Peers: peers, Store: store, SM: s, Timing: timing, Seed: seed})
	return s
}

// Raft exposes the underlying node, for tests and the REPL.
func (s *Server) Raft() *raft.Raft { return s.rf }

// Kill stops the server's Raft node.
func (s *Server) Kill() { s.rf.Kill() }

// Handle routes an RPC to Raft or to the key/value service (labrpc.Handler).
func (s *Server) Handle(method string, data []byte) ([]byte, error) {
	if method == "KV.Execute" {
		var args ExecuteArgs
		if err := labrpc.Decode(data, &args); err != nil {
			return nil, err
		}
		var reply ExecuteReply
		s.Execute(&args, &reply)
		return labrpc.Encode(&reply), nil
	}
	if len(method) > 5 && method[:5] == "Raft." {
		return s.rf.Handle(method, data)
	}
	return nil, fmt.Errorf("kv: unknown method %q", method)
}
