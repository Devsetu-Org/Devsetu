package db

import (
	"github.com/devlabs/lsmkv/internal/wal"
)

// recoverLog rebuilds d.mem from the log in d.dir, then opens the log for
// appending with any torn tail cut off.
func (d *DB) recoverLog() error {
	// TODO(2.4): replay the log at filepath.Join(d.dir, walName), applying
	// every record to d.mem with apply. Then set d.log with wal.OpenAppend at
	// the good offset Replay returned (and d.opts.Sync), so a torn tail is cut
	// off before anything new is appended.
	panic("TODO(2.4): recoverLog")
}

// commit appends r to the log and only then applies it to the memtable.
// Nothing reaches the memtable unless the append succeeded. The caller holds
// d.mu.
func (d *DB) commit(r wal.Record) error {
	// TODO(2.4): append r to d.log first. Only if that succeeds, apply it to
	// d.mem. A write that failed to reach the log must not become visible.
	panic("TODO(2.4): commit")
}
