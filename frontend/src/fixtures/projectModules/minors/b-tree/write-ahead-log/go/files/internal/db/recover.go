package db

// recoverLog brings the page file up to date with the log in d.dir, then opens
// the log for appending, with anything after the last commit cut off.
func (d *DB) recoverLog() error {
	// TODO(3.4): path := filepath.Join(d.dir, walName). Call wal.Replay(path, ...) with a
	// callback that collects records into a pending batch. When the record is
	// a wal.KindCommit, d.apply(pending) (return its error), empty pending,
	// and remember end as the offset of the last commit.
	// Records after the last commit belong to a batch that never finished:
	// they are never applied. Finally d.log, err = wal.OpenAppend(path,
	// lastCommit, d.opts.Sync), which cuts the log back to the last commit.
	// Cut there, not at the offset Replay returns: complete records of an
	// unfinished batch must not be left in front of the next commit.
	//
	// You will need to import path/filepath and the wal package.
	panic("TODO(3.4): recoverLog")
}

// commit makes the change in t durable and then visible: the log first, the
// pages second. The caller holds d.mu.
func (d *DB) commit(t *txn) error {
	// TODO(3.4): recs := t.records() and start := d.log.Size(). Append the whole batch
	// with d.log.Append(recs...). If that fails, take the partial batch back
	// with d.log.Rewind(start) and return the error: a write that did not
	// reach the log must not reach the pages.
	// Only after the append succeeded, return d.apply(recs).
	panic("TODO(3.4): commit")
}
