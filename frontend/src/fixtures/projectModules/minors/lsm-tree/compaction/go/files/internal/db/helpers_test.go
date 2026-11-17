package db

import (
	"path/filepath"
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

func tableFiles(t *testing.T, dir string) []string {
	t.Helper()
	m, _ := filepath.Glob(filepath.Join(dir, "*.sst"))
	return m
}
