package db

import (
	"bytes"
	"fmt"
	"math/rand"
	"sort"
	"sync"
	"testing"

	"github.com/devlabs/btreekv/internal/pager"
)

func key(i int) string { return fmt.Sprintf("key-%05d", i) }

func scanKeys(t *testing.T, d *DB, start, end []byte) []string {
	t.Helper()
	var keys []string
	err := d.Scan(start, end, func(k, v []byte) bool {
		keys = append(keys, string(k))
		return true
	})
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	return keys
}

func TestDeleteAndGet(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	d.Put([]byte("order:1"), []byte("pending"))
	d.Put([]byte("order:2"), []byte("paid"))
	if err := d.Delete([]byte("order:1")); err != nil {
		t.Fatal(err)
	}
	mustGet(t, d, "order:1", "", false)
	mustGet(t, d, "order:2", "paid", true)
	if err := d.Delete([]byte("order:1")); err != nil {
		t.Fatalf("deleting a missing key: %v", err)
	}
	if err := d.Delete([]byte("never")); err != nil {
		t.Fatalf("deleting a key that never existed: %v", err)
	}
}

func TestDeleteOfAMissingKeyIsNotLogged(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	put(t, d, 10)
	before := d.log.Size()
	d.Delete([]byte("absent"))
	if d.log.Size() != before {
		t.Fatalf("a delete that changed nothing grew the log by %d bytes", d.log.Size()-before)
	}
}

func TestDeleteSurvivesACrash(t *testing.T) {
	dir := t.TempDir()
	d := open(t, dir)
	put(t, d, 600)
	for i := 0; i < 600; i += 2 {
		if err := d.Delete([]byte(fmt.Sprintf("k%04d", i))); err != nil {
			t.Fatal(err)
		}
	}
	d2 := open(t, dir) // no Close: crash
	defer d2.Close()
	for i := 0; i < 600; i++ {
		mustGet(t, d2, fmt.Sprintf("k%04d", i), fmt.Sprintf("v%d", i), i%2 == 1)
	}
	if s, err := d2.Stats(); err != nil || s.Keys != 300 {
		t.Fatalf("stats = %+v, %v; want 300 keys and a valid tree", s, err)
	}
}

func TestDeletedPagesComeBack(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	put(t, d, 2500)
	full, err := d.Stats()
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2500; i++ {
		if err := d.Delete([]byte(fmt.Sprintf("k%04d", i))); err != nil {
			t.Fatalf("Delete %d: %v", i, err)
		}
	}
	empty, err := d.Stats()
	if err != nil {
		t.Fatal(err)
	}
	if empty.Keys != 0 || empty.Height != 0 || empty.FreePages != empty.Pages-1 {
		t.Fatalf("after deleting everything: %+v; want no keys, height 0, every page free", empty)
	}
	put(t, d, 2500)
	again, _ := d.Stats()
	if again.Pages != full.Pages {
		t.Fatalf("file grew from %d to %d pages after delete-all and reinsert: freed pages must be reused", full.Pages, again.Pages)
	}
	wantAll(t, d, 2500)
}

func TestFreeListSurvivesReopen(t *testing.T) {
	dir := t.TempDir()
	d := open(t, dir)
	put(t, d, 2000)
	for i := 0; i < 1900; i++ {
		d.Delete([]byte(fmt.Sprintf("k%04d", i)))
	}
	before, _ := d.Stats()
	d.Close()
	d = open(t, dir)
	defer d.Close()
	after, err := d.Stats()
	if err != nil || after.Pages != before.Pages || after.FreePages != before.FreePages {
		t.Fatalf("stats %+v, %v; before close %+v", after, err, before)
	}
	for i := 1900; i < 2000; i++ {
		mustGet(t, d, fmt.Sprintf("k%04d", i), fmt.Sprintf("v%d", i), true)
	}
}

