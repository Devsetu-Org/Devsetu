package btree

import (
	"github.com/devlabs/btreekv/internal/pager"
)

// delete removes key from the subtree at page no. It reports whether the key
// was there, and whether page no is now underfull, so its parent can fix it.
func (t *Tree) delete(no pager.PageNo, key []byte) (found, under bool, err error) {
	// TODO(5.1)
	panic("TODO(5.1)")
}

// rebalance repairs child i of internal node parent (stored at parentNo),
// which has just become underfull, using a sibling: it merges the two pages
// when they fit in one, and otherwise borrows from the fuller one. It rewrites
// every page it changed, parent included.
func (t *Tree) rebalance(parentNo pager.PageNo, parent *node, i int) error {
	// TODO(5.2)
	panic("TODO(5.2)")
}

// Delete removes key and reports whether it was there.
func (t *Tree) Delete(key []byte) (bool, error) {
	// TODO(5.3)
	panic("TODO(5.3)")
}
