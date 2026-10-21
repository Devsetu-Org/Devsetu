package db

import (
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/devlabs/lsmkv/internal/wal"
)

func open(t *testing.T, dir string) *DB {
	t.Helper()
	d, err := Open(dir, Options{Sync: wal.SyncNever})
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	return d
}

func mustGet(t *testing.T, d *DB, key, want string, wantOK bool) {
	t.Helper()
	v, ok, err := d.Get([]byte(key))
	if err != nil {
		t.Fatalf("Get(%q): %v", key, err)
	}
	if ok != wantOK || (ok && string(v) != want) {
		t.Fatalf("Get(%q) = %q, %v; want %q, %v", key, v, ok, want, wantOK)
	}
}

func TestPutDeleteGet(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	d.Put([]byte("order:1"), []byte("pending"))
	d.Put([]byte("order:2"), []byte("paid"))
	d.Delete([]byte("order:1"))
	mustGet(t, d, "order:1", "", false)
	mustGet(t, d, "order:2", "paid", true)
	mustGet(t, d, "order:3", "", false)
}

func TestReopenRecoversEverything(t *testing.T) {
	dir := t.TempDir()
	d := open(t, dir)
	d.Put([]byte("order:1"), []byte("pending"))
	d.Put([]byte("order:1"), []byte("paid"))
	d.Put([]byte("order:2"), []byte("pending"))
	d.Delete([]byte("order:2"))
	if err := d.Close(); err != nil {
		t.Fatal(err)
	}

	d = open(t, dir)
	defer d.Close()
	mustGet(t, d, "order:1", "paid", true)
	mustGet(t, d, "order:2", "", false)
	if s := d.Stats(); s.MemtableEntries != 2 {
		t.Fatalf("after reopen the memtable has %d entries, want 2 (order:1 and the order:2 tombstone)", s.MemtableEntries)
	}
}

func TestWithoutCloseNothingIsLost(t *testing.T) {
	dir := t.TempDir()
	d := open(t, dir)
	d.Put([]byte("k"), []byte("v"))
	// Simulate a crash: no Close. The log must already hold the write.
	d2 := open(t, dir)
	defer d2.Close()
	mustGet(t, d2, "k", "v", true)
}

func TestTornTailIsCutBeforeNewWrites(t *testing.T) {
	dir := t.TempDir()
	d := open(t, dir)
	d.Put([]byte("a"), []byte("1"))
	d.Put([]byte("b"), []byte("2"))
	d.Close()

	// A crash mid-append left half a record at the end of the log.
	path := filepath.Join(dir, walName)
	f, _ := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0)
	f.Write([]byte{0xde, 0xad, 0xbe, 0xef, 0x40, 0, 0, 0, 1, 2})
	f.Close()

	d = open(t, dir)
	mustGet(t, d, "a", "1", true)
	mustGet(t, d, "b", "2", true)
	// If the garbage were left in place, this write would land after it and
	// the next replay would stop before reaching it.
	d.Put([]byte("c"), []byte("3"))
	d.Close()

	d = open(t, dir)
	defer d.Close()
	mustGet(t, d, "c", "3", true)
}

func TestWriteFailsAfterClose(t *testing.T) {
	d := open(t, t.TempDir())
	d.Close()
	if err := d.Put([]byte("k"), []byte("v")); err != ErrClosed {
		t.Fatalf("Put after Close = %v, want ErrClosed", err)
	}
}

func TestRandomOpsSurviveReopen(t *testing.T) {
	dir := t.TempDir()
	model := map[string]string{}
	rnd := rand.New(rand.NewSource(7))
	d := open(t, dir)
	for round := 0; round < 5; round++ {
		for i := 0; i < 400; i++ {
			k := fmt.Sprintf("key:%03d", rnd.Intn(150))
			if rnd.Intn(4) == 0 {
				d.Delete([]byte(k))
				delete(model, k)
			} else {
				v := fmt.Sprintf("v%d", rnd.Int())
				d.Put([]byte(k), []byte(v))
				model[k] = v
			}
		}
		d.Close()
		d = open(t, dir)
		for i := 0; i < 150; i++ {
			k := fmt.Sprintf("key:%03d", i)
			want, ok := model[k]
			mustGet(t, d, k, want, ok)
		}
	}
	d.Close()
}

func TestConcurrentWriters(t *testing.T) {
	dir := t.TempDir()
	d := open(t, dir)
	var wg sync.WaitGroup
	for g := 0; g < 8; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			for i := 0; i < 200; i++ {
				d.Put([]byte(fmt.Sprintf("g%d:%03d", g, i)), []byte("v"))
			}
		}(g)
	}
	wg.Wait()
	d.Close()
	d = open(t, dir)
	defer d.Close()
	if n := d.Stats().MemtableEntries; n != 1600 {
		t.Fatalf("recovered %d entries, want 1600", n)
	}
}
