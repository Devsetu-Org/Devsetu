package btree

import (
	"github.com/devlabs/btreekv/internal/pager"
)

// childIndex says which child of internal node n a lookup for key descends
// into: the number of separators that are <= key. A key equal to a separator
// belongs to the right of it.
func (n *node) childIndex(key []byte) int {
	// TODO(2.1): Binary search n.keys for the first separator that is greater than key
	// (sort.Search with bytes.Compare). That index is the child to follow:
	// separators at or below key send the search right.
	//
	// You will need to import bytes and sort.
	panic("TODO(2.1): childIndex")
}

// leafIndex returns the position of key in leaf n, or where it would be
// inserted, and whether it is there.
func (n *node) leafIndex(key []byte) (int, bool) {
	// TODO(2.1): Binary search n.keys for the first key >= key. It is a hit when that
	// index is in range and bytes.Equal says the keys match.
	panic("TODO(2.1): leafIndex")
}

// findLeaf walks from the root to the leaf that holds, or would hold, key. It
// returns that leaf and its page number; for an empty tree both are zero.
func (t *Tree) findLeaf(key []byte) (pager.PageNo, *node, error) {
	// TODO(2.2): Start at no := t.io.Root(); if it is 0 the tree is empty, return
	// 0, nil, nil. Then loop at most maxDepth times: n, err := t.load(no); if
	// n.leaf return no, n, nil; otherwise no = n.children[n.childIndex(key)].
	// Running out of depth means a pointer cycle: return ErrCorrupt.
	panic("TODO(2.2): findLeaf")
}

// Get returns the value stored under key. ok is false when the key is absent.
func (t *Tree) Get(key []byte) (value []byte, ok bool, err error) {
	// TODO(2.2): Find the leaf with findLeaf (an empty tree gives a nil leaf), then
	// look the key up with leafIndex. The leaf was decoded from the page, so
	// its value is already a private copy.
	panic("TODO(2.2): Get")
}
