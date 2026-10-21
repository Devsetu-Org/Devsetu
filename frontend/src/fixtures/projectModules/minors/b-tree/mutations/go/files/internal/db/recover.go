package db

import (
	"github.com/devlabs/btreekv/internal/wal"
	"path/filepath"
)

// recoverLog brings the page file up to date with the log in d.dir, then opens
// the log for appending, with anything after the last commit cut off.
func (d *DB) recoverLog() error {
	path := filepath.Join(d.dir, walName)
	var pending []wal.Record
	var committed int64
	_, err := wal.Replay(path, func(r wal.Record, end int64) error {
		pending = append(pending, r)
		if r.Kind != wal.KindCommit {
			return nil
		}
		if err := d.apply(pending); err != nil {
			return err
		}
		pending = pending[:0]
		committed = end
		return nil
	})
	if err != nil {
		return err
	}
	d.log, err = wal.OpenAppend(path, committed, d.opts.Sync)
	return err
}

// commit makes the change in t durable and then visible: the log first, the
// pages second. The caller holds d.mu.
func (d *DB) commit(t *txn) error {
	recs := t.records()
	start := d.log.Size()
	if err := d.log.Append(recs...); err != nil {
		d.log.Rewind(start)
		return err
	}
	return d.apply(recs)
}
