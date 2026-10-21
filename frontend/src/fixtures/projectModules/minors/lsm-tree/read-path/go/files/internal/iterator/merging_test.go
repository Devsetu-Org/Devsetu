package iterator

import (
	"fmt"
	"math/rand"
	"sort"
	"strings"
	"testing"

	"github.com/devlabs/lsmkv/internal/memtable"
)

// sliceIter is a sorted, in-memory source for tests.
type sliceIter struct {
	keys, values []string
	kinds        []memtable.Kind
	pos          int
}

// src builds a source from "key=value" and "key=-" (tombstone) pairs.
func src(pairs ...string) *sliceIter {
	s := &sliceIter{pos: len(pairs)}
	sort.Strings(pairs)
	for _, p := range pairs {
		k, v, _ := strings.Cut(p, "=")
		kind := memtable.KindValue
		if v == "-" {
			kind, v = memtable.KindTombstone, ""
		}
		s.keys, s.values, s.kinds = append(s.keys, k), append(s.values, v), append(s.kinds, kind)
	}
	return s
}

func (s *sliceIter) SeekToFirst() { s.pos = 0 }
func (s *sliceIter) Seek(t []byte) {
	s.pos = sort.SearchStrings(s.keys, string(t))
}
func (s *sliceIter) Valid() bool         { return s.pos < len(s.keys) }
func (s *sliceIter) Next()               { s.pos++ }
func (s *sliceIter) Key() []byte         { return []byte(s.keys[s.pos]) }
func (s *sliceIter) Value() []byte       { return []byte(s.values[s.pos]) }
func (s *sliceIter) Kind() memtable.Kind { return s.kinds[s.pos] }

func drain(m *Merging) string {
	var out []string
	for ; m.Valid(); m.Next() {
		if m.Kind() == memtable.KindTombstone {
			out = append(out, string(m.Key())+"=-")
		} else {
			out = append(out, fmt.Sprintf("%s=%s", m.Key(), m.Value()))
		}
	}
	return strings.Join(out, " ")
}

func TestMergesInKeyOrder(t *testing.T) {
	m := NewMerging(src("b=1", "e=1"), src("a=2", "d=2"), src("c=3", "f=3"))
	m.SeekToFirst()
	if got, want := drain(m), "a=2 b=1 c=3 d=2 e=1 f=3"; got != want {
		t.Fatalf("merged = %q, want %q", got, want)
	}
}

func TestNewestChildWinsTies(t *testing.T) {
	newest := src("order:1=shipped", "order:3=-")
	middle := src("order:1=paid", "order:2=paid", "order:3=paid")
	oldest := src("order:1=pending", "order:2=pending", "order:3=pending", "order:4=pending")
	m := NewMerging(newest, middle, oldest)
	m.SeekToFirst()
	want := "order:1=shipped order:2=paid order:3=- order:4=pending"
	if got := drain(m); got != want {
		t.Fatalf("merged = %q\n          want %q\nEach key must appear once, from the newest child that has it (children[0] is newest).", got, want)
	}
}

func TestSeek(t *testing.T) {
	m := NewMerging(src("a=1", "c=1", "e=1"), src("b=2", "c=2", "f=2"))
	m.Seek([]byte("c"))
	if got, want := drain(m), "c=1 e=1 f=2"; got != want {
		t.Fatalf("after Seek(c): %q, want %q", got, want)
	}
	m.Seek([]byte("zzz"))
	if m.Valid() {
		t.Fatal("Seek past every key should leave the iterator invalid")
	}
	m.SeekToFirst()
	if !m.Valid() || string(m.Key()) != "a" {
		t.Fatal("SeekToFirst after exhausting the iterator should start over")
	}
}

func TestEmptyChildren(t *testing.T) {
	m := NewMerging(src(), src("a=1"), src())
	m.SeekToFirst()
	if got := drain(m); got != "a=1" {
		t.Fatalf("merged = %q, want a=1", got)
	}
	none := NewMerging()
	none.SeekToFirst()
	if none.Valid() {
		t.Fatal("a merge of nothing is Valid")
	}
}

func TestRandomAgainstAModel(t *testing.T) {
	rnd := rand.New(rand.NewSource(11))
	for round := 0; round < 50; round++ {
		n := 1 + rnd.Intn(6)
		children := make([]Iterator, n)
		want := map[string]string{}   // key → value from the newest child
		for c := n - 1; c >= 0; c-- { // oldest first, so newer children overwrite
			seen := map[string]bool{}
			var pairs []string
			for i := 0; i < rnd.Intn(40); i++ {
				k := fmt.Sprintf("k%03d", rnd.Intn(100))
				if seen[k] {
					continue
				}
				seen[k] = true
				v := fmt.Sprintf("c%d", c)
				if rnd.Intn(5) == 0 {
					v = "-"
				}
				pairs = append(pairs, k+"="+v)
				want[k] = v
			}
			children[c] = src(pairs...)
		}
		keys := make([]string, 0, len(want))
		for k := range want {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		var exp []string
		for _, k := range keys {
			exp = append(exp, k+"="+want[k])
		}
		m := NewMerging(children...)
		m.SeekToFirst()
		if got := drain(m); got != strings.Join(exp, " ") {
			t.Fatalf("round %d: merged\n %q\nwant\n %q", round, got, strings.Join(exp, " "))
		}
	}
}

func TestNextDoesNotTrustAliasedKeys(t *testing.T) {
	// The memtable and table iterators hand out slices into their own
	// storage. Next must copy the current key before advancing children.
	a, b := &mutatingIter{keys: []string{"a", "b"}}, &mutatingIter{keys: []string{"a", "c"}}
	m := NewMerging(a, b)
	m.SeekToFirst()
	var got []string
	for ; m.Valid(); m.Next() {
		got = append(got, string(m.Key()))
	}
	if strings.Join(got, ",") != "a,b,c" {
		t.Fatalf("keys = %v, want [a b c]", got)
	}
}

// mutatingIter returns the same buffer from Key, overwritten on every move.
type mutatingIter struct {
	keys []string
	pos  int
	buf  []byte
}

func (s *mutatingIter) SeekToFirst()        { s.pos = 0; s.fill() }
func (s *mutatingIter) Seek(t []byte)       { s.pos = sort.SearchStrings(s.keys, string(t)); s.fill() }
func (s *mutatingIter) Valid() bool         { return s.pos < len(s.keys) }
func (s *mutatingIter) Next()               { s.pos++; s.fill() }
func (s *mutatingIter) Key() []byte         { return s.buf }
func (s *mutatingIter) Value() []byte       { return nil }
func (s *mutatingIter) Kind() memtable.Kind { return memtable.KindValue }
func (s *mutatingIter) fill() {
	s.buf = s.buf[:0]
	if s.Valid() {
		s.buf = append(s.buf, s.keys[s.pos]...)
	}
}
