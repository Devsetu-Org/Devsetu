package kv

// Apply is called by Raft, in log order, for every committed entry. It runs
// the op on the state machine and wakes the Execute call waiting for it.
func (s *Server) Apply(index int, command []byte) {
	// ── TODO(5.2) — apply, then tell whoever is waiting ────────────────────
	panic("TODO(5.2)")
}

// Execute is the RPC a client calls. It answers only after the op is
// committed and applied, so even a Get is a log entry: a deposed leader
// cannot answer from stale state because it cannot commit anything.
func (s *Server) Execute(args *ExecuteArgs, reply *ExecuteReply) {
	// ── TODO(5.3) — submit and wait ────────────────────────────────────────
	panic("TODO(5.3)")
}
