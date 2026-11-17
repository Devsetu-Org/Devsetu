package index_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/devlabs/tinygit/internal/index"
	"github.com/devlabs/tinygit/internal/repo"
)

func TestCodecAndAddStatus(t *testing.T) {
	root := t.TempDir()
	r, err := repo.Init(root)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "a.txt"), []byte("one\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := index.Add(r, "a.txt"); err != nil {
		t.Fatal(err)
	}
	idx, err := index.Load(r.IndexPath())
	if err != nil {
		t.Fatal(err)
	}
	if len(idx.Entries) != 1 || idx.Entries[0].Path != "a.txt" {
		t.Fatalf("%+v", idx)
	}
	data, err := index.Encode(idx)
	if err != nil {
		t.Fatal(err)
	}
	idx2, err := index.Decode(data)
	if err != nil || len(idx2.Entries) != 1 {
		t.Fatalf("%+v %v", idx2, err)
	}

	st, err := index.Status(r)
	if err != nil {
		t.Fatal(err)
	}
	if len(st.Staged) != 1 || st.Staged[0] != "a.txt" {
		t.Fatalf("staged %+v", st)
	}
	if err := os.WriteFile(filepath.Join(root, "a.txt"), []byte("two\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	st, err = index.Status(r)
	if err != nil {
		t.Fatal(err)
	}
	if len(st.Modified) != 1 {
		t.Fatalf("modified %+v", st)
	}
	if err := os.WriteFile(filepath.Join(root, "b.txt"), []byte("u\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	st, err = index.Status(r)
	if err != nil {
		t.Fatal(err)
	}
	if len(st.Untracked) != 1 || st.Untracked[0] != "b.txt" {
		t.Fatalf("untracked %+v", st)
	}
}
