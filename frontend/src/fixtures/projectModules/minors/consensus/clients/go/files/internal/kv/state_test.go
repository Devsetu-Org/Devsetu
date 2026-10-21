package kv

import "testing"

func put(s *State, client, seq int64, k, v string) {
	s.Apply(Op{Kind: OpPut, Key: []byte(k), Value: []byte(v), ClientID: client, Seq: seq})
}

func get(s *State, client, seq int64, k string) (string, bool) {
	r := s.Apply(Op{Kind: OpGet, Key: []byte(k), ClientID: client, Seq: seq})
	return string(r.Value), r.Found
}

func TestStatePutGetDelete(t *testing.T) {
	s := NewState()
	if _, ok := get(s, 1, 1, "a"); ok {
		t.Fatal("Get on an empty state found a key")
	}
	put(s, 1, 2, "a", "1")
	put(s, 1, 3, "a", "2")
	if v, ok := get(s, 1, 4, "a"); !ok || v != "2" {
		t.Fatalf("Get = %q, %v; want 2, true", v, ok)
	}
	s.Apply(Op{Kind: OpDelete, Key: []byte("a"), ClientID: 1, Seq: 5})
	if _, ok := get(s, 1, 6, "a"); ok {
		t.Fatal("key still there after Delete")
	}
	s.Apply(Op{Kind: OpDelete, Key: []byte("never"), ClientID: 1, Seq: 7}) // must not panic
}

func TestStateEmptyValueIsNotMissing(t *testing.T) {
	s := NewState()
	put(s, 1, 1, "k", "")
	if v, ok := get(s, 1, 2, "k"); !ok || v != "" {
		t.Fatalf("Get after Put of an empty value = %q, %v; want empty, true", v, ok)
	}
}

func TestStateIgnoresDuplicateWrites(t *testing.T) {
	s := NewState()
	put(s, 1, 1, "k", "mine")
	put(s, 2, 1, "k", "theirs")
	// Client 1's first Put is replayed from the log (it retried after a
	// timeout). It must not undo client 2's newer write.
	put(s, 1, 1, "k", "mine")
	if v, _ := get(s, 3, 1, "k"); v != "theirs" {
		t.Fatalf("value = %q after a duplicate Put, want theirs", v)
	}
	// A duplicate Delete must not erase a newer value either.
	s.Apply(Op{Kind: OpDelete, Key: []byte("k"), ClientID: 1, Seq: 2})
	put(s, 2, 2, "k", "again")
	s.Apply(Op{Kind: OpDelete, Key: []byte("k"), ClientID: 1, Seq: 2})
	if v, ok := get(s, 3, 2, "k"); !ok || v != "again" {
		t.Fatalf("Get = %q, %v after a duplicate Delete, want again, true", v, ok)
	}
}

func TestStateCopiesBytes(t *testing.T) {
	s := NewState()
	val := []byte("abc")
	s.Apply(Op{Kind: OpPut, Key: []byte("k"), Value: val, ClientID: 1, Seq: 1})
	val[0] = 'X'
	r := s.Apply(Op{Kind: OpGet, Key: []byte("k"), ClientID: 1, Seq: 2})
	if string(r.Value) != "abc" {
		t.Fatalf("stored value changed to %q when the caller reused its buffer", r.Value)
	}
	r.Value[0] = 'Y'
	if r2 := s.Apply(Op{Kind: OpGet, Key: []byte("k"), ClientID: 1, Seq: 3}); string(r2.Value) != "abc" {
		t.Fatalf("stored value changed to %q when a reader modified its result", r2.Value)
	}
}
