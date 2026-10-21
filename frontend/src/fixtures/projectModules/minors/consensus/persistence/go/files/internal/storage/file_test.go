package storage

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestFileMissingIsEmpty(t *testing.T) {
	f, err := NewFile(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	got, err := f.Load()
	if err != nil || got != nil {
		t.Fatalf("Load on an empty dir = %q, %v; want nil, nil", got, err)
	}
}

func TestFileSaveThenLoad(t *testing.T) {
	dir := t.TempDir()
	f, _ := NewFile(dir)
	if err := f.Save([]byte("term=3")); err != nil {
		t.Fatalf("Save: %v", err)
	}
	// A second handle on the same directory is a restarted process.
	g, _ := NewFile(dir)
	got, err := g.Load()
	if err != nil || !bytes.Equal(got, []byte("term=3")) {
		t.Fatalf("Load = %q, %v; want term=3", got, err)
	}
}

func TestFileSaveReplacesAndLeavesNoTempFile(t *testing.T) {
	dir := t.TempDir()
	f, _ := NewFile(dir)
	f.Save([]byte("a-long-first-value"))
	if err := f.Save([]byte("b")); err != nil {
		t.Fatal(err)
	}
	got, _ := f.Load()
	if string(got) != "b" {
		t.Fatalf("after a second Save, Load = %q, want b", got)
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 1 {
		var names []string
		for _, e := range entries {
			names = append(names, e.Name())
		}
		t.Fatalf("dir holds %v; Save must write a temp file and rename it over %s", names, FileName)
	}
}

func TestFileStaleTempFileDoesNotMatter(t *testing.T) {
	dir := t.TempDir()
	f, _ := NewFile(dir)
	f.Save([]byte("good"))
	// A crash during a later Save left a half-written temp file behind.
	os.WriteFile(filepath.Join(dir, FileName+".tmp"), []byte("go"), 0o644)
	got, err := f.Load()
	if err != nil || string(got) != "good" {
		t.Fatalf("Load = %q, %v; a torn temp file must not be read", got, err)
	}
	if err := f.Save([]byte("better")); err != nil {
		t.Fatalf("Save over a stale temp file: %v", err)
	}
	if got, _ := f.Load(); string(got) != "better" {
		t.Fatalf("Load = %q, want better", got)
	}
}
