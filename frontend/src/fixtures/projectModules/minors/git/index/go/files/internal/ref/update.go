package ref

import (
	"fmt"

	"github.com/devlabs/tinygit/internal/object"
	"github.com/devlabs/tinygit/internal/repo"
)

// UpdateRef sets name to newHash. If oldHash is non-zero, the current value must match.
// When name is "HEAD" and HEAD is symbolic, the symbolic target is updated instead.
func UpdateRef(r *repo.Repo, name string, newHash object.Hash, oldHash object.Hash) error {
	target := name
	if name == "HEAD" {
		hd, err := ReadHEAD(r)
		if err != nil {
			return err
		}
		if hd.Symbolic != "" {
			target = hd.Symbolic
		} else {
			if !oldHash.IsZero() {
				cur := hd.Hash
				if cur != oldHash {
					return fmt.Errorf("ref: HEAD is %s, expected %s", cur, oldHash)
				}
			}
			return WriteDetachedHEAD(r, newHash)
		}
	}

	if !oldHash.IsZero() {
		cur, err := Read(r, target)
		if err != nil {
			return err
		}
		if cur != oldHash {
			return fmt.Errorf("ref: %s is %s, expected %s", target, cur, oldHash)
		}
	}
	return Write(r, target, newHash)
}
