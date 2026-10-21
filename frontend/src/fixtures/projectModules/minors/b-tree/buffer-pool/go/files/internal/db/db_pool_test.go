package db

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/devlabs/btreekv/internal/wal"
)

func openPool(t *testing.T, dir string, frames int) *DB {
	t.Helper()
	d, err := Open(dir, Options{Sync: wal.SyncNever, PoolFrames: frames})
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	return d
}

func TestTinyPoolStillCorrect(t *testing.T) {
	d := openPool(t, t.TempDir(), 4)
	defer d.Close()
	put(t, d, 1500)
	wantAll(t, d, 1500)
	s, _ := d.Stats()
	if s.Resident > 4 {
		t.Fatalf("Resident = %d in a 4-frame pool", s.Resident)
	}
	if s.Height < 2 {
		t.Fatalf("height %d: the workload should need more pages than the pool has", s.Height)
	}
}

func TestPoolKeepsDirtyPagesOffTheFile(t *testing.T) {
	d := openPool(t, t.TempDir(), 64)
	defer d.Close()
	put(t, d, 20)
	s, _ := d.Stats()
	if s.Dirty == 0 {
		t.Fatalf("stats %+v: committed pages should be waiting dirty in the pool", s)
	}
	if s.WALBytes == 0 {
		t.Fatal("the log should hold the committed writes")
	}
}

func TestCrashLosesTheCacheButNotTheData(t *testing.T) {
	dir := t.TempDir()
	d := openPool(t, dir, 8)
	put(t, d, 800) // many pages evicted, some still dirty in the pool
	d2 := openPool(t, dir, 8)
	defer d2.Close()
	wantAll(t, d2, 800)
}

func TestEvictionForcesTheLogDurable(t *testing.T) {
	d := openPool(t, t.TempDir(), 4)
	defer d.Close()
	if d.log.Durable() != 0 {
		t.Fatalf("durable = %d before any write", d.log.Durable())
	}
	put(t, d, 1500) // SyncNever: Append never fsyncs, so only the pool can
	if d.log.Durable() == 0 {
		t.Fatal("the pool evicted dirty pages without ever making the log durable")
	}
	if d.log.Durable() > d.log.Size() {
		t.Fatalf("durable %d beyond log size %d", d.log.Durable(), d.log.Size())
	}
}

func TestCloseFlushesThePoolAndEmptiesTheLog(t *testing.T) {
	dir := t.TempDir()
	d := openPool(t, dir, 16)
	put(t, d, 500)
	if err := d.Close(); err != nil {
		t.Fatal(err)
	}
	if st, err := os.Stat(filepath.Join(dir, "wal.log")); err != nil || st.Size() != 0 {
		t.Fatalf("log after Close: %v %v", st, err)
	}
	// With an empty log, data.db alone must hold everything.
	d = openPool(t, dir, 16)
	defer d.Close()
	wantAll(t, d, 500)
}

func TestConcurrentReadersWithAWriter(t *testing.T) {
	d := openPool(t, t.TempDir(), 6)
	defer d.Close()
	put(t, d, 300)
	var wg sync.WaitGroup
	stop := make(chan struct{})
	for r := 0; r < 3; r++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; ; i = (i + 7) % 300 {
				select {
				case <-stop:
					return
				default:
				}
				k := fmt.Sprintf("k%04d", i)
				if v, ok, err := d.Get([]byte(k)); err != nil || !ok || string(v) != fmt.Sprintf("v%d", i) {
					t.Errorf("Get(%s) = %q, %v, %v", k, v, ok, err)
					return
				}
			}
		}()
	}
	for i := 300; i < 900; i++ {
		if err := d.Put([]byte(fmt.Sprintf("k%04d", i)), []byte(fmt.Sprintf("v%d", i))); err != nil {
			t.Fatal(err)
		}
	}
	close(stop)
	wg.Wait()
	wantAll(t, d, 900)
}
