// Package compaction merges several tables into one.
package compaction

import (
	"github.com/devlabs/lsmkv/internal/iterator"
	"github.com/devlabs/lsmkv/internal/memtable"
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
	var st Stats
	m := iterator.NewMerging(inputs...)
	for m.SeekToFirst(); m.Valid(); m.Next() {
		if m.Kind() == memtable.KindTombstone && dropTombstones {
			st.DroppedTombstones++
			continue
		}
		if err := w.Add(m.Kind(), m.Key(), m.Value()); err != nil {
			return st, err
		}
		st.Written++
	}
	return st, nil
}
