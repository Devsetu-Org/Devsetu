package diff

import (
	"github.com/devlabs/tinygit/internal/object"
)

// LogWalk walks first-parent history from tip, newest first.
func LogWalk(s *object.Store, tip object.Hash) ([]object.Commit, []object.Hash, error) {
	var commits []object.Commit
	var hashes []object.Hash
	seen := map[object.Hash]bool{}
	cur := tip
	for !cur.IsZero() {
		if seen[cur] {
			break
		}
		seen[cur] = true
		c, err := object.GetCommit(s, cur)
		if err != nil {
			return nil, nil, err
		}
		commits = append(commits, c)
		hashes = append(hashes, cur)
		if len(c.Parents) == 0 {
			break
		}
		cur = c.Parents[0]
	}
	return commits, hashes, nil
}
