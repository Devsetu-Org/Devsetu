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
	// TODO(3.3)
	_ = t
	panic("TODO(3.3)")
}

// get finds the one data block that can hold key and searches only that
// block.
func (t *Table) get(key []byte) ([]byte, memtable.Result, error) {
	// TODO(3.3)
	panic("TODO(3.3)")
}
