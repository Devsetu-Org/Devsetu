package diff

import (
	"github.com/devlabs/tinygit/internal/object"
)

// LogWalk walks first-parent history from tip, newest first.
func LogWalk(s *object.Store, tip object.Hash) ([]object.Commit, []object.Hash, error) {
	// TODO(5.1)
	panic("TODO(5.1)")
}
