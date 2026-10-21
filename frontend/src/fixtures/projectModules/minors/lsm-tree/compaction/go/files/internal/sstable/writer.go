package sstable

import (
	"bufio"
	"encoding/binary"
	"hash/crc32"
	"os"

	"github.com/devlabs/lsmkv/internal/bloom"
	"github.com/devlabs/lsmkv/internal/memtable"
)

// WriterOptions tune the layout of a new table.
type WriterOptions struct {
	// BlockSize is the size a data block reaches before it is cut. Zero means
	// DefaultBlockSize.
	BlockSize int
	// BloomBitsPerKey sizes the table's Bloom filter. Zero writes no filter.
	BloomBitsPerKey int
}

// Writer builds one table. Add entries in strictly increasing key order, then
// call Finish. A table is not readable until Finish returns.
type Writer struct {
	f    *os.File
	out  *bufio.Writer
	path string
	opts WriterOptions

	offset  uint64 // bytes written so far
	block   []byte // the data block being filled
	index   []byte // encoded index entries for finished blocks
	lastKey []byte // last key passed to Add
	entries int
	filter  *bloom.Builder // nil when the table has no filter
}

// Create starts a table at path, replacing any file there.
func Create(path string, opts WriterOptions) (*Writer, error) {
	if opts.BlockSize <= 0 {
		opts.BlockSize = DefaultBlockSize
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, err
	}
	w := &Writer{f: f, out: bufio.NewWriterSize(f, 64<<10), path: path, opts: opts}
	if opts.BloomBitsPerKey > 0 {
		w.filter = bloom.NewBuilder(opts.BloomBitsPerKey)
	}
	return w, nil
}

// Entries is the number of entries added so far.
func (w *Writer) Entries() int { return w.entries }

// writeBlock writes b followed by its CRC-32C trailer and returns where b went.
func (w *Writer) writeBlock(b []byte) (handle, error) {
	h := handle{offset: w.offset, length: uint64(len(b))}
	var trailer [trailerSize]byte
	binary.LittleEndian.PutUint32(trailer[:], crc32.Checksum(b, crcTable))
	if _, err := w.out.Write(b); err != nil {
		return handle{}, err
	}
	if _, err := w.out.Write(trailer[:]); err != nil {
		return handle{}, err
	}
	w.offset += uint64(len(b)) + trailerSize
	return h, nil
}

// Add appends one entry. Keys must be strictly increasing.
func (w *Writer) Add(kind memtable.Kind, key, value []byte) error {
	if err := w.add(kind, key, value); err != nil {
		return err
	}
	w.noteKey(key)
	return nil
}

// Finish writes the last data block, the filter, the index, and the footer,
// then makes the file durable and closes it.
func (w *Writer) Finish() error {
	if err := w.flushBlock(); err != nil {
		return err
	}
	filter, err := w.writeFilter()
	if err != nil {
		return err
	}
	return w.finish(filter)
}

// noteKey adds key to the table's Bloom filter.
func (w *Writer) noteKey(key []byte) {
	if w.filter != nil {
		w.filter.Add(key)
	}
}

// writeFilter writes the filter block between the data blocks and the index.
// A table without a filter gets a zero handle in its footer.
func (w *Writer) writeFilter() (handle, error) {
	if w.filter == nil {
		return handle{}, nil
	}
	return w.writeBlock(w.filter.Finish())
}

// Abort closes and deletes an unfinished table.
func (w *Writer) Abort() {
	w.f.Close()
	os.Remove(w.path)
}
