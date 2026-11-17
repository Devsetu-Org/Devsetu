package worktree

import (
	"os"

	"github.com/devlabs/tinygit/internal/object"
	"github.com/devlabs/tinygit/internal/repo"
)

// CommitOpts controls author identity for Commit.
type CommitOpts struct {
	Message string
	Author  string
}

// Commit writes a tree from the index, creates a commit, and advances HEAD.
func Commit(r *repo.Repo, opts CommitOpts) (object.Hash, error) {
	// TODO(4.2)
	panic("TODO(4.2)")
}

func isNotExist(err error) bool {
	return os.IsNotExist(err)
}
