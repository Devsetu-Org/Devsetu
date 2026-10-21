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
	// TODO(4.4): merge the memtable iterator and every table's iterator,
	// newest first (memtable, then d.tables in order), with
	// iterator.NewMerging. Seek to start (or SeekToFirst when it is nil) and
	// walk: stop at the first key >= end (when end is set), skip tombstones,
	// and stop when fn returns false. Afterwards return the first table
	// iterator's Err, if any.
	panic("TODO(4.4): Scan")
}
