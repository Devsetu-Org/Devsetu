package sstable

import (
	"github.com/devlabs/lsmkv/internal/memtable"
)

// add appends one entry to the current data block and cuts the block once it
// reaches the block size.
func (w *Writer) add(kind memtable.Kind, key, value []byte) error {
	// TODO(3.1): reject a key that is not greater than w.lastKey (unless this
	// is the first entry) with ErrOutOfOrder. Append the entry to w.block with
	// appendEntry, remember the key in w.lastKey (copy it), count it in
	// w.entries, and cut the block with flushBlock once it reaches
	// w.opts.BlockSize bytes.
	panic("TODO(3.1): add")
}

// flushBlock writes the current data block and records it in the index.
func (w *Writer) flushBlock() error {
	// TODO(3.1): do nothing for an empty block. Otherwise write it with
	// writeBlock, append an index entry (w.lastKey and the handle) to w.index
	// with appendIndexEntry, and empty w.block for the next one.
	panic("TODO(3.1): flushBlock")
}

// finish runs after the last data block and the filter block are written. It
// writes the index block and the footer, then flushes, syncs, and closes the
// file.
func (w *Writer) finish(filter handle) error {
	// TODO(3.2): write w.index as a block with writeBlock. Write the footer
	// with encodeFooter(filter, index). Then flush w.out, fsync w.f, and close
	// it.
	panic("TODO(3.2): finish")
}
