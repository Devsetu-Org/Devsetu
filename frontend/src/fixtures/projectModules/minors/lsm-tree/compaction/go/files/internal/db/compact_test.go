package db

import (
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"sort"
	"testing"

	"github.com/devlabs/lsmkv/internal/manifest"
	"github.com/devlabs/lsmkv/internal/memtable"
	"github.com/devlabs/lsmkv/internal/wal"
)

func openWith(t *testing.T, dir string, trigger int) *DB {
	t.Helper()
	d, err := Open(dir, Options{Sync: wal.SyncNever, MemtableSize: 4 << 10, BlockSize: 512, CompactionTrigger: trigger})
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	return d
}

func liveTables(t *testing.T, dir string) []uint64 {
	t.Helper()
	st, err := manifest.Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	return st.Tables
}

func countTombstones(d *DB) int {
	n := 0
	for _, tb := range d.tables {
		it := tb.t.NewIterator()
		for it.SeekToFirst(); it.Valid(); it.Next() {
			if it.Kind() == memtable.KindTombstone {
				n++
			}
		}
	}
	return n
}

func TestCompactMergesEverythingIntoOneTable(t *testing.T) {
	dir := t.TempDir()
	d := openWith(t, dir, -1)
	for round := 0; round < 4; round++ {
		for i := 0; i < 50; i++ {
			d.Put([]byte(fmt.Sprintf("order:%03d", i)), []byte(fmt.Sprintf("v%d", round)))
		}
		d.Delete([]byte(fmt.Sprintf("order:%03d", round)))
		d.Flush()
	}
	if d.Stats().Tables != 4 {
		t.Fatalf("setup: %d tables, want 4", d.Stats().Tables)
	}
	if err := d.Compact(); err != nil {
		t.Fatalf("Compact: %v", err)
	}
	if n := d.Stats().Tables; n != 1 {
		t.Fatalf("after Compact: %d tables, want 1", n)
	}
	if files := tableFiles(t, dir); len(files) != 1 {
		t.Fatalf("after Compact the directory has %d .sst files, want 1; delete the inputs once the manifest is saved", len(files))
	}
	if live := liveTables(t, dir); len(live) != 1 || live[0] != 5 {
		t.Fatalf("manifest lists %v, want [5] (the compaction output)", live)
	}
	if n := countTombstones(d); n != 0 {
		t.Fatalf("the compacted table holds %d tombstones; compacting every table means none are needed", n)
	}
	for i := 0; i < 50; i++ {
		k := fmt.Sprintf("order:%03d", i)
		// order:003 was deleted in the last round; 000-002 were rewritten after their deletes.
		mustGet(t, d, k, "v3", i != 3)
	}
	d.Close()
	d = openWith(t, dir, -1)
	defer d.Close()
	mustGet(t, d, "order:010", "v3", true)
	mustGet(t, d, "order:003", "", false)
}

func TestPartialCompactionKeepsTombstones(t *testing.T) {
	dir := t.TempDir()
	d := openWith(t, dir, -1)
	defer d.Close()
	d.Put([]byte("order:1"), []byte("pending"))
	d.Flush() // oldest table: the value
	d.Delete([]byte("order:1"))
	d.Flush() // the tombstone
	d.Put([]byte("order:2"), []byte("paid"))
	d.Flush() // newest table

	// Merge only the two newest tables. The oldest still holds order:1, so the
	// tombstone has to survive or the deleted value comes back.
	if err := d.compactRange(0, 2); err != nil {
		t.Fatalf("compactRange: %v", err)
	}
	if n := d.Stats().Tables; n != 2 {
		t.Fatalf("after merging 2 of 3 tables: %d tables, want 2", n)
	}
	mustGet(t, d, "order:1", "", false)
	mustGet(t, d, "order:2", "paid", true)
	if countTombstones(d) != 1 {
		t.Fatal("the tombstone for order:1 was dropped while an older table still holds a value for it")
	}
}

