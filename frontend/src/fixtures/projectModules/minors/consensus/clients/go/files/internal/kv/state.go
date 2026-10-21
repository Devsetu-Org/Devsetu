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
	//
	// A client retries a request until it hears back, so the log can hold the
	// same (ClientID, Seq) more than once. Put and Delete must take effect
	// only the first time: replaying an old Put after a newer write would roll
	// the value back.
	//
	//  - fresh := op.Seq > s.lastSeq[op.ClientID]; if fresh, record it.
	//  - OpGet: read s.data[string(op.Key)] and return a COPY of the value and
	//    whether the key exists. A Get runs every time (it changes nothing).
	//  - OpPut: if fresh, store a COPY of op.Value (the caller may reuse its
	//    buffer). An empty value is a real value: Found must still be true.
	//  - OpDelete: if fresh, delete the key. Deleting a missing key is fine.
	//
	// Return Result{} for Put and Delete.
	panic("TODO(5.1): State.Apply — dedupe by (ClientID, Seq), then Get / Put / Delete")
}
