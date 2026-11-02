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
func Checkout(r *repo.Repo, commit object.Hash) error {
	// TODO(4.3): Load commit tree into path→hash. safetyCheck against dirty worktree.
	// Remove index paths missing from target. Write blobs to worktree. Save new index.
	// WriteDetachedHEAD(commit).
	panic("TODO(4.3): Checkout")
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
			continue
		}
		th, inTarget := target[e.Path]
		if inTarget && th == workHash {
			continue
		}
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
