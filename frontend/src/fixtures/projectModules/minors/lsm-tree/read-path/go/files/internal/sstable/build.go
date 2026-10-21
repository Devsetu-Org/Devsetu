package sstable

import (
	"bytes"

	"github.com/devlabs/lsmkv/internal/memtable"
)

// add appends one entry to the current data block and cuts the block once it
// reaches the block size.
func (w *Writer) add(kind memtable.Kind, key, value []byte) error {
	if w.entries > 0 && bytes.Compare(key, w.lastKey) <= 0 {
		return ErrOutOfOrder
	}
	w.block = appendEntry(w.block, kind, key, value)
	w.lastKey = append(w.lastKey[:0], key...)
	w.entries++
	if len(w.block) >= w.opts.BlockSize {
		return w.flushBlock()
	}
	return nil
}

// flushBlock writes the current data block and records it in the index.
func (w *Writer) flushBlock() error {
	if len(w.block) == 0 {
		return nil
	}
	h, err := w.writeBlock(w.block)
	if err != nil {
		return err
	}
	w.index = appendIndexEntry(w.index, w.lastKey, h)
	w.block = w.block[:0]
	return nil
}

// finish runs after the last data block and the filter block are written. It
// writes the index block and the footer, then flushes, syncs, and closes the
// file.
func (w *Writer) finish(filter handle) error {
	index, err := w.writeBlock(w.index)
	if err != nil {
		return err
	}
	if _, err := w.out.Write(encodeFooter(filter, index)); err != nil {
		return err
	}
	if err := w.out.Flush(); err != nil {
		return err
	}
	if err := w.f.Sync(); err != nil {
		return err
	}
	return w.f.Close()
}
