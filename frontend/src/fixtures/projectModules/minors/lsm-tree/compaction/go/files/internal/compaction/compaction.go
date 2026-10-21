// Package compaction merges several tables into one.
package compaction

import (
	"github.com/devlabs/lsmkv/internal/iterator"
	"github.com/devlabs/lsmkv/internal/sstable"
)

// Stats describe one merge.
type Stats struct {
	// Written is the number of entries written to the output.
	Written int
	// DroppedTombstones is the number of tombstones left out of the output.
	DroppedTombstones int
}

// Merge writes the newest version of every key in inputs to w, in key order.
//
// inputs are newest first, as in iterator.NewMerging. Older versions of a key
// are never written. Tombstones are written too, unless dropTombstones is
// true: the caller sets it only when no table older than the inputs exists,
// so there is nothing left for a tombstone to hide.
//
// Merge does not call w.Finish; the caller does, after checking the inputs
// for read errors.
func Merge(inputs []iterator.Iterator, w *sstable.Writer, dropTombstones bool) (Stats, error) {
	// TODO(5.1): merge inputs with iterator.NewMerging and walk it from the
	// first key. Skip (and count) tombstones when dropTombstones is set; Add
	// every other entry to w and count it. Return the first Add error.
	panic("TODO(5.1): Merge")
}
