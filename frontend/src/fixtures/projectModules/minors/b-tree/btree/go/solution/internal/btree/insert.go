package btree

import (
	"slices"

	"github.com/devlabs/btreekv/internal/pager"
)

// leafPut stores key -> val in leaf n, keeping the keys sorted. An existing
// key is overwritten.
func (n *node) leafPut(key, val []byte) {
	i, found := n.leafIndex(key)
	if found {
		n.vals[i] = val
		return
	}
	n.keys = slices.Insert(n.keys, i, key)
	n.vals = slices.Insert(n.vals, i, val)
}

// split cuts an overfull node in two. n keeps the left part; the returned
// node is the new right sibling and sep is the key the parent will use to tell
// them apart.
//
// A leaf keeps every entry, so the separator is a copy of the right node's
// first key. An internal node's separator moves up and appears in neither half.
// The new right leaf inherits n.next; the caller points n.next at the new page.
func (n *node) split() (right *node, sep []byte) {
	at := n.splitPoint()
	if n.leaf {
		right = &node{
			leaf: true,
			keys: slices.Clone(n.keys[at:]),
			vals: slices.Clone(n.vals[at:]),
			next: n.next,
		}
		n.keys, n.vals = n.keys[:at], n.vals[:at]
		return right, right.keys[0]
	}
	sep = n.keys[at]
	right = &node{
		keys:     slices.Clone(n.keys[at+1:]),
		children: slices.Clone(n.children[at+1:]),
	}
	n.keys, n.children = n.keys[:at], n.children[:at+1]
	return right, sep
}

// Insert stores val under key, overwriting any existing value.
func (t *Tree) Insert(key, val []byte) error {
	if err := checkEntry(key, val); err != nil {
		return err
	}
	root := t.io.Root()
	if root == 0 {
		leaf := &node{leaf: true, keys: [][]byte{key}, vals: [][]byte{val}}
		no, err := t.newPage(leaf)
		if err != nil {
			return err
		}
		t.io.SetRoot(no)
		return nil
	}
	up, err := t.insert(root, key, val)
	if err != nil || up == nil {
		return err
	}
	newRoot := &node{keys: [][]byte{up.sep}, children: []pager.PageNo{root, up.right}}
	no, err := t.newPage(newRoot)
	if err != nil {
		return err
	}
	t.io.SetRoot(no)
	return nil
}

// insert adds key beneath page no. When the page had to split it returns the
// separator and right page its parent must add; otherwise nil.
func (t *Tree) insert(no pager.PageNo, key, val []byte) (*promoted, error) {
	n, err := t.load(no)
	if err != nil {
		return nil, err
	}
	if n.leaf {
		n.leafPut(key, val)
	} else {
		i := n.childIndex(key)
		up, err := t.insert(n.children[i], key, val)
		if err != nil || up == nil {
			return nil, err
		}
		n.insertChild(i, up.sep, up.right)
	}
	if n.fits() {
		return nil, t.store(no, n)
	}
	right, sep := n.split()
	rightNo, err := t.io.Allocate()
	if err != nil {
		return nil, err
	}
	if n.leaf {
		n.next = rightNo
	}
	if err := t.store(rightNo, right); err != nil {
		return nil, err
	}
	if err := t.store(no, n); err != nil {
		return nil, err
	}
	return &promoted{sep: sep, right: rightNo}, nil
}
