package merge

import (
	"github.com/devlabs/tinygit/internal/object"
)

// MergeBase returns a common ancestor of a and b (BFS from a, mark; walk b).
func MergeBase(s *object.Store, a, b object.Hash) (object.Hash, error) {
	ancestors := map[object.Hash]bool{}
	queue := []object.Hash{a}
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		if ancestors[cur] || cur.IsZero() {
			continue
		}
		ancestors[cur] = true
		c, err := object.GetCommit(s, cur)
		if err != nil {
			return object.Zero, err
		}
		queue = append(queue, c.Parents...)
	}
	queue = []object.Hash{b}
	seen := map[object.Hash]bool{}
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		if seen[cur] || cur.IsZero() {
			continue
		}
		seen[cur] = true
		if ancestors[cur] {
			return cur, nil
		}
		c, err := object.GetCommit(s, cur)
		if err != nil {
			return object.Zero, err
		}
		queue = append(queue, c.Parents...)
	}
	return object.Zero, nil
}
