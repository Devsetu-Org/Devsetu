package btree

import (
	"bytes"
	"errors"
	"fmt"
	"math/rand"
	"strings"
	"testing"

	"github.com/devlabs/btreekv/internal/pager"
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

// ---- unit tests for the node helpers ----

func TestChildIndex(t *testing.T) {
	n := &node{keys: [][]byte{[]byte("b"), []byte("d"), []byte("f")}}
	for _, c := range []struct {
		key  string
		want int
	}{{"a", 0}, {"b", 1}, {"c", 1}, {"d", 2}, {"e", 2}, {"f", 3}, {"z", 3}} {
		if got := n.childIndex([]byte(c.key)); got != c.want {
			t.Errorf("childIndex(%q) = %d, want %d (a key equal to a separator goes right)", c.key, got, c.want)
		}
	}
	if got := (&node{}).childIndex([]byte("a")); got != 0 {
		t.Errorf("childIndex on a node without separators = %d, want 0", got)
	}
}

func TestLeafIndex(t *testing.T) {
	n := &node{leaf: true, keys: [][]byte{[]byte("b"), []byte("d")}, vals: [][]byte{nil, nil}}
	for _, c := range []struct {
		key   string
		at    int
		found bool
	}{{"a", 0, false}, {"b", 0, true}, {"c", 1, false}, {"d", 1, true}, {"e", 2, false}} {
		at, found := n.leafIndex([]byte(c.key))
		if at != c.at || found != c.found {
			t.Errorf("leafIndex(%q) = %d, %v; want %d, %v", c.key, at, found, c.at, c.found)
		}
	}
}

func TestLeafPut(t *testing.T) {
	n := &node{leaf: true}
	for _, k := range []string{"m", "c", "x", "a", "m"} {
		n.leafPut([]byte(k), []byte("v-"+k))
	}
	n.leafPut([]byte("c"), []byte("new"))
	var got []string
	for i, k := range n.keys {
		got = append(got, string(k)+"="+string(n.vals[i]))
	}
	want := "a=v-a c=new m=v-m x=v-x"
	if strings.Join(got, " ") != want {
		t.Fatalf("leaf = %v, want %s (sorted, one entry per key, overwrite in place)", got, want)
	}
}

func bigLeaf(count, valSize int) *node {
	n := &node{leaf: true, next: 77}
	for i := 0; i < count; i++ {
		n.keys = append(n.keys, key(i))
		n.vals = append(n.vals, val(i, valSize))
	}
	return n
}

func TestSplitLeaf(t *testing.T) {
	n := bigLeaf(30, 200)
	if n.fits() {
		t.Fatal("test node should be overfull")
	}
	orig := len(n.keys)
	right, sep := n.split()
	if !n.fits() || !right.fits() {
		t.Fatalf("halves do not fit: left %d bytes, right %d bytes", n.size(), right.size())
	}
	if len(n.keys)+len(right.keys) != orig || len(n.vals) != len(n.keys) || len(right.vals) != len(right.keys) {
		t.Fatalf("entries lost or unpaired: left %d/%d right %d/%d of %d", len(n.keys), len(n.vals), len(right.keys), len(right.vals), orig)
	}
	if len(n.keys) == 0 || len(right.keys) == 0 {
		t.Fatal("a half is empty")
	}
	if !bytes.Equal(sep, right.keys[0]) {
		t.Fatalf("separator %q is not the right node's first key %q (a leaf copies it up)", sep, right.keys[0])
	}
	if !right.leaf || right.next != 77 {
		t.Fatalf("right leaf = leaf:%v next:%d, want a leaf that inherits next=77", right.leaf, right.next)
	}
	if d := n.size() - right.size(); d > 1200 || d < -1200 {
		t.Fatalf("split is lopsided: %d vs %d bytes", n.size(), right.size())
	}
}

func TestSplitInternal(t *testing.T) {
	n := &node{}
	for i := 0; i < 60; i++ {
		n.keys = append(n.keys, []byte(fmt.Sprintf("%0100d", i)))
	}
	for i := 0; i <= 60; i++ {
		n.children = append(n.children, pager.PageNo(100+i))
	}
	if n.fits() {
		t.Fatal("test node should be overfull")
	}
	keys, children := len(n.keys), len(n.children)
	all := append([][]byte(nil), n.keys...)
	right, sep := n.split()
	if !n.fits() || !right.fits() {
		t.Fatalf("halves do not fit: %d and %d bytes", n.size(), right.size())
	}
	if len(n.children) != len(n.keys)+1 || len(right.children) != len(right.keys)+1 {
		t.Fatalf("children out of step with keys: left %d/%d right %d/%d", len(n.keys), len(n.children), len(right.keys), len(right.children))
	}
	if len(n.keys)+len(right.keys)+1 != keys || len(n.children)+len(right.children) != children {
		t.Fatalf("the separator must leave both halves: %d+%d+1 keys of %d, %d+%d children of %d",
			len(n.keys), len(right.keys), keys, len(n.children), len(right.children), children)
	}
	if !bytes.Equal(sep, all[len(n.keys)]) {
		t.Fatalf("separator %q is not the key between the halves", sep)
	}
	if n.children[len(n.children)-1] != pager.PageNo(100+len(n.keys)) || right.children[0] != pager.PageNo(100+len(n.keys)+1) {
		t.Fatalf("children were not divided at the separator")
	}
	if right.leaf {
		t.Fatal("right half of an internal split is not a leaf")
	}
}

func TestNodeRoundTrip(t *testing.T) {
	buf := make([]byte, pager.PageSize)
	leaf := bigLeaf(10, 100)
	leaf.encode(buf)
	got, err := decode(buf)
	if err != nil || !got.leaf || got.next != 77 || len(got.keys) != 10 || !bytes.Equal(got.vals[9], leaf.vals[9]) {
		t.Fatalf("leaf round trip: %+v, %v", got, err)
	}
	in := &node{keys: [][]byte{[]byte("m"), []byte("t")}, children: []pager.PageNo{3, 4, 5}}
	in.encode(buf)
	got, err = decode(buf)
	if err != nil || got.leaf || len(got.children) != 3 || got.children[2] != 5 {
		t.Fatalf("internal round trip: %+v, %v", got, err)
	}
}

// ---- whole-tree tests ----

func TestEmptyTree(t *testing.T) {
	tr := New(newMemIO())
	mustGet(t, tr, key(1), nil)
	if st := check(t, tr); st.Height != 0 {
		t.Fatalf("empty tree height = %d, want 0", st.Height)
	}
}

func TestInsertGetOverwrite(t *testing.T) {
	tr := New(newMemIO())
	for _, k := range []int{5, 1, 9, 3} {
		if err := tr.Insert(key(k), val(k, 4)); err != nil {
			t.Fatalf("Insert: %v", err)
		}
	}
	tr.Insert(key(3), []byte("replaced"))
	mustGet(t, tr, key(1), val(1, 4))
	mustGet(t, tr, key(3), []byte("replaced"))
	mustGet(t, tr, key(9), val(9, 4))
	mustGet(t, tr, key(2), nil)
	if st := check(t, tr); st.Height != 1 || st.Keys != 4 {
		t.Fatalf("stats = %+v, want one leaf with 4 keys", st)
	}
}

func TestFirstSplitGrowsTheTree(t *testing.T) {
	io := newMemIO()
	tr := New(io)
	n := 0
	for ; ; n++ {
		if err := tr.Insert(key(n), val(n, 300)); err != nil {
			t.Fatal(err)
		}
		if st := check(t, tr); st.Height == 2 {
			if st.Leaves != 2 || st.Internal != 1 || st.Keys != n+1 {
				t.Fatalf("after the first split: %+v, want 2 leaves under 1 root holding %d keys", st, n+1)
			}
			break
		}
		if n > 100 {
			t.Fatal("tree never split")
		}
	}
	for i := 0; i <= n; i++ {
		mustGet(t, tr, key(i), val(i, 300))
	}
}

func TestSequentialInserts(t *testing.T) {
	io := newMemIO()
	tr := New(io)
	const n = 4000
	for i := 0; i < n; i++ {
		if err := tr.Insert(key(i), val(i, 20)); err != nil {
			t.Fatalf("Insert(%d): %v", i, err)
		}
	}
	st := check(t, tr)
	if st.Keys != n || st.Height < 2 {
		t.Fatalf("stats = %+v", st)
	}
	for i := 0; i < n; i++ {
		mustGet(t, tr, key(i), val(i, 20))
	}
	mustGet(t, tr, []byte("zzz"), nil)
}

func TestRandomInserts(t *testing.T) {
	io := newMemIO()
	tr := New(io)
	rng := rand.New(rand.NewSource(1))
	order := rng.Perm(5000)
	for _, i := range order {
		if err := tr.Insert(key(i), val(i, 30)); err != nil {
			t.Fatalf("Insert(%d): %v", i, err)
		}
	}
	if st := check(t, tr); st.Keys != 5000 {
		t.Fatalf("stats = %+v", st)
	}
	for i := 0; i < 5000; i++ {
		mustGet(t, tr, key(i), val(i, 30))
	}
}

func TestOverwriteThatGrowsTheLeafSplits(t *testing.T) {
	tr := New(newMemIO())
	for i := 0; i < 40; i++ {
		tr.Insert(key(i), val(i, 10))
	}
	for i := 0; i < 40; i++ {
		if err := tr.Insert(key(i), val(i, 900)); err != nil {
			t.Fatalf("overwrite %d: %v", i, err)
		}
	}
	check(t, tr)
	for i := 0; i < 40; i++ {
		mustGet(t, tr, key(i), val(i, 900))
	}
}

func TestInternalNodesSplitToo(t *testing.T) {
	tr := New(newMemIO())
	const n = 3000
	big := func(i int) []byte { return []byte(fmt.Sprintf("%0120d", i)) }
	for i := 0; i < n; i++ {
		if err := tr.Insert(big(i), val(i, 1000)); err != nil {
			t.Fatalf("Insert(%d): %v", i, err)
		}
	}
	st := check(t, tr)
	if st.Height < 3 {
		t.Fatalf("height = %d, want at least 3 with %d large entries (internal pages must split)", st.Height, n)
	}
	for i := 0; i < n; i += 7 {
		mustGet(t, tr, big(i), val(i, 1000))
	}
}

func TestGetReadsOnePagePerLevel(t *testing.T) {
	io := newMemIO()
	tr := New(io)
	for i := 0; i < 20000; i++ {
		tr.Insert(key(i), val(i, 8))
	}
	st := check(t, tr)
	io.reads = 0
	mustGet(t, tr, key(12345), val(12345, 8))
	if io.reads != st.Height {
		t.Fatalf("Get read %d pages in a tree of height %d: it should read exactly one per level", io.reads, st.Height)
	}
	io.reads = 0
	mustGet(t, tr, []byte("nope"), nil)
	if io.reads > st.Height {
		t.Fatalf("a miss read %d pages, more than the height %d", io.reads, st.Height)
	}
}

func TestEntryLimits(t *testing.T) {
	tr := New(newMemIO())
	if err := tr.Insert(nil, []byte("v")); !errors.Is(err, ErrEmptyKey) {
		t.Errorf("empty key: %v, want ErrEmptyKey", err)
	}
	if err := tr.Insert(bytes.Repeat([]byte("k"), MaxKeySize+1), nil); !errors.Is(err, ErrKeyTooLarge) {
		t.Errorf("long key: %v, want ErrKeyTooLarge", err)
	}
	if err := tr.Insert([]byte("k"), make([]byte, MaxValueSize+1)); !errors.Is(err, ErrValueTooLarge) {
		t.Errorf("long value: %v, want ErrValueTooLarge", err)
	}
	if err := tr.Insert(bytes.Repeat([]byte("k"), MaxKeySize), make([]byte, MaxValueSize)); err != nil {
		t.Errorf("largest entry: %v", err)
	}
}

func TestEmptyValueAndBinaryKeys(t *testing.T) {
	tr := New(newMemIO())
	tr.Insert([]byte{0, 0, 1}, nil)
	tr.Insert([]byte{0, 255}, []byte{0, 0})
	v, ok, err := tr.Get([]byte{0, 0, 1})
	if err != nil || !ok || len(v) != 0 {
		t.Fatalf("Get of an empty value = %q, %v, %v", v, ok, err)
	}
	mustGet(t, tr, []byte{0, 255}, []byte{0, 0})
}

func TestTreeOverTheRealPager(t *testing.T) {
	p, err := pager.Open(t.TempDir() + "/data.db")
	if err != nil {
		t.Fatal(err)
	}
	defer p.Close()
	tr := New(p)
	for i := 0; i < 2000; i++ {
		if err := tr.Insert(key(i), val(i, 50)); err != nil {
			t.Fatal(err)
		}
	}
	check(t, tr)
	for i := 0; i < 2000; i += 13 {
		mustGet(t, tr, key(i), val(i, 50))
	}
}
