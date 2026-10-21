package btree

import (
	"fmt"
	"math/rand"
	"testing"
)

func fill(t *testing.T, tr *Tree, n, valSize int) {
	t.Helper()
	for i := 0; i < n; i++ {
		if err := tr.Insert(key(i), val(i, valSize)); err != nil {
			t.Fatalf("Insert(%d): %v", i, err)
		}
	}
}

func del(t *testing.T, tr *Tree, k []byte, want bool) {
	t.Helper()
	got, err := tr.Delete(k)
	if err != nil {
		t.Fatalf("Delete(%q): %v", k, err)
	}
	if got != want {
		t.Fatalf("Delete(%q) = %v, want %v", k, got, want)
	}
}

func TestDeleteFromTheOnlyLeaf(t *testing.T) {
	tr := New(newMemIO())
	del(t, tr, key(1), false) // empty tree
	fill(t, tr, 5, 4)
	del(t, tr, key(2), true)
	del(t, tr, key(2), false)
	del(t, tr, key(99), false)
	mustGet(t, tr, key(2), nil)
	mustGet(t, tr, key(3), val(3, 4))
	if st := check(t, tr); st.Keys != 4 {
		t.Fatalf("stats = %+v", st)
	}
}

func TestDeleteOfAMissingKeyWritesNothing(t *testing.T) {
	io := newMemIO()
	tr := New(io)
	fill(t, tr, 2000, 10)
	io.writes = 0
	del(t, tr, []byte("absent"), false)
	del(t, tr, key(5000), false)
	if io.writes != 0 {
		t.Fatalf("deleting absent keys wrote %d pages", io.writes)
	}
}

func TestDeleteEverythingInRandomOrder(t *testing.T) {
	io := newMemIO()
	tr := New(io)
	const n = 3000
	fill(t, tr, n, 30)
	order := rand.New(rand.NewSource(7)).Perm(n)
	for i, k := range order {
		del(t, tr, key(k), true)
		if i%150 == 0 {
			check(t, tr)
		}
	}
	if io.Root() != 0 {
		t.Fatalf("root = %d after deleting every key, want 0 (empty tree)", io.Root())
	}
	if io.live() != 0 {
		t.Fatalf("%d pages still allocated after deleting every key: merged and emptied pages must be freed", io.live())
	}
	mustGet(t, tr, key(5), nil)
}

func TestDeleteInKeyOrder(t *testing.T) {
	for _, descending := range []bool{false, true} {
		io := newMemIO()
		tr := New(io)
		const n = 2500
		fill(t, tr, n, 40)
		for i := 0; i < n; i++ {
			k := i
			if descending {
				k = n - 1 - i
			}
			del(t, tr, key(k), true)
			if i%100 == 0 {
				check(t, tr)
			}
		}
		if io.Root() != 0 || io.live() != 0 {
			t.Fatalf("descending=%v: root %d, %d pages left", descending, io.Root(), io.live())
		}
	}
}

func TestDeletingMostKeysShrinksTheTree(t *testing.T) {
	io := newMemIO()
	tr := New(io)
	const n = 6000
	fill(t, tr, n, 30)
	before := check(t, tr)
	peak := io.live()

	order := rand.New(rand.NewSource(5)).Perm(n)
	survivors := map[int]bool{}
	for i, k := range order {
		if i < n/10 {
			survivors[k] = true
			continue
		}
		del(t, tr, key(k), true)
	}
	after := check(t, tr)
	if after.Keys != n/10 {
		t.Fatalf("keys = %d, want %d", after.Keys, n/10)
	}
	if after.Leaves*2 > before.Leaves {
		t.Fatalf("%d leaves for 10%% of the keys, down from %d: underfull leaves must be merged or refilled", after.Leaves, before.Leaves)
	}
	if io.live() != after.Leaves+after.Internal {
		t.Fatalf("%d pages allocated but the tree uses %d: pages leaked", io.live(), after.Leaves+after.Internal)
	}
	if io.live() >= peak/2 {
		t.Fatalf("pages in use %d, down from %d: freed pages must go back", io.live(), peak)
	}
	for k := range survivors {
		mustGet(t, tr, key(k), val(k, 30))
	}
}

