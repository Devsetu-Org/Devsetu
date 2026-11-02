package merge

import (
	"github.com/devlabs/tinygit/internal/object"
)

// MergeBase returns a common ancestor of a and b (BFS from a, mark; walk b).
func MergeBase(s *object.Store, a, b object.Hash) (object.Hash, error) {
	// TODO(5.3): Mark all ancestors of a. Walk b; return the first commit already marked.
	panic("TODO(5.3): MergeBase")
}
