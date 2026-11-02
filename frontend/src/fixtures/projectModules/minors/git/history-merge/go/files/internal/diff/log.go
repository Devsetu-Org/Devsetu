package diff

import (
	"github.com/devlabs/tinygit/internal/object"
)

// LogWalk walks first-parent history from tip, newest first.
func LogWalk(s *object.Store, tip object.Hash) ([]object.Commit, []object.Hash, error) {
	// TODO(5.1): Follow Parents[0] until none. Skip cycles with a seen set.
	// Return commits and their hashes, newest first.
	panic("TODO(5.1): LogWalk")
}
