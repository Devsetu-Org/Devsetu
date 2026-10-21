package kv

// Apply is called by Raft, in log order, for every committed entry. It runs
// the op on the state machine and wakes the Execute call waiting for it.
func (s *Server) Apply(index int, command []byte) {
	// ── TODO(5.2) — apply, then tell whoever is waiting ────────────────────
	//
	// Decode the op with decodeOp (skip the entry if it does not decode: every
	// server skips it the same way). Under s.mu, run s.state.Apply(op). If an
	// Execute call registered a channel for this index in s.waiters, delete it
	// from the map and send it applied{clientID, seq, result}. The channel has
	// room for one value, so the send never blocks.
	//
	// Execute checks (clientID, seq) against its own op: if another leader's
	// entry ended up at that index, the waiter learns it was deposed.
	panic("TODO(5.2): Server.Apply — run the op, answer the waiter at this index")
}

// Execute is the RPC a client calls. It answers only after the op is
// committed and applied, so even a Get is a log entry: a deposed leader
// cannot answer from stale state because it cannot commit anything.
func (s *Server) Execute(args *ExecuteArgs, reply *ExecuteReply) {
	// ── TODO(5.3) — submit and wait ────────────────────────────────────────
	//
	//  1. Make a channel `make(chan applied, 1)`. Under s.mu, call
	//     s.rf.Start(encodeOp(args.Op)) and, if it accepted, register the
	//     channel in s.waiters[index]. Both under ONE lock hold: otherwise the
	//     entry could be applied before anyone is waiting. If a channel is
	//     already registered at that index, close it (that request lost the
	//     slot).
	//  2. Not the leader: reply.Err = ErrNotLeader and reply.Leader =
	//     s.rf.Leader() (a hint for the client; -1 when unknown). Always set
	//     reply.Leader = -1 first.
	//  3. Wait on the channel or a timer of s.timeout.
	//       - A closed channel, or an applied whose clientID/seq differ from
	//         args.Op: another leader's entry took the index. Reply
	//         ErrNotLeader.
	//       - A match: copy Value and Found from the result into the reply.
	//       - Timeout: remove our waiter (if it is still ours) and reply
	//         ErrTimeout. A leader cut off from its majority ends up here, and
	//         must never answer from its own map.
	panic("TODO(5.3): Server.Execute — Start, wait for the apply, detect lost leadership")
}
