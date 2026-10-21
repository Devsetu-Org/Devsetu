package sstable

import (
	"bytes"
	"sort"

	"github.com/devlabs/lsmkv/internal/memtable"
)

// Iterator walks a table in key order, tombstones included, loading one data
// block at a time. If a block fails to read, the iterator stops and Err
// reports why.
type Iterator struct {
	t       *Table
	block   int // index of the loaded block; len(t.index) when exhausted
	entries []entry
	pos     int
	err     error
}

// NewIterator returns an iterator that is not positioned yet.
func (t *Table) NewIterator() *Iterator {
	return &Iterator{t: t, block: len(t.index)}
}

// SeekToFirst positions the iterator on the smallest key.
func (it *Iterator) SeekToFirst() {
	it.load(0)
	it.skipExhausted()
}

// Seek positions the iterator on the first key >= target.
func (it *Iterator) Seek(target []byte) {
	i := sort.Search(len(it.t.index), func(i int) bool {
		return bytes.Compare(it.t.index[i].lastKey, target) >= 0
	})
	it.load(i)
	for it.pos < len(it.entries) && bytes.Compare(it.entries[it.pos].key, target) < 0 {
		it.pos++
	}
	it.skipExhausted()
}

// Valid reports whether the iterator is positioned on an entry.
func (it *Iterator) Valid() bool { return it.pos < len(it.entries) }

// Next moves to the following key. Only call when Valid.
func (it *Iterator) Next() {
	it.pos++
	it.skipExhausted()
}

// Key of the current entry. Only call when Valid.
func (it *Iterator) Key() []byte { return it.entries[it.pos].key }

// Value of the current entry; nil for tombstones. Only call when Valid.
func (it *Iterator) Value() []byte { return it.entries[it.pos].value }

// Kind of the current entry. Only call when Valid.
func (it *Iterator) Kind() memtable.Kind { return it.entries[it.pos].kind }

// Err is the read error that stopped the iterator, if any.
func (it *Iterator) Err() error { return it.err }

func (it *Iterator) load(i int) {
	it.block, it.entries, it.pos = i, nil, 0
	if it.err != nil || i >= len(it.t.index) {
		it.block = len(it.t.index)
		return
	}
	raw, err := it.t.readBlock(it.t.index[i].h)
	if err == nil {
		it.entries, err = decodeBlock(raw)
	}
	if err != nil {
		it.err, it.entries, it.block = err, nil, len(it.t.index)
	}
}

// skipExhausted moves on to the next block while the current one is used up.
func (it *Iterator) skipExhausted() {
	for it.pos >= len(it.entries) && it.block < len(it.t.index) {
		it.load(it.block + 1)
	}
}
