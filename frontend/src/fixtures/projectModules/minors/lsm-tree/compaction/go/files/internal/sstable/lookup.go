package sstable

import (
	"bytes"
	"os"
	"sort"

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
	footer := make([]byte, footerSize)
	if _, err := f.ReadAt(footer, t.size-footerSize); err != nil {
		return nil, handle{}, err
	}
	filter, indexHandle, err := decodeFooter(footer)
	if err != nil {
		return nil, handle{}, err
	}
	raw, err := t.readBlock(indexHandle)
	if err != nil {
		return nil, handle{}, err
	}
	if t.index, err = decodeIndex(raw); err != nil {
		return nil, handle{}, err
	}
	return t, filter, nil
}

// get finds the one data block that can hold key and searches only that
// block.
func (t *Table) get(key []byte) ([]byte, memtable.Result, error) {
	i := sort.Search(len(t.index), func(i int) bool {
		return bytes.Compare(t.index[i].lastKey, key) >= 0
	})
	if i == len(t.index) {
		return nil, memtable.Missing, nil
	}
	raw, err := t.readBlock(t.index[i].h)
	if err != nil {
		return nil, memtable.Missing, err
	}
	entries, err := decodeBlock(raw)
	if err != nil {
		return nil, memtable.Missing, err
	}
	for _, e := range entries {
		switch c := bytes.Compare(e.key, key); {
		case c == 0 && e.kind == memtable.KindTombstone:
			return nil, memtable.Deleted, nil
		case c == 0:
			return e.value, memtable.Found, nil
		case c > 0:
			return nil, memtable.Missing, nil
		}
	}
	return nil, memtable.Missing, nil
}
