package db

import (
	"bytes"
	"github.com/devlabs/btreekv/internal/btree"
	"sort"
)

// Scan calls fn for every key in [start, end), in key order, until fn returns
// false. A nil start means from the first key; a nil end means to the last. fn
// must not call back into the DB, and must not keep key or value without
// copying them.
func (d *DB) Scan(start, end []byte, fn func(key, value []byte) bool) error {
	d.mu.RLock()
	defer d.mu.RUnlock()
	if d.closed {
		return ErrClosed
	}
	tree := btree.New(d.store)
	no, err := tree.SeekLeaf(start)
	if err != nil {
		return err
	}
	for no != 0 {
		leaf, err := tree.ReadLeaf(no)
		if err != nil {
			return err
		}
		i := sort.Search(len(leaf.Keys), func(i int) bool { return bytes.Compare(leaf.Keys[i], start) >= 0 })
		for ; i < len(leaf.Keys); i++ {
			if end != nil && bytes.Compare(leaf.Keys[i], end) >= 0 {
				return nil
			}
			if !fn(leaf.Keys[i], leaf.Vals[i]) {
				return nil
			}
		}
		no = leaf.Next
	}
	return nil
}
