package db

import (
	"github.com/devlabs/lsmkv/internal/wal"
)

// recoverLog rebuilds d.mem from the log in d.dir, then opens the log for
// appending with any torn tail cut off.
func (d *DB) recoverLog() error {
	// TODO(2.4)
	panic("TODO(2.4)")
}

// commit appends r to the log and only then applies it to the memtable.
// Nothing reaches the memtable unless the append succeeded. The caller holds
// d.mu.
func (d *DB) commit(r wal.Record) error {
	// TODO(2.4)
	panic("TODO(2.4)")
}
