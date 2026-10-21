package sstable

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/devlabs/lsmkv/internal/memtable"
)

func key(i int) []byte { return []byte(fmt.Sprintf("order:%06d", i)) }

// build writes keys 0, 2, 4, ... (2n-2). Every tenth one is a tombstone.
func build(t *testing.T, n, blockSize int) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "000001.sst")
	w, err := Create(path, WriterOptions{BlockSize: blockSize})
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < n; i++ {
		k := key(2 * i)
		if i%10 == 0 {
			err = w.Add(memtable.KindTombstone, k, nil)
		} else {
			err = w.Add(memtable.KindValue, k, []byte(fmt.Sprintf("value-%d", 2*i)))
		}
		if err != nil {
			t.Fatalf("Add(%s): %v", k, err)
		}
	}
	if err := w.Finish(); err != nil {
		t.Fatalf("Finish: %v", err)
	}
	return path
}

func openTable(t *testing.T, path string) *Table {
	t.Helper()
	tbl, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { tbl.Close() })
	return tbl
}

func TestFooterAndIndex(t *testing.T) {
	path := build(t, 1000, 512)
	data, _ := os.ReadFile(path)
	footer := data[len(data)-footerSize:]
	if binary.LittleEndian.Uint64(footer[32:]) != magic {
		t.Fatal("the last 8 bytes of the file are not the magic number")
	}
	tbl := openTable(t, path)
	if tbl.NumBlocks() < 10 {
		t.Fatalf("1000 entries with 512-byte blocks made %d blocks; Add must cut a block once it reaches BlockSize", tbl.NumBlocks())
	}
	// Every index entry's lastKey is the last key in its block, in order.
	for i := 1; i < len(tbl.index); i++ {
		if bytes.Compare(tbl.index[i-1].lastKey, tbl.index[i].lastKey) >= 0 {
			t.Fatalf("index entries %d and %d are not in increasing key order", i-1, i)
		}
	}
	last := tbl.index[len(tbl.index)-1].lastKey
	if !bytes.Equal(last, key(2*999)) {
		t.Fatalf("last index key = %s, want %s", last, key(2*999))
	}
}

func TestGetEveryKey(t *testing.T) {
	tbl := openTable(t, build(t, 2000, 1024))
	for i := 0; i < 2000; i++ {
		v, res, err := tbl.Get(key(2 * i))
		if err != nil {
			t.Fatalf("Get(%s): %v", key(2*i), err)
		}
		if i%10 == 0 {
			if res != memtable.Deleted || v != nil {
				t.Fatalf("Get(%s) = %q, %v; want a tombstone (Deleted)", key(2*i), v, res)
			}
			continue
		}
		if res != memtable.Found || string(v) != fmt.Sprintf("value-%d", 2*i) {
			t.Fatalf("Get(%s) = %q, %v; want value-%d, Found", key(2*i), v, res, 2*i)
		}
	}
}

func TestGetMissingKeys(t *testing.T) {
	tbl := openTable(t, build(t, 2000, 1024))
	for _, k := range [][]byte{
		[]byte("a"),       // before every key
		key(1), key(2001), // between keys, including across block edges
		key(3999), // between the last two keys
		key(4000), // after the last key
		[]byte("order:9999999"),
		[]byte("zzz"),
	} {
		if v, res, err := tbl.Get(k); err != nil || res != memtable.Missing || v != nil {
			t.Fatalf("Get(%s) = %q, %v, %v; want Missing", k, v, res, err)
		}
	}
}

func TestOneBlockPerLookup(t *testing.T) {
	tbl := openTable(t, build(t, 5000, 1024))
	before := tbl.BlockReads()
	for i := 0; i < 100; i++ {
		tbl.Get(key(2 * i * 37 % 10000))
	}
	if reads := tbl.BlockReads() - before; reads != 100 {
		t.Fatalf("100 lookups read %d blocks; each lookup should read exactly one data block (the index is kept in memory)", reads)
	}
}

func TestOutOfOrderAdd(t *testing.T) {
	w, err := Create(filepath.Join(t.TempDir(), "x.sst"), WriterOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer w.Abort()
	if err := w.Add(memtable.KindValue, []byte("b"), nil); err != nil {
		t.Fatal(err)
	}
	if err := w.Add(memtable.KindValue, []byte("a"), nil); err != ErrOutOfOrder {
		t.Fatalf("adding a smaller key returned %v, want ErrOutOfOrder", err)
	}
	if err := w.Add(memtable.KindValue, []byte("b"), nil); err != ErrOutOfOrder {
		t.Fatalf("adding the same key twice returned %v, want ErrOutOfOrder", err)
	}
}

func TestEmptyTable(t *testing.T) {
	tbl := openTable(t, build(t, 0, 0))
	if _, res, err := tbl.Get([]byte("anything")); err != nil || res != memtable.Missing {
		t.Fatalf("Get on an empty table = %v, %v; want Missing", res, err)
	}
	it := tbl.NewIterator()
	if it.SeekToFirst(); it.Valid() {
		t.Fatal("iterator over an empty table is Valid")
	}
}

func TestCorruptionIsDetected(t *testing.T) {
	path := build(t, 500, 512)
	data, _ := os.ReadFile(path)

	badMagic := append([]byte(nil), data...)
	badMagic[len(badMagic)-1] ^= 0xff
	os.WriteFile(path, badMagic, 0o644)
	if _, err := Open(path); err == nil {
		t.Fatal("Open accepted a file with the wrong magic number")
	}

	short := filepath.Join(t.TempDir(), "short.sst")
	os.WriteFile(short, data[:20], 0o644)
	if _, err := Open(short); err == nil {
		t.Fatal("Open accepted a file shorter than the footer")
	}

	flipped := append([]byte(nil), data...)
	flipped[10] ^= 0xff // inside the first data block
	os.WriteFile(path, flipped, 0o644)
	tbl := openTable(t, path)
	if _, _, err := tbl.Get(key(2)); err == nil {
		t.Fatal("Get read a damaged block without noticing; check the block's CRC trailer")
	}
}

func TestIteratorWalksEverything(t *testing.T) {
	tbl := openTable(t, build(t, 3000, 700))
	it := tbl.NewIterator()
	n := 0
	for it.SeekToFirst(); it.Valid(); it.Next() {
		if !bytes.Equal(it.Key(), key(2*n)) {
			t.Fatalf("entry %d has key %s, want %s", n, it.Key(), key(2*n))
		}
		n++
	}
	if it.Err() != nil || n != 3000 {
		t.Fatalf("iterated %d entries (err %v), want 3000", n, it.Err())
	}
	it.Seek(key(2001))
	if !it.Valid() || !bytes.Equal(it.Key(), key(2002)) {
		t.Fatalf("Seek(%s) landed on the wrong key", key(2001))
	}
}
