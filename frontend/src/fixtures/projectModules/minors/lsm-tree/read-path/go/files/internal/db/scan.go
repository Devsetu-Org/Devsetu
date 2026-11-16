package db

// Scan calls fn for every live key in [start, end), in key order, until fn
// returns false. A nil start means from the first key; a nil end means to the
// last. fn must not call back into the DB, and must copy key and value if it
// keeps them.
func (d *DB) Scan(start, end []byte, fn func(key, value []byte) bool) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.log == nil {
		return ErrClosed
	}
	// TODO(4.4)
	panic("TODO(4.4)")
}
