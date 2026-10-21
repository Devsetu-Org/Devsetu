package manifest

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestMissingManifestIsEmpty(t *testing.T) {
	s, err := Load(t.TempDir())
	if err != nil || s.NextFile != 1 || len(s.Tables) != 0 {
		t.Fatalf("Load on an empty dir = %+v, %v; want NextFile 1, no tables", s, err)
	}
}

func TestSaveThenLoad(t *testing.T) {
	dir := t.TempDir()
	want := State{NextFile: 12, Tables: []uint64{11, 10, 7}}
	if err := Save(dir, want); err != nil {
		t.Fatalf("Save: %v", err)
	}
	got, err := Load(dir)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Load = %+v, want %+v", got, want)
	}
	data, _ := os.ReadFile(filepath.Join(dir, FileName))
	if string(data) != "lsmkv-manifest v1\nnext 12\ntable 11\ntable 10\ntable 7\n" {
		t.Fatalf("MANIFEST contents:\n%s", data)
	}
}

func TestSaveReplacesAndLeavesNoTempFile(t *testing.T) {
	dir := t.TempDir()
	Save(dir, State{NextFile: 3, Tables: []uint64{2, 1}})
	if err := Save(dir, State{NextFile: 4, Tables: []uint64{3}}); err != nil {
		t.Fatal(err)
	}
	got, _ := Load(dir)
	if got.NextFile != 4 || !reflect.DeepEqual(got.Tables, []uint64{3}) {
		t.Fatalf("after a second Save, Load = %+v", got)
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 1 {
		var names []string
		for _, e := range entries {
			names = append(names, e.Name())
		}
		t.Fatalf("dir holds %v; Save must write a temp file and rename it over MANIFEST", names)
	}
}

func TestStaleTempFileDoesNotMatter(t *testing.T) {
	dir := t.TempDir()
	Save(dir, State{NextFile: 2, Tables: []uint64{1}})
	// A crash during a later Save left a half-written temp file.
	os.WriteFile(filepath.Join(dir, FileName+".tmp"), []byte("lsmkv-manif"), 0o644)
	got, err := Load(dir)
	if err != nil || !reflect.DeepEqual(got.Tables, []uint64{1}) {
		t.Fatalf("Load = %+v, %v; the committed manifest must be unaffected", got, err)
	}
	if err := Save(dir, State{NextFile: 3, Tables: []uint64{2, 1}}); err != nil {
		t.Fatalf("Save over a stale temp file: %v", err)
	}
}

func TestCorruptManifest(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, FileName), []byte("not a manifest\n"), 0o644)
	if _, err := Load(dir); err == nil {
		t.Fatal("Load accepted a file with the wrong header")
	}
}
