package db

import (
	"fmt"
	"math/rand"
	"sort"
	"strings"
	"testing"
)

func scan(t *testing.T, d *DB, start, end string) string {
	t.Helper()
	var s, e []byte
	if start != "" {
		s = []byte(start)
	}
	if end != "" {
		e = []byte(end)
	}
	var out []string
	err := d.Scan(s, e, func(k, v []byte) bool {
		out = append(out, fmt.Sprintf("%s=%s", k, v))
		return true
	})
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	return strings.Join(out, " ")
}

func TestScanAcrossMemtableAndTables(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	d.Put([]byte("order:1"), []byte("pending"))
	d.Put([]byte("order:2"), []byte("pending"))
	d.Put([]byte("order:3"), []byte("pending"))
	d.Flush()
	d.Put([]byte("order:2"), []byte("paid"))
	d.Delete([]byte("order:3"))
	d.Put([]byte("order:4"), []byte("pending"))
	d.Flush()
	d.Put([]byte("order:1"), []byte("shipped"))
	d.Put([]byte("order:5"), []byte("pending"))

	want := "order:1=shipped order:2=paid order:4=pending order:5=pending"
	if got := scan(t, d, "", ""); got != want {
		t.Fatalf("Scan = %q\n  want %q\nnewest version of each key, deleted keys left out", got, want)
	}
}

func TestScanRange(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	for i := 0; i < 10; i++ {
		d.Put([]byte(fmt.Sprintf("k%d", i)), []byte("v"))
		if i == 4 {
			d.Flush()
		}
	}
	if got, want := scan(t, d, "k3", "k6"), "k3=v k4=v k5=v"; got != want {
		t.Fatalf("Scan[k3, k6) = %q, want %q (start included, end excluded)", got, want)
	}
	if got, want := scan(t, d, "k8", ""), "k8=v k9=v"; got != want {
		t.Fatalf("Scan[k8, end) = %q, want %q", got, want)
	}
	if got := scan(t, d, "x", ""); got != "" {
		t.Fatalf("Scan past the last key = %q, want nothing", got)
	}
}

func TestScanStopsWhenAsked(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	for i := 0; i < 100; i++ {
		d.Put([]byte(fmt.Sprintf("k%03d", i)), []byte("v"))
	}
	n := 0
	d.Scan(nil, nil, func(k, v []byte) bool { n++; return n < 3 })
	if n != 3 {
		t.Fatalf("callback ran %d times after returning false on the 3rd; Scan must stop", n)
	}
}

func TestDeletedKeyStaysHiddenInScan(t *testing.T) {
	dir := t.TempDir()
	d := open(t, dir)
	d.Put([]byte("a"), []byte("1"))
	d.Put([]byte("b"), []byte("2"))
	d.Flush()
	d.Delete([]byte("a"))
	d.Flush() // the tombstone is now in a newer table than the value
	d.Close()
	d = open(t, dir)
	defer d.Close()
	if got := scan(t, d, "", ""); got != "b=2" {
		t.Fatalf("Scan = %q, want b=2 (a was deleted)", got)
	}
}

func TestScanMatchesAModel(t *testing.T) {
	d := openSmall(t, t.TempDir())
	defer d.Close()
	model := map[string]string{}
	rnd := rand.New(rand.NewSource(5))
	for i := 0; i < 5000; i++ {
		k := fmt.Sprintf("key:%04d", rnd.Intn(800))
		if rnd.Intn(4) == 0 {
			d.Delete([]byte(k))
			delete(model, k)
		} else {
			v := fmt.Sprintf("v%d", i)
			d.Put([]byte(k), []byte(v))
			model[k] = v
		}
	}
	if d.Stats().Tables < 5 {
		t.Fatal("expected several tables; the test needs flushes to mean anything")
	}
	keys := make([]string, 0, len(model))
	for k := range model {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var want []string
	for _, k := range keys {
		want = append(want, k+"="+model[k])
	}
	if got := scan(t, d, "", ""); got != strings.Join(want, " ") {
		t.Fatal("full Scan does not match the model of live keys")
	}
}

func TestBloomFiltersSkipTables(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	for f := 0; f < 20; f++ {
		for i := 0; i < 200; i++ {
			d.Put([]byte(fmt.Sprintf("t%02d:%04d", f, i)), []byte("v"))
		}
		d.Flush()
	}
	before := int64(0)
	for _, t := range d.tables {
		before += t.t.BlockReads()
	}
	for i := 0; i < 1000; i++ {
		d.Get([]byte(fmt.Sprintf("t10:%04d", 5000+i))) // absent, inside table 10's range
	}
	after := int64(0)
	for _, t := range d.tables {
		after += t.t.BlockReads()
	}
	// Without filters this costs about 9000 block reads: every lookup reads a
	// block from each of the 9 tables whose key range covers it.
	if reads := after - before; reads > 300 {
		t.Fatalf("1000 lookups of absent keys across 20 tables read %d blocks (about 9000 without filters); Bloom filters should skip nearly every table", reads)
	}
}
