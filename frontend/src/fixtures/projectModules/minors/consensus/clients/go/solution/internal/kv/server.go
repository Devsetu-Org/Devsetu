package kv

import "time"

// Apply is called by Raft, in log order, for every committed entry. It runs
// the op on the state machine and wakes the Execute call waiting for it.
func (s *Server) Apply(index int, command []byte) {
	op, err := decodeOp(command)
	if err != nil {
		return // not ours; every server skips it the same way
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	result := s.state.Apply(op)
	if ch, ok := s.waiters[index]; ok {
		delete(s.waiters, index)
		ch <- applied{clientID: op.ClientID, seq: op.Seq, result: result}
	}
}

// Execute is the RPC a client calls. It answers only after the op is
// committed and applied, so even a Get is a log entry: a deposed leader
// cannot answer from stale state because it cannot commit anything.
func (s *Server) Execute(args *ExecuteArgs, reply *ExecuteReply) {
	op := args.Op
	reply.Leader = -1

	// Start and the registration happen under one lock: otherwise the entry
	// could commit and be applied before anyone is waiting for it.
	ch := make(chan applied, 1)
	s.mu.Lock()
	index, _, isLeader := s.rf.Start(encodeOp(op))
	if !isLeader {
		s.mu.Unlock()
		reply.Err = ErrNotLeader
		reply.Leader = s.rf.Leader()
		return
	}
	if old, ok := s.waiters[index]; ok {
		close(old) // a previous leader's request for this index lost the slot
	}
	s.waiters[index] = ch
	s.mu.Unlock()

	timer := time.NewTimer(s.timeout)
	defer timer.Stop()
	select {
	case got, ok := <-ch:
		// A different op at our index means another leader's entry won it: we
		// were deposed and our request is gone.
		if !ok || got.clientID != op.ClientID || got.seq != op.Seq {
			reply.Err = ErrNotLeader
			reply.Leader = s.rf.Leader()
			return
		}
		reply.Value, reply.Found = got.result.Value, got.result.Found
	case <-timer.C:
		s.mu.Lock()
		if s.waiters[index] == ch {
			delete(s.waiters, index)
		}
		s.mu.Unlock()
		reply.Err = ErrTimeout
	}
}