func TestScanEverythingInOrder(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	rng := rand.New(rand.NewSource(1))
	for _, i := range rng.Perm(3000) {
		d.Put([]byte(key(i)), []byte(fmt.Sprintf("v%d", i)))
	}
	got := scanKeys(t, d, nil, nil)
	if len(got) != 3000 || !sort.StringsAreSorted(got) {
		t.Fatalf("scan returned %d keys, sorted=%v; want 3000 in order", len(got), sort.StringsAreSorted(got))
	}
	var vals []string
	d.Scan([]byte(key(10)), []byte(key(13)), func(k, v []byte) bool {
		vals = append(vals, string(k)+"="+string(v))
		return true
	})
	if fmt.Sprint(vals) != fmt.Sprint([]string{key(10) + "=v10", key(11) + "=v11", key(12) + "=v12"}) {
		t.Fatalf("scan [10,13) = %v", vals)
	}
}

func TestScanBounds(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	for i := 0; i < 2000; i += 2 { // even keys only
		d.Put([]byte(key(i)), []byte("x"))
	}
	cases := []struct {
		name       string
		start, end []byte
		first, n   string
		count      int
	}{
		{"start on a key", []byte(key(100)), []byte(key(110)), key(100), key(108), 5},
		{"start between keys", []byte(key(101)), []byte(key(110)), key(102), key(108), 4},
		{"end is exclusive", []byte(key(100)), []byte(key(102)), key(100), key(100), 1},
		{"open start", nil, []byte(key(6)), key(0), key(4), 3},
		{"open end", []byte(key(1994)), nil, key(1994), key(1998), 3},
	}
	for _, c := range cases {
		got := scanKeys(t, d, c.start, c.end)
		if len(got) != c.count || got[0] != c.first || got[len(got)-1] != c.n {
			t.Errorf("%s: got %v, want %d keys from %s to %s", c.name, got, c.count, c.first, c.n)
		}
	}
	for name, r := range map[string][2][]byte{
		"start past the last key": {[]byte("zzz"), nil},
		"empty range":             {[]byte(key(100)), []byte(key(100))},
		"end before start":        {[]byte(key(200)), []byte(key(100))},
		"before every key":        {nil, []byte("a")},
	} {
		if got := scanKeys(t, d, r[0], r[1]); len(got) != 0 {
			t.Errorf("%s: got %d keys, want none", name, len(got))
		}
	}
}

func TestScanStopsWhenFnSaysSo(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	put(t, d, 500)
	n := 0
	err := d.Scan(nil, nil, func(k, v []byte) bool {
		n++
		return n < 7
	})
	if err != nil || n != 7 {
		t.Fatalf("fn called %d times, err %v; want 7 and nil", n, err)
	}
}

func TestScanOfAnEmptyAndEmptiedDB(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	if got := scanKeys(t, d, nil, nil); len(got) != 0 {
		t.Fatalf("scan of an empty db returned %v", got)
	}
	put(t, d, 100)
	for i := 0; i < 100; i++ {
		d.Delete([]byte(fmt.Sprintf("k%04d", i)))
	}
	if got := scanKeys(t, d, nil, nil); len(got) != 0 {
		t.Fatalf("scan after deleting everything returned %v", got)
	}
}

func TestScanSkipsDeletedKeys(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	put(t, d, 1000)
	for i := 0; i < 1000; i++ {
		if i%3 != 0 {
			d.Delete([]byte(fmt.Sprintf("k%04d", i)))
		}
	}
	got := scanKeys(t, d, nil, nil)
	if len(got) != 334 {
		t.Fatalf("scan returned %d keys, want 334", len(got))
	}
	for _, k := range got {
		var i int
		fmt.Sscanf(k, "k%04d", &i)
		if i%3 != 0 {
			t.Fatalf("scan returned deleted key %s", k)
		}
	}
}

// readSpy counts the pages a scan reads.
type readSpy struct {
	store
	reads int
}

func (r *readSpy) ReadPage(no pager.PageNo, buf []byte) error {
	r.reads++
	return r.store.ReadPage(no, buf)
}

