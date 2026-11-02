package worktree_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/devlabs/tinygit/internal/index"
	"github.com/devlabs/tinygit/internal/object"
	"github.com/devlabs/tinygit/internal/ref"
	"github.com/devlabs/tinygit/internal/repo"
	"github.com/devlabs/tinygit/internal/worktree"
)

func TestCommitCheckoutRoundTrip(t *testing.T) {
	root := t.TempDir()
	r, err := repo.Init(root)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(root, "dir"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "dir", "a.txt"), []byte("hello\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := index.Add(r, "dir/a.txt"); err != nil {
		t.Fatal(err)
	}
	h, err := worktree.Commit(r, worktree.CommitOpts{Message: "init"})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "dir", "a.txt"), []byte("changed\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := worktree.Checkout(r, h); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(root, "dir", "a.txt"))
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "hello\n" {
		t.Fatalf("%q", data)
	}
	tip, err := ref.ResolveHEAD(r)
	if err != nil || tip != h {
		// Checkout detaches; ResolveHEAD still works
		hd, _ := ref.ReadHEAD(r)
		if hd.Hash != h {
			t.Fatalf("tip %v hd %+v err %v", tip, hd, err)
		}
	}
	c, err := object.GetCommit(r.Objects(), h)
	if err != nil {
		t.Fatal(err)
	}
	entries, err := object.GetTree(r.Objects(), c.Tree)
	if err != nil || len(entries) != 1 || entries[0].Name != "dir" {
		t.Fatalf("%+v %v", entries, err)
	}
}
