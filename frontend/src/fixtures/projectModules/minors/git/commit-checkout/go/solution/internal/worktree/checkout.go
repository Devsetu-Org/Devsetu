package worktree

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/devlabs/tinygit/internal/index"
	"github.com/devlabs/tinygit/internal/object"
	"github.com/devlabs/tinygit/internal/ref"
	"github.com/devlabs/tinygit/internal/repo"
)

// Checkout materializes commit's tree into the worktree and updates HEAD/index.
// Safety: refuse if a tracked worktree file would be overwritten and differs from both
// the current index and the target (would lose local edits).
func Checkout(r *repo.Repo, commit object.Hash) error {
	c, err := object.GetCommit(r.Objects(), commit)
	if err != nil {
		return err
	}
	files, err := flatten(r.Objects(), c.Tree, "")
	if err != nil {
		return err
	}
	idx, err := index.Load(r.IndexPath())
	if err != nil {
		return err
	}
	if err := safetyCheck(r, idx, files); err != nil {
		return err
	}

	// Remove tracked files not in target.
	for _, e := range idx.Entries {
		if _, ok := files[e.Path]; !ok {
			_ = os.Remove(filepath.Join(r.Root, filepath.FromSlash(e.Path)))
		}
	}

	var newIdx index.Index
	for path, h := range files {
		data, err := object.GetBlob(r.Objects(), h)
		if err != nil {
			return err
		}
		abs := filepath.Join(r.Root, filepath.FromSlash(path))
		if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
			return err
		}
		if err := os.WriteFile(abs, data, 0o644); err != nil {
			return err
		}
		newIdx.Set(index.Entry{Path: path, Mode: object.ModeFile, Hash: h})
	}
	if err := index.Save(r.IndexPath(), newIdx); err != nil {
		return err
	}
	return ref.WriteDetachedHEAD(r, commit)
}

// CheckoutBranch checks out the tip of a branch and sets symbolic HEAD.
func CheckoutBranch(r *repo.Repo, branch string) error {
	name := "refs/heads/" + branch
	h, err := ref.Read(r, name)
	if err != nil {
		return err
	}
	if err := Checkout(r, h); err != nil {
		return err
	}
	return ref.WriteSymbolicHEAD(r, name)
}

func safetyCheck(r *repo.Repo, idx index.Index, target map[string]object.Hash) error {
	for _, e := range idx.Entries {
		abs := filepath.Join(r.Root, filepath.FromSlash(e.Path))
		data, err := os.ReadFile(abs)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return err
		}
		raw := object.EncodeHeader(object.TypeBlob, data)
		workHash := object.HashOf(raw)
		if workHash == e.Hash {
			continue // clean
		}
		th, inTarget := target[e.Path]
		if inTarget && th == workHash {
			continue
		}
		// dirty and would change
		if !inTarget || th != e.Hash {
			return fmt.Errorf("worktree: local changes would be overwritten: %s", e.Path)
		}
	}
	return nil
}

func flatten(s *object.Store, tree object.Hash, prefix string) (map[string]object.Hash, error) {
	entries, err := object.GetTree(s, tree)
	if err != nil {
		return nil, err
	}
	out := map[string]object.Hash{}
	for _, e := range entries {
		path := e.Name
		if prefix != "" {
			path = prefix + "/" + e.Name
		}
		switch e.Mode {
		case object.ModeTree:
			sub, err := flatten(s, e.Hash, path)
			if err != nil {
				return nil, err
			}
			for k, v := range sub {
				out[k] = v
			}
		case object.ModeFile:
			out[path] = e.Hash
		}
	}
	return out, nil
}
