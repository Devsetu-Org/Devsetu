package merge_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/devlabs/tinygit/internal/diff"
	"github.com/devlabs/tinygit/internal/index"
	"github.com/devlabs/tinygit/internal/merge"
	"github.com/devlabs/tinygit/internal/object"
	"github.com/devlabs/tinygit/internal/ref"
	"github.com/devlabs/tinygit/internal/repo"
	"github.com/devlabs/tinygit/internal/worktree"
)

func commitFile(t *testing.T, r *repo.Repo, path, content, msg string) object.Hash {
	t.Helper()
	abs := filepath.Join(r.Root, filepath.FromSlash(path))
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(abs, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := index.Add(r, path); err != nil {
		t.Fatal(err)
	}
	h, err := worktree.Commit(r, worktree.CommitOpts{Message: msg})
	if err != nil {
		t.Fatal(err)
	}
	return h
}

func TestLogDiffMerge(t *testing.T) {
	root := t.TempDir()
	r, err := repo.Init(root)
	if err != nil {
		t.Fatal(err)
	}
	base := commitFile(t, r, "f.txt", "base\n", "base")

	// branch feature from base
	if err := ref.Write(r, "refs/heads/feature", base); err != nil {
		t.Fatal(err)
	}
	if err := worktree.CheckoutBranch(r, "feature"); err != nil {
		t.Fatal(err)
	}
	feature := commitFile(t, r, "f.txt", "feature\n", "feature")

	if err := worktree.CheckoutBranch(r, "main"); err != nil {
		t.Fatal(err)
	}
	main := commitFile(t, r, "f.txt", "main\n", "main")

	_, hashes, err := diff.LogWalk(r.Objects(), main)
	if err != nil || len(hashes) < 2 {
		t.Fatalf("%v %v", hashes, err)
	}

	oc, _ := object.GetCommit(r.Objects(), main)
	tc, _ := object.GetCommit(r.Objects(), feature)
	changes, err := diff.TreeDiff(r.Objects(), oc.Tree, tc.Tree)
	if err != nil || len(changes) != 1 || changes[0].Path != "f.txt" {
		t.Fatalf("%+v %v", changes, err)
	}

	mb, err := merge.MergeBase(r.Objects(), main, feature)
	if err != nil || mb != base {
		t.Fatalf("base %v want %v err %v", mb, base, err)
	}

	_, err = merge.Merge(r, "feature")
	if err == nil || !strings.Contains(err.Error(), "conflict") {
		t.Fatalf("want conflict, got %v", err)
	}
	data, _ := os.ReadFile(filepath.Join(root, "f.txt"))
	if !strings.Contains(string(data), merge.MarkerOurs) || !strings.Contains(string(data), merge.MarkerTheirs) {
		t.Fatalf("markers missing: %q", data)
	}
}

func TestFastForward(t *testing.T) {
	root := t.TempDir()
	r, err := repo.Init(root)
	if err != nil {
		t.Fatal(err)
	}
	base := commitFile(t, r, "a.txt", "1\n", "base")
	if err := ref.Write(r, "refs/heads/feature", base); err != nil {
		t.Fatal(err)
	}
	if err := worktree.CheckoutBranch(r, "feature"); err != nil {
		t.Fatal(err)
	}
	tip := commitFile(t, r, "a.txt", "2\n", "feat")
	if err := worktree.CheckoutBranch(r, "main"); err != nil {
		t.Fatal(err)
	}
	res, err := merge.Merge(r, "feature")
	if err != nil {
		t.Fatal(err)
	}
	if !res.FastForward || res.Commit != tip {
		t.Fatalf("%+v", res)
	}
	data, _ := os.ReadFile(filepath.Join(root, "a.txt"))
	if string(data) != "2\n" {
		t.Fatalf("%q", data)
	}
}

func TestCleanMerge(t *testing.T) {
	root := t.TempDir()
	r, err := repo.Init(root)
	if err != nil {
		t.Fatal(err)
	}
	base := commitFile(t, r, "shared.txt", "s\n", "base")
	if err := ref.Write(r, "refs/heads/feature", base); err != nil {
		t.Fatal(err)
	}
	if err := worktree.CheckoutBranch(r, "feature"); err != nil {
		t.Fatal(err)
	}
	_ = commitFile(t, r, "feat.txt", "f\n", "feat")
	if err := worktree.CheckoutBranch(r, "main"); err != nil {
		t.Fatal(err)
	}
	_ = commitFile(t, r, "main.txt", "m\n", "main")
	res, err := merge.Merge(r, "feature")
	if err != nil {
		t.Fatal(err)
	}
	if res.FastForward || len(res.Conflicts) != 0 || res.Commit.IsZero() {
		t.Fatalf("%+v", res)
	}
	for _, p := range []string{"shared.txt", "feat.txt", "main.txt"} {
		if _, err := os.Stat(filepath.Join(root, p)); err != nil {
			t.Fatal(p, err)
		}
	}
}