func TestCompactionOutputKeepsItsPlace(t *testing.T) {
	dir := t.TempDir()
	d := openWith(t, dir, -1)
	d.Put([]byte("k"), []byte("oldest"))
	d.Flush() // 1
	d.Put([]byte("k"), []byte("middle"))
	d.Flush() // 2
	d.Put([]byte("k"), []byte("newest"))
	d.Flush() // 3

	// Merge the two oldest. The output gets number 4, the highest, but it
	// holds older data than table 3 and must stay behind it.
	if err := d.compactRange(1, 3); err != nil {
		t.Fatal(err)
	}
	mustGet(t, d, "k", "newest", true)
	if live := liveTables(t, dir); len(live) != 2 || live[0] != 3 || live[1] != 4 {
		t.Fatalf("manifest = %v, want [3 4]: order in the manifest, not file numbers, says what is newer", live)
	}
	d.Close()
	d = openWith(t, dir, -1)
	defer d.Close()
	mustGet(t, d, "k", "newest", true)
}

func TestAutomaticCompaction(t *testing.T) {
	dir := t.TempDir()
	d := openWith(t, dir, 4)
	defer d.Close()
	model := map[string]string{}
	for i := 0; i < 5000; i++ {
		k, v := fmt.Sprintf("order:%04d", i%700), fmt.Sprintf("v%d", i)
		d.Put([]byte(k), []byte(v))
		model[k] = v
		if n := d.Stats().Tables; n >= 4 {
			t.Fatalf("%d tables after write %d; reaching the trigger (4) should compact", n, i)
		}
	}
	if d.Stats().Compactions == 0 {
		t.Fatal("no compaction ran")
	}
	for k, v := range model {
		mustGet(t, d, k, v, true)
	}
}

func TestOverwritesStopCostingSpace(t *testing.T) {
	dir := t.TempDir()
	d := openWith(t, dir, -1)
	defer d.Close()
	for round := 0; round < 10; round++ {
		for i := 0; i < 300; i++ {
			d.Put([]byte(fmt.Sprintf("order:%04d", i)), []byte(fmt.Sprintf("status-%d", round)))
		}
		d.Flush()
	}
	before := d.Stats().TableBytes
	d.Compact()
	after := d.Stats().TableBytes
	if after*5 > before {
		t.Fatalf("10 overwrites of 300 keys: %d bytes before compaction, %d after; dead versions should be gone (expect ~10x smaller)", before, after)
	}
}

func TestCrashLeftoversAreCleanedUp(t *testing.T) {
	dir := t.TempDir()
	d := openWith(t, dir, -1)
	d.Put([]byte("a"), []byte("1"))
	d.Flush()
	d.Close()
	// A compaction output that was written but never committed, and a temp file.
	os.WriteFile(filepath.Join(dir, "000009.sst"), []byte("uncommitted"), 0o644)
	os.WriteFile(filepath.Join(dir, "000010.sst.tmp"), []byte("half"), 0o644)
	os.WriteFile(filepath.Join(dir, manifest.FileName+".tmp"), []byte("half"), 0o644)

	d = openWith(t, dir, -1)
	defer d.Close()
	mustGet(t, d, "a", "1", true)
	files := tableFiles(t, dir)
	if len(files) != 1 || filepath.Base(files[0]) != "000001.sst" {
		t.Fatalf("table files after reopen: %v, want only 000001.sst", files)
	}
}

func TestRandomOpsWithCompaction(t *testing.T) {
	dir := t.TempDir()
	model := map[string]string{}
	rnd := rand.New(rand.NewSource(9))
	d := openWith(t, dir, 3)
	for round := 0; round < 4; round++ {
		for i := 0; i < 3000; i++ {
			k := fmt.Sprintf("key:%04d", rnd.Intn(500))
			if rnd.Intn(4) == 0 {
				d.Delete([]byte(k))
				delete(model, k)
			} else {
				v := fmt.Sprintf("v%d", rnd.Int())
				d.Put([]byte(k), []byte(v))
				model[k] = v
			}
		}
		if round%2 == 1 {
			d.Compact()
		}
		d.Close()
		d = openWith(t, dir, 3)
		keys := make([]string, 0, len(model))
		for k := range model {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		var got []string
		d.Scan(nil, nil, func(k, v []byte) bool {
			got = append(got, string(k)+"="+string(v))
			return true
		})
		if len(got) != len(keys) {
			t.Fatalf("round %d: Scan returned %d keys, want %d", round, len(got), len(keys))
		}
		for i, k := range keys {
			if got[i] != k+"="+model[k] {
				t.Fatalf("round %d: Scan[%d] = %s, want %s=%s", round, i, got[i], k, model[k])
			}
		}
	}
	d.Close()
}
