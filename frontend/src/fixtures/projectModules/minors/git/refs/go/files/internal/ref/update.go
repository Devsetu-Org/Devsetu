package ref

import (
	"github.com/devlabs/tinygit/internal/object"
	"github.com/devlabs/tinygit/internal/repo"
)

// UpdateRef sets name to newHash. If oldHash is non-zero, the current value must match.
// When name is "HEAD" and HEAD is symbolic, the symbolic target is updated instead.
func UpdateRef(r *repo.Repo, name string, newHash object.Hash, oldHash object.Hash) error {
	// TODO(2.3): If name == "HEAD", ReadHEAD; symbolic → update that ref; detached → WriteDetachedHEAD.
	// Otherwise Write the named ref. When oldHash is set, compare against the current value first.
	// Import fmt for mismatch errors.
	panic("TODO(2.3): UpdateRef")
}
