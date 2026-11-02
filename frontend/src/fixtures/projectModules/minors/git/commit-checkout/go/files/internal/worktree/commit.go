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
	// TODO(4.2): Require message. WriteTree. Parent = ResolveHEAD if present.
	// Author defaults to "tinygit <tinygit@devlabs>" plus unix time +0000.
	// PutCommit, then UpdateRef HEAD to the new hash.
	// Imports: fmt, time, ref.
	panic("TODO(4.2): Commit")
}

func isNotExist(err error) bool {
	return os.IsNotExist(err)
}
