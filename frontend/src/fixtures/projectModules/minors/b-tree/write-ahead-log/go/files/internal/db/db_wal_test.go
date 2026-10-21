package db

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/devlabs/btreekv/internal/btree"
	"github.com/devlabs/btreekv/internal/pager"
	"github.com/devlabs/btreekv/internal/wal"
)

func put(t *testing.T, d *DB, n int) {
	t.Helper()
	for i := 0; i < n; i++ {
		if err := d.Put([]byte(fmt.Sprintf("k%04d", i)), []byte(fmt.Sprintf("v%d", i))); err != nil {
			t.Fatalf("Put %d: %v", i, err)
		}
	}
}

func wantAll(t *testing.T, d *DB, n int) {
	t.Helper()
	for i := 0; i < n; i++ {
		mustGet(t, d, fmt.Sprintf("k%04d", i), fmt.Sprintf("v%d", i), true)
	}
	if s, err := d.Stats(); err != nil || s.Keys != n {
		t.Fatalf("stats = %+v, %v; want %d keys and a valid tree", s, err, n)
	}
}

// "Crash" in these tests means: stop using d without calling Close, then open
// the same directory again. Nothing is flushed or checkpointed for you.

func TestWithoutCloseNothingIsLost(t *testing.T) {
	dir := t.TempDir()
	d := open(t, dir)
	put(t, d, 400)
	d2 := open(t, dir)
	defer d2.Close()
	wantAll(t, d2, 400)
}

func TestStaleHeaderIsRepairedByReplay(t *testing.T) {
	dir := t.TempDir()
	d := open(t, dir)
	put(t, d, 50)
	// The header page in data.db is only written by Close, so it still says
	// "empty tree, one page". Only the log knows better.
	d2 := open(t, dir)
	defer d2.Close()
	if d2.store.Meta().Root == 0 {
		t.Fatal("replay did not restore the root from the log's meta record")
	}
	wantAll(t, d2, 50)
}

func TestTornPagesAreRepairedByReplay(t *testing.T) {
	dir := t.TempDir()
	d := open(t, dir)
	put(t, d, 600)
	// Simulate torn writes: trash several pages of the page file. The log
	// still holds a full image of every page that was ever changed.
	f, err := os.OpenFile(filepath.Join(dir, "data.db"), os.O_RDWR, 0)
	if err != nil {
		t.Fatal(err)
	}
	for _, pg := range []int64{1, 2, 3} {
		f.WriteAt([]byte("torn torn torn torn"), pg*pager.PageSize+100)
	}
	f.Close()
	d2 := open(t, dir)
	defer d2.Close()
	wantAll(t, d2, 600)
}

func TestLoggedButNotAppliedIsRecovered(t *testing.T) {
	dir := t.TempDir()
	d := open(t, dir)
	put(t, d, 20)

	// A write that reached the log and died before touching a page...
	tx := newTxn(d.store)
	if err := btree.New(tx).Insert([]byte("logged"), []byte("yes")); err != nil {
		t.Fatal(err)
	}
	recs := tx.records()
	if err := d.log.Append(recs...); err != nil {
		t.Fatal(err)
	}
	// ...and one that died before the log.
	tx2 := newTxn(d.store)
	if err := btree.New(tx2).Insert([]byte("unlogged"), []byte("no")); err != nil {
		t.Fatal(err)
	}
	tx2.records()

	d2 := open(t, dir)
	defer d2.Close()
	mustGet(t, d2, "logged", "yes", true)
	mustGet(t, d2, "unlogged", "", false)
	for i := 0; i < 20; i++ {
		mustGet(t, d2, fmt.Sprintf("k%04d", i), fmt.Sprintf("v%d", i), true)
	}
}

