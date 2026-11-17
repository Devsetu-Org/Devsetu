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
	// TODO(5.4)
	panic("TODO(5.4)")
}
