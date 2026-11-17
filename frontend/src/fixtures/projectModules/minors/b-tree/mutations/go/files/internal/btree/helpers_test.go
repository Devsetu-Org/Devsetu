package btree

import (
	"bytes"
	"fmt"
	"strings"
	"testing"
)

func key(i int) []byte { return []byte(fmt.Sprintf("key-%06d", i)) }

func val(i int, size int) []byte {
	return []byte(fmt.Sprintf("val-%d-", i) + strings.Repeat("x", size))
}

func check(t *testing.T, tr *Tree) Stats {
	t.Helper()
	st, err := tr.Check()
	if err != nil {
		t.Fatalf("tree invariant broken: %v", err)
	}
	return st
}

func mustGet(t *testing.T, tr *Tree, k, want []byte) {
	t.Helper()
	got, ok, err := tr.Get(k)
	if err != nil {
		t.Fatalf("Get(%q): %v", k, err)
	}
	if want == nil {
		if ok {
			t.Fatalf("Get(%q) = %q, want absent", k, got)
		}
		return
	}
	if !ok || !bytes.Equal(got, want) {
		t.Fatalf("Get(%q) = %q, %v; want %q", k, got, ok, want)
	}
}
