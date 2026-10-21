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
//
// A client retries a request until it hears back, so the log can hold the same
// (ClientID, Seq) twice. Put and Delete must take effect only the first time:
// replaying an old Put after a newer write would roll the value back.
func (s *State) Apply(op Op) Result {
	fresh := op.Seq > s.lastSeq[op.ClientID]
	if fresh {
		s.lastSeq[op.ClientID] = op.Seq
	}
	key := string(op.Key)
	switch op.Kind {
	case OpGet:
		v, ok := s.data[key]
		return Result{Value: append([]byte(nil), v...), Found: ok}
	case OpPut:
		if fresh {
			s.data[key] = append([]byte(nil), op.Value...)
		}
	case OpDelete:
		if fresh {
			delete(s.data, key)
		}
	}
	return Result{}
}
