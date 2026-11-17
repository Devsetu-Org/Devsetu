package db

// recoverLog brings the page file up to date with the log in d.dir, then opens
// the log for appending, with anything after the last commit cut off.
func (d *DB) recoverLog() error {
	// TODO(3.4)
	panic("TODO(3.4)")
}

// commit makes the change in t durable and then visible: the log first, the
// pages second. The caller holds d.mu.
func (d *DB) commit(t *txn) error {
	// TODO(3.4)
	panic("TODO(3.4)")
}
