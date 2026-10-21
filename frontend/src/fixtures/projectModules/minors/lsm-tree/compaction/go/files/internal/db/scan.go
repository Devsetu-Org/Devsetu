package db

import (
	"bytes"

	"github.com/devlabs/lsmkv/internal/iterator"
	"github.com/devlabs/lsmkv/internal/memtable"
	"github.com/devlabs/lsmkv/internal/sstable"
)

// Scan calls fn for every live key in [start, end), in key order, until fn
// returns false. A nil start means from the first key; a nil end means to the
// last. fn must not call back into the DB, and must copy key and value if it
// keeps them.
func (d *DB) Scan(start, end []byte, fn func(key, value []byte) bool) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.log == nil {
		return ErrClosed
	}
	children := []iterator.Iterator{d.mem.NewIterator()}
	tableIters := make([]*sstable.Iterator, 0, len(d.tables))
	for _, t := range d.tables {
		it := t.t.NewIterator()
		children = append(children, it)
		tableIters = append(tableIters, it)
	}
	m := iterator.NewMerging(children...)
	if start == nil {
		m.SeekToFirst()
	} else {
		m.Seek(start)
	}
	for ; m.Valid(); m.Next() {
		if end != nil && bytes.Compare(m.Key(), end) >= 0 {
			break
		}
		if m.Kind() == memtable.KindTombstone {
			continue
		}
		if !fn(m.Key(), m.Value()) {
			break
		}
	}
	for _, it := range tableIters {
		if err := it.Err(); err != nil {
			return err
		}
	}
	return nil
}
