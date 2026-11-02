package worktree

import (
	"fmt"
	"os"
	"time"

	"github.com/devlabs/tinygit/internal/object"
	"github.com/devlabs/tinygit/internal/ref"
	"github.com/devlabs/tinygit/internal/repo"
)

// CommitOpts controls author identity for Commit.
type CommitOpts struct {
	Message string
	Author  string // "Name <email>"; timestamp appended
}

// Commit writes a tree from the index, creates a commit, and advances HEAD.
func Commit(r *repo.Repo, opts CommitOpts) (object.Hash, error) {
	if opts.Message == "" {
		return object.Zero, fmt.Errorf("worktree: empty commit message")
	}
	tree, err := WriteTree(r)
	if err != nil {
		return object.Zero, err
	}
	var parents []object.Hash
	if parent, err := ref.ResolveHEAD(r); err == nil && !parent.IsZero() {
		parents = []object.Hash{parent}
	} else if err != nil && !os.IsNotExist(err) {
		// missing ref on first commit is fine
		if !isNotExist(err) {
			return object.Zero, err
		}
	}
	author := opts.Author
	if author == "" {
		author = "tinygit <tinygit@devlabs>"
	}
	stamp := fmt.Sprintf("%s %d +0000", author, time.Now().Unix())
	c := object.Commit{
		Tree:      tree,
		Parents:   parents,
		Author:    stamp,
		Committer: stamp,
		Message:   opts.Message,
	}
	h, err := object.PutCommit(r.Objects(), c)
	if err != nil {
		return object.Zero, err
	}
	if err := ref.UpdateRef(r, "HEAD", h, object.Zero); err != nil {
		return object.Zero, err
	}
	return h, nil
}

func isNotExist(err error) bool {
	return os.IsNotExist(err)
}
