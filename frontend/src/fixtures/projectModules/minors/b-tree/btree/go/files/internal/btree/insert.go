package btree

import (
	"github.com/devlabs/btreekv/internal/pager"
)

// leafPut stores key -> val in leaf n, keeping the keys sorted. An existing
// key is overwritten.
func (n *node) leafPut(key, val []byte) {
	// TODO(2.3)
	panic("TODO(2.3)")
}

// split cuts an overfull node in two. n keeps the left part; the returned
// node is the new right sibling and sep is the key the parent will use to tell
// them apart.
//
// A leaf keeps every entry, so the separator is a copy of the right node's
// first key. An internal node's separator moves up and appears in neither half.
// The new right leaf inherits n.next; the caller points n.next at the new page.
func (n *node) split() (right *node, sep []byte) {
	// TODO(2.4)
	panic("TODO(2.4)")
}

// Insert stores val under key, overwriting any existing value.
func (t *Tree) Insert(key, val []byte) error {
	// TODO(2.5)
	panic("TODO(2.5)")
}

// insert adds key beneath page no. When the page had to split it returns the
// separator and right page its parent must add; otherwise nil.
func (t *Tree) insert(no pager.PageNo, key, val []byte) (*promoted, error) {
	// TODO(2.5)
	panic("TODO(2.5)")
}