func TestTheRootShrinks(t *testing.T) {
	tr := New(newMemIO())
	const n = 2500
	big := func(i int) []byte { return []byte(fmt.Sprintf("%0120d", i)) }
	for i := 0; i < n; i++ {
		tr.Insert(big(i), val(i, 1000))
	}
	start := check(t, tr)
	if start.Height < 3 {
		t.Fatalf("height %d: want at least 3 for this test", start.Height)
	}
	lowest := start.Height
	for _, k := range rand.New(rand.NewSource(2)).Perm(n)[:n-20] {
		if ok, err := tr.Delete(big(k)); err != nil || !ok {
			t.Fatalf("Delete: %v %v", ok, err)
		}
		if st, err := tr.Check(); err != nil {
			t.Fatal(err)
		} else if st.Height < lowest {
			lowest = st.Height
		}
	}
	if lowest >= start.Height {
		t.Fatalf("height stayed at %d after deleting all but 20 keys: an internal root with one child must be replaced by it", lowest)
	}
}

func TestFreedPagesAreReused(t *testing.T) {
	io := newMemIO()
	tr := New(io)
	const n = 3000
	fill(t, tr, n, 30)
	peak := io.next
	for i := 0; i < n; i++ {
		del(t, tr, key(i), true)
	}
	fill(t, tr, n, 30)
	check(t, tr)
	if io.next > peak {
		t.Fatalf("page numbers grew from %d to %d on reinsert: freed pages were not reused", peak, io.next)
	}
}

// A random workload checked against a plain map. Entry sizes vary so leaves
// split, merge and borrow in every direction.
func randomWorkload(t *testing.T, keyLen, maxVal, ops, keys int, seed int64) {
	t.Helper()
	io := newMemIO()
	tr := New(io)
	rng := rand.New(rand.NewSource(seed))
	model := map[string][]byte{}
	mk := func(i int) []byte { return []byte(fmt.Sprintf("%0*d", keyLen, i)) }
	for op := 0; op < ops; op++ {
		k := mk(rng.Intn(keys))
		switch rng.Intn(10) {
		case 0, 1, 2, 3, 4: // insert or overwrite
			v := make([]byte, rng.Intn(maxVal))
			rng.Read(v)
			if err := tr.Insert(k, v); err != nil {
				t.Fatalf("op %d Insert: %v", op, err)
			}
			model[string(k)] = v
		default: // delete
			_, had := model[string(k)]
			got, err := tr.Delete(k)
			if err != nil {
				t.Fatalf("op %d Delete: %v", op, err)
			}
			if got != had {
				t.Fatalf("op %d Delete(%q) = %v, model says %v", op, k, got, had)
			}
			delete(model, string(k))
		}
		if op%400 == 0 {
			check(t, tr)
		}
	}
	st := check(t, tr)
	if st.Keys != len(model) {
		t.Fatalf("tree has %d keys, model has %d", st.Keys, len(model))
	}
	for k, v := range model {
		got, ok, err := tr.Get([]byte(k))
		if err != nil || !ok || string(got) != string(v) {
			t.Fatalf("Get(%q) = %d bytes, %v, %v; want %d bytes", k, len(got), ok, err, len(v))
		}
	}
	if io.live() != st.Leaves+st.Internal {
		t.Fatalf("%d pages allocated, tree uses %d", io.live(), st.Leaves+st.Internal)
	}
}

func TestRandomWorkloadSmallEntries(t *testing.T) { randomWorkload(t, 8, 40, 20000, 1500, 1) }
func TestRandomWorkloadMixedValues(t *testing.T)  { randomWorkload(t, 12, 900, 12000, 600, 2) }
func TestRandomWorkloadBigKeys(t *testing.T)      { randomWorkload(t, 120, 1000, 9000, 900, 3) }

func TestScanHelpers(t *testing.T) {
	io := newMemIO()
	tr := New(io)
	fill(t, tr, 3000, 20)
	no, err := tr.SeekLeaf(nil)
	if err != nil || no == 0 {
		t.Fatalf("SeekLeaf(nil) = %d, %v", no, err)
	}
	total := 0
	var last []byte
	for no != 0 {
		leaf, err := tr.ReadLeaf(no)
		if err != nil {
			t.Fatal(err)
		}
		for _, k := range leaf.Keys {
			if last != nil && string(k) <= string(last) {
				t.Fatalf("leaf chain out of order at %q", k)
			}
			last = k
			total++
		}
		no = leaf.Next
	}
	if total != 3000 {
		t.Fatalf("walking the leaf chain saw %d keys, want 3000", total)
	}
	mid, _ := tr.SeekLeaf(key(1500))
	leaf, _ := tr.ReadLeaf(mid)
	if string(leaf.Keys[0]) > string(key(1500)) || string(leaf.Keys[len(leaf.Keys)-1]) < string(key(1500)) {
		t.Fatalf("SeekLeaf(key 1500) found a leaf covering %q..%q", leaf.Keys[0], leaf.Keys[len(leaf.Keys)-1])
	}
}
