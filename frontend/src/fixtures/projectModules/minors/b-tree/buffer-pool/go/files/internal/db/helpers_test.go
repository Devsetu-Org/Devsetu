package db

import (
	"fmt"
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
