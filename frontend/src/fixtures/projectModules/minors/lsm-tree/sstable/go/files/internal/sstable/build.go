package sstable

import (
	"github.com/devlabs/lsmkv/internal/memtable"
)

// add appends one entry to the current data block and cuts the block once it
// reaches the block size.
func (w *Writer) add(kind memtable.Kind, key, value []byte) error {
	// TODO(3.1)
	panic("TODO(3.1)")
}

// flushBlock writes the current data block and records it in the index.
func (w *Writer) flushBlock() error {
	// TODO(3.1)
	panic("TODO(3.1)")
}

// finish runs after the last data block and the filter block are written. It
// writes the index block and the footer, then flushes, syncs, and closes the
// file.
func (w *Writer) finish(filter handle) error {
	// TODO(3.2)
	panic("TODO(3.2)")
}