func TestScanWalksTheLeafChain(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	for i := 0; i < 4000; i++ {
		d.Put([]byte(key(i)), []byte("some value"))
	}
	st, _ := d.Stats()
	spy := &readSpy{store: d.store}
	d.store = spy
	if got := scanKeys(t, d, nil, nil); len(got) != 4000 {
		t.Fatalf("scan returned %d keys", len(got))
	}
	if limit := st.Leaves + st.Height; spy.reads > limit {
		t.Fatalf("a full scan read %d pages; walking the leaf links needs about %d (one descent, then each leaf once)", spy.reads, limit)
	}
}

func TestScanWithWriters(t *testing.T) {
	d := openPool(t, t.TempDir(), 8)
	defer d.Close()
	put(t, d, 400)
	var wg sync.WaitGroup
	stop := make(chan struct{})
	for r := 0; r < 3; r++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-stop:
					return
				default:
				}
				var last []byte
				err := d.Scan(nil, nil, func(k, v []byte) bool {
					if last != nil && bytes.Compare(last, k) >= 0 {
						t.Errorf("scan out of order: %q then %q", last, k)
						return false
					}
					last = append(last[:0], k...)
					return true
				})
				if err != nil {
					t.Errorf("Scan: %v", err)
					return
				}
			}
		}()
	}
	for i := 400; i < 1000; i++ {
		d.Put([]byte(fmt.Sprintf("k%04d", i)), []byte("v"))
		if i%5 == 0 {
			d.Delete([]byte(fmt.Sprintf("k%04d", i-300)))
		}
	}
	close(stop)
	wg.Wait()
}

// Everything at once against a map: puts, deletes, gets, scans, a crash and a
// clean reopen, with a pool small enough to evict constantly.
func TestRandomOperationsAgainstAModel(t *testing.T) {
	dir := t.TempDir()
	d := openPool(t, dir, 6)
	rng := rand.New(rand.NewSource(11))
	model := map[string]string{}

	verify := func(step int) {
		t.Helper()
		var want []string
		for k := range model {
			want = append(want, k)
		}
		sort.Strings(want)
		var got []string
		err := d.Scan(nil, nil, func(k, v []byte) bool {
			got = append(got, string(k))
			if model[string(k)] != string(v) {
				t.Fatalf("step %d: scan value for %s = %q, want %q", step, k, v, model[string(k)])
			}
			return true
		})
		if err != nil {
			t.Fatalf("step %d: Scan: %v", step, err)
		}
		if fmt.Sprint(got) != fmt.Sprint(want) {
			t.Fatalf("step %d: scan returned %d keys, model has %d", step, len(got), len(want))
		}
		if s, err := d.Stats(); err != nil || s.Keys != len(model) {
			t.Fatalf("step %d: stats %+v, %v", step, s, err)
		}
	}

	for step := 0; step < 6000; step++ {
		k := fmt.Sprintf("user:%04d", rng.Intn(700))
		switch rng.Intn(10) {
		case 0, 1, 2, 3:
			v := fmt.Sprintf("%d-%s", step, bytes.Repeat([]byte("x"), rng.Intn(300)))
			if err := d.Put([]byte(k), []byte(v)); err != nil {
				t.Fatalf("step %d: Put: %v", step, err)
			}
			model[k] = v
		case 4, 5, 6:
			if err := d.Delete([]byte(k)); err != nil {
				t.Fatalf("step %d: Delete: %v", step, err)
			}
			delete(model, k)
		default:
			v, ok, err := d.Get([]byte(k))
			want, wantOK := model[k]
			if err != nil || ok != wantOK || string(v) != want {
				t.Fatalf("step %d: Get(%s) = %q, %v, %v; want %q, %v", step, k, v, ok, err, want, wantOK)
			}
		}
		switch step {
		case 2000, 4500: // crash
			d = openPool(t, dir, 6)
			verify(step)
		case 3200: // clean restart
			if err := d.Close(); err != nil {
				t.Fatal(err)
			}
			d = openPool(t, dir, 6)
			verify(step)
		}
	}
	verify(6000)
	d.Close()
}
