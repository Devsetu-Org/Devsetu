package db

import (
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"testing"

	"github.com/devlabs/lsmkv/internal/wal"
)

// openSmall flushes every 4 KiB and never compacts on its own, so tests can
// count the tables flushes produce.
func openSmall(t *testing.T, dir string) *DB {
	t.Helper()
	d, err := Open(dir, Options{Sync: wal.SyncNever, MemtableSize: 4 << 10, BlockSize: 512, CompactionTrigger: -1})
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	return d
}

func tableFiles(t *testing.T, dir string) []string {
	t.Helper()
	m, _ := filepath.Glob(filepath.Join(dir, "*.sst"))
	return m
}

func TestFlushWritesATable(t *testing.T) {
	dir := t.TempDir()
	d := open(t, dir)
	defer d.Close()
	d.Put([]byte("order:1"), []byte("paid"))
	d.Delete([]byte("order:2"))
	if err := d.Flush(); err != nil {
		t.Fatalf("Flush: %v", err)
	}
	if files := tableFiles(t, dir); len(files) != 1 {
		t.Fatalf("after one flush the directory has %d .sst files, want 1", len(files))
	}
	s := d.Stats()
	if s.MemtableEntries != 0 || s.Tables != 1 {
		t.Fatalf("after flush: memtable entries=%d tables=%d; want 0 and 1", s.MemtableEntries, s.Tables)
	}
	if s.WALBytes != 0 {
		t.Fatalf("after flush the log still holds %d bytes; start a fresh log once the table is durable", s.WALBytes)
	}
	mustGet(t, d, "order:1", "paid", true)
	mustGet(t, d, "order:2", "", false)
}

func TestFlushOnFullMemtable(t *testing.T) {
	dir := t.TempDir()
	d := openSmall(t, dir)
	for i := 0; i < 2000; i++ {
		d.Put([]byte(fmt.Sprintf("order:%05d", i)), []byte("pending-payment"))
	}
	if n := len(tableFiles(t, dir)); n < 5 {
		t.Fatalf("2000 writes with a 4 KiB memtable produced %d tables; writes must flush once the memtable is full", n)
	}
	d.Close()

	d = openSmall(t, dir)
	defer d.Close()
	for i := 0; i < 2000; i++ {
		mustGet(t, d, fmt.Sprintf("order:%05d", i), "pending-payment", true)
	}
}

func TestNewestVersionWins(t *testing.T) {
	dir := t.TempDir()
	d := open(t, dir)
	d.Put([]byte("order:1"), []byte("pending"))
	d.Put([]byte("order:2"), []byte("pending"))
	d.Flush()
	d.Put([]byte("order:1"), []byte("paid")) // newer table
	d.Delete([]byte("order:2"))              // tombstone hides the old value
	d.Flush()
	d.Put([]byte("order:1"), []byte("shipped")) // still in the memtable
	mustGet(t, d, "order:1", "shipped", true)
	mustGet(t, d, "order:2", "", false)
	d.Close()

	d = open(t, dir)
	defer d.Close()
	mustGet(t, d, "order:1", "shipped", true)
	mustGet(t, d, "order:2", "", false)
}

func TestTablesAreNumberedAndSurviveReopen(t *testing.T) {
	dir := t.TempDir()
	d := open(t, dir)
	for i := 0; i < 3; i++ {
		d.Put([]byte("k"), []byte(fmt.Sprint(i)))
		d.Flush()
	}
	d.Close()
	for _, name := range []string{"000001.sst", "000002.sst", "000003.sst"} {
		if _, err := os.Stat(filepath.Join(dir, name)); err != nil {
			t.Fatalf("expected %s: %v", name, err)
		}
	}
	d = open(t, dir)
	defer d.Close()
	mustGet(t, d, "k", "2", true)
	d.Put([]byte("k"), []byte("3"))
	d.Flush()
	if _, err := os.Stat(filepath.Join(dir, "000004.sst")); err != nil {
		t.Fatal("after reopening, the next table must get a higher number than every existing one")
	}
}

func TestLeftoverTempFileIsIgnored(t *testing.T) {
	dir := t.TempDir()
	d := open(t, dir)
	d.Put([]byte("k"), []byte("v"))
	d.Flush()
	d.Close()
	// A crash mid-flush leaves a half-written table under its temp name.
	os.WriteFile(filepath.Join(dir, "000002.sst.tmp"), []byte("half a table"), 0o644)
	d = open(t, dir)
	defer d.Close()
	mustGet(t, d, "k", "v", true)
}

func TestRandomOpsAcrossFlushes(t *testing.T) {
	dir := t.TempDir()
	model := map[string]string{}
	rnd := rand.New(rand.NewSource(3))
	d := openSmall(t, dir)
	for round := 0; round < 4; round++ {
		for i := 0; i < 1500; i++ {
			k := fmt.Sprintf("key:%04d", rnd.Intn(600))
			if rnd.Intn(5) == 0 {
				d.Delete([]byte(k))
				delete(model, k)
			} else {
				v := fmt.Sprintf("v%d", rnd.Int())
				d.Put([]byte(k), []byte(v))
				model[k] = v
			}
		}
		d.Close()
		d = openSmall(t, dir)
		for i := 0; i < 600; i++ {
			k := fmt.Sprintf("key:%04d", i)
			want, ok := model[k]
			mustGet(t, d, k, want, ok)
		}
	}
	d.Close()
}