func TestUnfinishedBatchIsIgnoredAndCut(t *testing.T) {
	dir := t.TempDir()
	d := open(t, dir)
	put(t, d, 10)
	root := uint32(d.store.Meta().Root)

	// Append a batch that has no commit record: a page image that would wreck
	// the tree if it were applied.
	logPath := filepath.Join(dir, "wal.log")
	st, _ := os.Stat(logPath)
	w, err := wal.OpenAppend(logPath, st.Size(), wal.SyncNever)
	if err != nil {
		t.Fatal(err)
	}
	if err := w.Append(wal.Record{Kind: wal.KindPage, Page: root, Data: make([]byte, pager.Usable)}, wal.MetaRecord(0, 1, 0)); err != nil {
		t.Fatal(err)
	}
	w.Close()

	d2 := open(t, dir)
	wantAll(t, d2, 10)
	// If the unfinished batch were left in the log, this commit would drag it
	// along at the next recovery.
	if err := d2.Put([]byte("after"), []byte("crash")); err != nil {
		t.Fatal(err)
	}
	d3 := open(t, dir)
	defer d3.Close()
	mustGet(t, d3, "after", "crash", true)
	if s, err := d3.Stats(); err != nil || s.Keys != 11 {
		t.Fatalf("stats = %+v, %v; want 11 keys", s, err)
	}
}

func TestTornLogTailDoesNotLoseLaterWrites(t *testing.T) {
	dir := t.TempDir()
	d := open(t, dir)
	put(t, d, 30)
	f, _ := os.OpenFile(filepath.Join(dir, "wal.log"), os.O_APPEND|os.O_WRONLY, 0)
	f.Write([]byte{0xde, 0xad, 0xbe, 0xef, 0x10, 0x00, 0x00, 0x00, 1, 2, 3})
	f.Close()

	d2 := open(t, dir)
	wantAll(t, d2, 30)
	d2.Put([]byte("later"), []byte("write"))
	d3 := open(t, dir) // second crash: the tail must not hide "later"
	defer d3.Close()
	mustGet(t, d3, "later", "write", true)
	mustGet(t, d3, "k0029", "v29", true)
}

func TestPagesAreWrittenAfterTheLog(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	put(t, d, 5)
	before := d.log.Size()
	writes := 0
	d.store = &spyStore{store: d.store, onWrite: func() {
		writes++
		if d.log.Size() == before {
			t.Error("a page was written before the log record for it")
		}
	}}
	if err := d.Put([]byte("zzz"), []byte("v")); err != nil {
		t.Fatal(err)
	}
	if writes == 0 {
		t.Fatal("the commit wrote no pages")
	}
}

type spyStore struct {
	store
	onWrite func()
}

func (s *spyStore) WritePage(no pager.PageNo, buf []byte) error {
	s.onWrite()
	return s.store.WritePage(no, buf)
}

func TestFailedWriteLeavesNoTrace(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	put(t, d, 5)
	before := d.log.Size()
	err := d.Put([]byte("k"), make([]byte, btree.MaxValueSize+1))
	if !errors.Is(err, btree.ErrValueTooLarge) {
		t.Fatalf("Put = %v, want ErrValueTooLarge", err)
	}
	if d.log.Size() != before {
		t.Fatalf("log grew from %d to %d for a write that failed", before, d.log.Size())
	}
	wantAll(t, d, 5)
}

func TestACommitLogsPageImages(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	d.Put([]byte("a"), []byte("1"))
	first := d.log.Size()
	if first < pager.Usable {
		t.Fatalf("one Put logged %d bytes; it changed a whole page, so the log holds at least %d", first, pager.Usable)
	}
	s, _ := d.Stats()
	if s.WALBytes != first {
		t.Fatalf("Stats.WALBytes = %d, want %d", s.WALBytes, first)
	}
}

func TestCloseCheckpointsTheLog(t *testing.T) {
	dir := t.TempDir()
	d := open(t, dir)
	put(t, d, 300)
	if err := d.Close(); err != nil {
		t.Fatal(err)
	}
	st, err := os.Stat(filepath.Join(dir, "wal.log"))
	if err != nil || st.Size() != 0 {
		t.Fatalf("log after Close: %v, size %v; a checkpoint empties it", err, st)
	}
	d = open(t, dir)
	defer d.Close()
	wantAll(t, d, 300)
}

func TestSyncAlwaysIsTheDefault(t *testing.T) {
	d, err := Open(t.TempDir(), Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	d.Put([]byte("k"), []byte("v"))
	if d.log.Durable() != d.log.Size() {
		t.Fatalf("durable %d of %d log bytes after a Put with the default options", d.log.Durable(), d.log.Size())
	}
}
