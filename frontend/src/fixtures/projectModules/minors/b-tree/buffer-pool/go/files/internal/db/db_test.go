package db

import (
	"fmt"
	"sync"
	"testing"

	"github.com/devlabs/btreekv/internal/wal"
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

func TestPutGetOverwrite(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	if err := d.Put([]byte("order:1"), []byte("pending")); err != nil {
		t.Fatal(err)
	}
	d.Put([]byte("order:2"), []byte("paid"))
	d.Put([]byte("order:1"), []byte("shipped"))
	mustGet(t, d, "order:1", "shipped", true)
	mustGet(t, d, "order:2", "paid", true)
	mustGet(t, d, "order:3", "", false)
}

func TestGetReturnsACopy(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	d.Put([]byte("k"), []byte("value"))
	v, _, _ := d.Get([]byte("k"))
	v[0] = 'X'
	mustGet(t, d, "k", "value", true)
}

func TestManyKeysSplitTheTree(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	const n = 3000
	for i := 0; i < n; i++ {
		if err := d.Put([]byte(fmt.Sprintf("user:%05d", (i*7919)%n)), []byte(fmt.Sprintf("name-%d", i))); err != nil {
			t.Fatalf("Put %d: %v", i, err)
		}
	}
	s, err := d.Stats()
	if err != nil {
		t.Fatalf("Stats: %v", err)
	}
	if s.Keys != n || s.Height < 2 {
		t.Fatalf("stats = %+v, want %d keys in a tree at least 2 levels tall", s, n)
	}
}

func TestReopenKeepsEverything(t *testing.T) {
	dir := t.TempDir()
	d := open(t, dir)
	for i := 0; i < 1500; i++ {
		d.Put([]byte(fmt.Sprintf("k%04d", i)), []byte(fmt.Sprintf("v%d", i)))
	}
	if err := d.Close(); err != nil {
		t.Fatal(err)
	}
	d = open(t, dir)
	defer d.Close()
	for i := 0; i < 1500; i += 11 {
		mustGet(t, d, fmt.Sprintf("k%04d", i), fmt.Sprintf("v%d", i), true)
	}
	if s, err := d.Stats(); err != nil || s.Keys != 1500 {
		t.Fatalf("after reopen: %+v, %v", s, err)
	}
}

func TestClosedDB(t *testing.T) {
	d := open(t, t.TempDir())
	d.Close()
	if err := d.Put([]byte("k"), []byte("v")); err != ErrClosed {
		t.Fatalf("Put after Close = %v, want ErrClosed", err)
	}
	if _, _, err := d.Get([]byte("k")); err != ErrClosed {
		t.Fatalf("Get after Close = %v, want ErrClosed", err)
	}
	if err := d.Close(); err != ErrClosed {
		t.Fatalf("second Close = %v, want ErrClosed", err)
	}
}

func TestConcurrentPutGet(t *testing.T) {
	d := open(t, t.TempDir())
	defer d.Close()
	var wg sync.WaitGroup
	for w := 0; w < 4; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			for i := 0; i < 300; i++ {
				k := fmt.Sprintf("w%d-%04d", w, i)
				if err := d.Put([]byte(k), []byte(k)); err != nil {
					t.Errorf("Put: %v", err)
					return
				}
				if v, ok, err := d.Get([]byte(k)); err != nil || !ok || string(v) != k {
					t.Errorf("Get(%q) = %q, %v, %v", k, v, ok, err)
					return
				}
			}
		}(w)
	}
	wg.Wait()
	if s, err := d.Stats(); err != nil || s.Keys != 1200 {
		t.Fatalf("stats = %+v, %v", s, err)
	}
}
