package sstable

import (
	"encoding/binary"
	"hash/crc32"
	"os"
	"sync/atomic"

	"github.com/devlabs/lsmkv/internal/bloom"
	"github.com/devlabs/lsmkv/internal/memtable"
)

// Table is an open, immutable table. It is safe for concurrent use.
type Table struct {
	f     *os.File
	size  int64
	index []indexEntry
	// filter is the table's Bloom filter, or nil if it was written without one.
	filter []byte
	// blockReads counts block reads from disk. Tests use it to check that a
	// lookup touches one data block, not the whole file.
	blockReads atomic.Int64
}

// Open reads the footer and the index of the table at path. Data blocks stay
// on disk until a lookup needs one.
func Open(path string) (*Table, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	t, filter, err := open(f)
	if err == nil {
		err = t.loadFilter(filter)
	}
	if err != nil {
		f.Close()
		return nil, err
	}
	return t, nil
}

// loadFilter reads the filter block at h. A zero handle means the table has
// no filter.
func (t *Table) loadFilter(h handle) error {
	if h.length == 0 {
		return nil
	}
	var err error
	t.filter, err = t.readBlock(h)
	return err
}

// mayContain is false only when the filter proves key is not in the table.
func (t *Table) mayContain(key []byte) bool {
	return t.filter == nil || bloom.MayContain(t.filter, key)
}

// readBlock reads the block at h and checks its trailer.
func (t *Table) readBlock(h handle) ([]byte, error) {
	if h.offset+h.length+trailerSize > uint64(t.size) {
		return nil, ErrCorrupt
	}
	buf := make([]byte, h.length+trailerSize)
	if _, err := t.f.ReadAt(buf, int64(h.offset)); err != nil {
		return nil, err
	}
	t.blockReads.Add(1)
	b, trailer := buf[:h.length], buf[h.length:]
	if crc32.Checksum(b, crcTable) != binary.LittleEndian.Uint32(trailer) {
		return nil, ErrCorrupt
	}
	return b, nil
}

// Get looks key up in this table only. The value is returned only when the
// result is Found.
func (t *Table) Get(key []byte) ([]byte, memtable.Result, error) {
	if !t.mayContain(key) {
		return nil, memtable.Missing, nil
	}
	return t.get(key)
}

// NumBlocks is the number of data blocks in the table.
func (t *Table) NumBlocks() int { return len(t.index) }

// BlockReads is the number of blocks read from disk since Open, the index and
// filter blocks included.
func (t *Table) BlockReads() int64 { return t.blockReads.Load() }

// Close releases the file.
func (t *Table) Close() error { return t.f.Close() }
