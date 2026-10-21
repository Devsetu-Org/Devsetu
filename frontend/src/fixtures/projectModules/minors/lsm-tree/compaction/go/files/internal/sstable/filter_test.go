package sstable

import (
	"path/filepath"
	"testing"

	"github.com/devlabs/lsmkv/internal/memtable"
)

func buildWithFilter(t *testing.T, n, bitsPerKey int) *Table {
	t.Helper()
	path := filepath.Join(t.TempDir(), "000001.sst")
	w, err := Create(path, WriterOptions{BlockSize: 1024, BloomBitsPerKey: bitsPerKey})
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < n; i++ {
		if err := w.Add(memtable.KindValue, key(2*i), []byte("v")); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Finish(); err != nil {
		t.Fatal(err)
	}
	return openTable(t, path)
}

func TestFilterSkipsAbsentKeys(t *testing.T) {
	tbl := buildWithFilter(t, 5000, 10)
	before := tbl.BlockReads()
	for i := 0; i < 5000; i++ {
		// Odd keys fall between real keys, inside the table's key range, so
		// without a filter every one of them costs a block read.
		if _, res, err := tbl.Get(key(2*i + 1)); err != nil || res != memtable.Missing {
			t.Fatalf("Get(%s) = %v, %v; want Missing", key(2*i+1), res, err)
		}
	}
	reads := tbl.BlockReads() - before
	if reads > 100 {
		t.Fatalf("5000 lookups of absent keys read %d blocks; a 10 bits/key filter should rule out about 99%% of them", reads)
	}
	t.Logf("5000 absent lookups, %d block reads (false positives)", reads)
}

func TestFilterKeepsEveryPresentKey(t *testing.T) {
	tbl := buildWithFilter(t, 3000, 10)
	for i := 0; i < 3000; i++ {
		if _, res, _ := tbl.Get(key(2 * i)); res != memtable.Found {
			t.Fatalf("Get(%s) = %v with a filter; a filter must never hide a present key", key(2*i), res)
		}
	}
}

func TestTableWithoutFilter(t *testing.T) {
	tbl := buildWithFilter(t, 1000, 0)
	if tbl.filter != nil {
		t.Fatal("BloomBitsPerKey 0 should write no filter")
	}
	before := tbl.BlockReads()
	tbl.Get(key(1))
	if tbl.BlockReads()-before != 1 {
		t.Fatal("without a filter, an absent key in range costs one block read")
	}
}

func TestFilterSizeMatchesBitsPerKey(t *testing.T) {
	small := buildWithFilter(t, 4000, 4)
	large := buildWithFilter(t, 4000, 16)
	if len(small.filter) != 4000*4/8+1 || len(large.filter) != 4000*16/8+1 {
		t.Fatalf("filter sizes %d and %d bytes; want %d and %d", len(small.filter), len(large.filter), 4000*4/8+1, 4000*16/8+1)
	}
}
