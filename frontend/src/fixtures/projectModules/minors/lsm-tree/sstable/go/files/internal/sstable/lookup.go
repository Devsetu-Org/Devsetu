package sstable

import (
	"os"

	"github.com/devlabs/lsmkv/internal/memtable"
)

// open reads the footer and the index block of the table in f. It returns the
// filter block's handle so Open can load the filter.
func open(f *os.File) (*Table, handle, error) {
	st, err := f.Stat()
	if err != nil {
		return nil, handle{}, err
	}
	if st.Size() < footerSize {
		return nil, handle{}, ErrCorrupt
	}
	t := &Table{f: f, size: st.Size()}
	// TODO(3.3): read the last footerSize bytes (f.ReadAt), decode them with
	// decodeFooter, read the index block with t.readBlock, and decode it into
	// t.index with decodeIndex. Return t and the filter handle from the
	// footer, or any error.
	_ = t
	panic("TODO(3.3): open")
}

// get finds the one data block that can hold key and searches only that
// block.
func (t *Table) get(key []byte) ([]byte, memtable.Result, error) {
	// TODO(3.3): binary-search t.index (sort.Search) for the first block whose
	// lastKey >= key; if there is none, the key is Missing. Read that one
	// block, decode it, and scan its entries: an equal key answers Found or
	// Deleted, a greater key means Missing.
	panic("TODO(3.3): get")
}
