package kv

// Result is what applying an Op produces. Only Get fills it.
type Result struct {
	Value []byte
	Found bool
}

// State is the key/value map every server applies the log to. It is plain
// data: it knows nothing about Raft, terms, or networks.
type State struct {
	data    map[string][]byte
	lastSeq map[int64]int64 // client -> highest Seq already applied
}

// NewState returns an empty State.
func NewState() *State {
	return &State{data: map[string][]byte{}, lastSeq: map[int64]int64{}}
}

// Apply runs one committed op and returns its result.
func (s *State) Apply(op Op) Result {
	// ── TODO(5.1) — apply once, even if the log says it twice ──────────────
	panic("TODO(5.1)")
}
