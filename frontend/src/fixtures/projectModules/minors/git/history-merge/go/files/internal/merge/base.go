package merge

import (
	"github.com/devlabs/tinygit/internal/object"
)

// MergeBase returns a common ancestor of a and b (BFS from a, mark; walk b).
func MergeBase(s *object.Store, a, b object.Hash) (object.Hash, error) {
	// TODO(5.3)
	panic("TODO(5.3)")
}
