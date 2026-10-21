package btree

import (
	"bytes"
	"sort"

	"github.com/devlabs/btreekv/internal/pager"
)

// childIndex says which child of internal node n a lookup for key descends
// into: the number of separators that are <= key. A key equal to a separator
// belongs to the right of it.
func (n *node) childIndex(key []byte) int {
	return sort.Search(len(n.keys), func(i int) bool { return bytes.Compare(n.keys[i], key) > 0 })
}

// leafIndex returns the position of key in leaf n, or where it would be
// inserted, and whether it is there.
func (n *node) leafIndex(key []byte) (int, bool) {
	i := sort.Search(len(n.keys), func(i int) bool { return bytes.Compare(n.keys[i], key) >= 0 })
	return i, i < len(n.keys) && bytes.Equal(n.keys[i], key)
}

// findLeaf walks from the root to the leaf that holds, or would hold, key. It
// returns that leaf and its page number; for an empty tree both are zero.
func (t *Tree) findLeaf(key []byte) (pager.PageNo, *node, error) {
	no := t.io.Root()
	if no == 0 {
		return 0, nil, nil
	}
	for depth := 0; depth < maxDepth; depth++ {
		n, err := t.load(no)
		if err != nil {
			return 0, nil, err
		}
		if n.leaf {
			return no, n, nil
		}
		no = n.children[n.childIndex(key)]
	}
	return 0, nil, ErrCorrupt
}

// Get returns the value stored under key. ok is false when the key is absent.
func (t *Tree) Get(key []byte) (value []byte, ok bool, err error) {
	_, leaf, err := t.findLeaf(key)
	if err != nil || leaf == nil {
		return nil, false, err
	}
	i, found := leaf.leafIndex(key)
	if !found {
		return nil, false, nil
	}
	return leaf.vals[i], true, nil
}
