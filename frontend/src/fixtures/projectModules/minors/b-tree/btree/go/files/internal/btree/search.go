package btree

import (
	"github.com/devlabs/btreekv/internal/pager"
)

// childIndex says which child of internal node n a lookup for key descends
// into: the number of separators that are <= key. A key equal to a separator
// belongs to the right of it.
func (n *node) childIndex(key []byte) int {
	// TODO(2.1)
	panic("TODO(2.1)")
}

// leafIndex returns the position of key in leaf n, or where it would be
// inserted, and whether it is there.
func (n *node) leafIndex(key []byte) (int, bool) {
	// TODO(2.1)
	panic("TODO(2.1)")
}

// findLeaf walks from the root to the leaf that holds, or would hold, key. It
// returns that leaf and its page number; for an empty tree both are zero.
func (t *Tree) findLeaf(key []byte) (pager.PageNo, *node, error) {
	// TODO(2.2)
	panic("TODO(2.2)")
}

// Get returns the value stored under key. ok is false when the key is absent.
func (t *Tree) Get(key []byte) (value []byte, ok bool, err error) {
	// TODO(2.2)
	panic("TODO(2.2)")
}
