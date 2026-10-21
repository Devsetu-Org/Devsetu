package db

import (
	"path/filepath"

	"github.com/devlabs/lsmkv/internal/wal"
)

// recoverLog rebuilds d.mem from the log in d.dir, then opens the log for
// appending with any torn tail cut off.
func (d *DB) recoverLog() error {
	path := filepath.Join(d.dir, walName)
	good, err := wal.Replay(path, func(r wal.Record) error {
		apply(d.mem, r)
		return nil
	})
	if err != nil {
		return err
	}
	d.log, err = wal.OpenAppend(path, good, d.opts.Sync)
	return err
}

// commit appends r to the log and only then applies it to the memtable.
// Nothing reaches the memtable unless the append succeeded. The caller holds
// d.mu.
func (d *DB) commit(r wal.Record) error {
	if err := d.log.Append(r); err != nil {
		return err
	}
	apply(d.mem, r)
	return nil
}
