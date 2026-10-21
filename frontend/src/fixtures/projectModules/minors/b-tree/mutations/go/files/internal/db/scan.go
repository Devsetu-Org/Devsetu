package db

import ()

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
	// TODO(5.4): tree := btree.New(d.store). no, err := tree.SeekLeaf(start) finds the
	// leaf where the range begins; it is 0 for an empty tree.
	// Then follow the leaf chain, never going back up the tree: for each leaf,
	// leaf, err := tree.ReadLeaf(no); skip to the first key >= start
	// (sort.Search with bytes.Compare); for each key from there, if end != nil
	// and key >= end return nil; call fn(key, value) and return nil if it says
	// false. Then no = leaf.Next, until it is 0.
	//
	// You will need to import bytes, sort, and the btree package.
	panic("TODO(5.4): Scan")
}
