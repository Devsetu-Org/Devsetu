package btree

import (
	"fmt"

	"github.com/devlabs/btreekv/internal/pager"
)

// Leaf is one leaf page as a range scan sees it. Keys and Vals are private
// copies.
type Leaf struct {
	Keys [][]byte
	Vals [][]byte
	Next pager.PageNo // right sibling, 0 for the last leaf
}

// SeekLeaf returns the page number of the leaf that holds, or would hold, key,
// or 0 for an empty tree. A nil key finds the leftmost leaf.
func (t *Tree) SeekLeaf(key []byte) (pager.PageNo, error) {
	no, _, err := t.findLeaf(key)
	return no, err
}

// ReadLeaf reads leaf page no.
func (t *Tree) ReadLeaf(no pager.PageNo) (*Leaf, error) {
	n, err := t.load(no)
	if err != nil {
		return nil, err
	}
	if !n.leaf {
		return nil, fmt.Errorf("%w: page %d is not a leaf", ErrCorrupt, no)
	}
	return &Leaf{Keys: n.keys, Vals: n.vals, Next: n.next}, nil
}
