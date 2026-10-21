package compaction

import (
	"fmt"
	"path/filepath"
	"strings"
	"testing"

	"github.com/devlabs/lsmkv/internal/iterator"
	"github.com/devlabs/lsmkv/internal/memtable"
	"github.com/devlabs/lsmkv/internal/sstable"
)

// table writes "key=value" / "key=-" (tombstone) pairs, already sorted.
func table(t *testing.T, pairs ...string) *sstable.Table {
	t.Helper()
	path := filepath.Join(t.TempDir(), "in.sst")
	w, err := sstable.Create(path, sstable.WriterOptions{})
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range pairs {
		k, v, _ := strings.Cut(p, "=")
		if v == "-" {
			err = w.Add(memtable.KindTombstone, []byte(k), nil)
		} else {
			err = w.Add(memtable.KindValue, []byte(k), []byte(v))
		}
		if err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Finish(); err != nil {
		t.Fatal(err)
	}
	tbl, err := sstable.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { tbl.Close() })
	return tbl
}

func merge(t *testing.T, drop bool, inputs ...*sstable.Table) (string, Stats) {
	t.Helper()
	children := make([]iterator.Iterator, len(inputs))
	for i, in := range inputs {
		children[i] = in.NewIterator()
	}
	path := filepath.Join(t.TempDir(), "out.sst")
	w, err := sstable.Create(path, sstable.WriterOptions{})
	if err != nil {
		t.Fatal(err)
	}
	st, err := Merge(children, w, drop)
	if err != nil {
		t.Fatalf("Merge: %v", err)
	}
	if err := w.Finish(); err != nil {
		t.Fatal(err)
	}
	out, err := sstable.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer out.Close()
	var got []string
	it := out.NewIterator()
	for it.SeekToFirst(); it.Valid(); it.Next() {
		if it.Kind() == memtable.KindTombstone {
			got = append(got, string(it.Key())+"=-")
		} else {
			got = append(got, fmt.Sprintf("%s=%s", it.Key(), it.Value()))
		}
	}
	return strings.Join(got, " "), st
}

func TestNewestVersionOnly(t *testing.T) {
	newer := table(t, "order:1=paid", "order:3=paid")
	older := table(t, "order:1=pending", "order:2=pending", "order:3=pending")
	got, st := merge(t, false, newer, older)
	if want := "order:1=paid order:2=pending order:3=paid"; got != want {
		t.Fatalf("output = %q, want %q", got, want)
	}
	if st.Written != 3 {
		t.Fatalf("Stats.Written = %d, want 3", st.Written)
	}
}

func TestTombstonesKeptWhenOlderDataMayExist(t *testing.T) {
	newer := table(t, "order:1=-", "order:2=paid")
	older := table(t, "order:1=pending")
	got, st := merge(t, false, newer, older)
	if want := "order:1=- order:2=paid"; got != want {
		t.Fatalf("output = %q, want %q\nwith dropTombstones false the tombstone must survive: an older table outside this merge may still hold order:1", got, want)
	}
	if st.DroppedTombstones != 0 {
		t.Fatalf("DroppedTombstones = %d, want 0", st.DroppedTombstones)
	}
}

func TestTombstonesDroppedAtTheBottom(t *testing.T) {
	newer := table(t, "order:1=-", "order:2=paid", "order:4=-")
	older := table(t, "order:1=pending", "order:3=pending")
	got, st := merge(t, true, newer, older)
	if want := "order:2=paid order:3=pending"; got != want {
		t.Fatalf("output = %q, want %q\nthe tombstone and the value it hides both disappear", got, want)
	}
	if st.Written != 2 || st.DroppedTombstones != 2 {
		t.Fatalf("Stats = %+v, want Written 2, DroppedTombstones 2", st)
	}
}

func TestManyInputs(t *testing.T) {
	var inputs []*sstable.Table
	for gen := 9; gen >= 0; gen-- { // newest first
		var pairs []string
		for k := 0; k < 50; k++ {
			if k%10 == gen {
				pairs = append(pairs, fmt.Sprintf("k%02d=gen%d", k, gen))
			}
		}
		inputs = append(inputs, table(t, pairs...))
	}
	got, st := merge(t, true, inputs...)
	if st.Written != 50 || strings.Count(got, "=") != 50 {
		t.Fatalf("merging 10 disjoint tables wrote %d entries, want 50", st.Written)
	}
}
