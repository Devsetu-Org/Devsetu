package worktree

import (
	"github.com/devlabs/tinygit/internal/object"
	"github.com/devlabs/tinygit/internal/repo"
)

// WriteTree builds a nested tree from the index and returns the root tree hash.
func WriteTree(r *repo.Repo) (object.Hash, error) {
	// TODO(4.1): Load index. Build a nested map by splitting paths on "/".
	// Recursively PutTree: files are ModeFile entries; dirs become ModeTree children.
	// Imports: fmt, path, sort, strings, index.
	panic("TODO(4.1): WriteTree")
}
