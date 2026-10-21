package btree

import (
	"github.com/devlabs/btreekv/internal/pager"
)

// leafPut stores key -> val in leaf n, keeping the keys sorted. An existing
// key is overwritten.
func (n *node) leafPut(key, val []byte) {
	// TODO(2.3): i, found := n.leafIndex(key). If found, replace n.vals[i]. Otherwise
	// insert key into n.keys and val into n.vals at index i (slices.Insert),
	// so both stay sorted and in step.
	//
	// You will need to import slices.
	panic("TODO(2.3): leafPut")
}

// split cuts an overfull node in two. n keeps the left part; the returned
// node is the new right sibling and sep is the key the parent will use to tell
// them apart.
//
// A leaf keeps every entry, so the separator is a copy of the right node's
// first key. An internal node's separator moves up and appears in neither half.
// The new right leaf inherits n.next; the caller points n.next at the new page.
func (n *node) split() (right *node, sep []byte) {
	// TODO(2.4): at := n.splitPoint(). Leaf: right gets slices.Clone(n.keys[at:]),
	// slices.Clone(n.vals[at:]) and next: n.next; n keeps keys[:at] and
	// vals[:at]; sep is right.keys[0].
	// Internal: sep = n.keys[at]. right gets a clone of n.keys[at+1:] and of
	// n.children[at+1:]; n keeps keys[:at] and children[:at+1], one more child
	// than keys. Clone the right half: do not let two nodes share an array.
	panic("TODO(2.4): split")
}

// Insert stores val under key, overwriting any existing value.
func (t *Tree) Insert(key, val []byte) error {
	// TODO(2.5): checkEntry(key, val) first. Empty tree (t.io.Root() == 0): make a leaf
	// node{leaf: true, keys: [][]byte{key}, vals: [][]byte{val}}, give it a
	// page with t.newPage, and SetRoot to it.
	// Otherwise up, err := t.insert(root, key, val). If up is nil nothing
	// split. If it is not, the root itself split: build an internal node
	// {keys: [up.sep], children: [oldRoot, up.right]}, newPage it, SetRoot to
	// it. That is the only way a B+ tree gets taller.
	panic("TODO(2.5): Insert")
}

// insert adds key beneath page no. When the page had to split it returns the
// separator and right page its parent must add; otherwise nil.
func (t *Tree) insert(no pager.PageNo, key, val []byte) (*promoted, error) {
	// TODO(2.5): n, err := t.load(no).
	// Leaf: n.leafPut(key, val).
	// Internal: i := n.childIndex(key); up, err := t.insert(n.children[i], key,
	// val). If up is nil the child absorbed the key and this page is
	// unchanged: return nil. Otherwise n.insertChild(i, up.sep, up.right).
	// Then, either way: if n.fits(), t.store(no, n) and return nil. If not,
	// right, sep := n.split(); rightNo, err := t.io.Allocate(); if n is a
	// leaf set n.next = rightNo (right already inherited the old next); store
	// right at rightNo and n at no; return &promoted{sep, rightNo}.
	panic("TODO(2.5): insert")
}
