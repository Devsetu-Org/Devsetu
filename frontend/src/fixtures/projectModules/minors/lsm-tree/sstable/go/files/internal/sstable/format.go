// Package sstable reads and writes sorted string tables: immutable files that
// hold one flushed memtable, keys in order, tombstones included.
package sstable

import (
	"encoding/binary"
	"errors"
	"hash/crc32"

	"github.com/devlabs/lsmkv/internal/memtable"
)

// File layout:
//
//	┌────────────────┐
//	│ data block 0   │  entries in key order        + 4-byte CRC-32C trailer
//	│ data block 1   │
//	│ ...            │
//	│ filter block   │  Bloom filter (chapter 4; absent before that)
//	│ index block    │  one entry per data block    + 4-byte CRC-32C trailer
//	│ footer         │  fixed size, always the last 40 bytes
//	└────────────────┘
//
//	entry       = kind u8 | uvarint keyLen | key | uvarint valueLen | value
//	index entry = uvarint keyLen | lastKey | uvarint offset | uvarint length
//	footer      = filter offset u64 | filter length u64 |
//	              index offset u64  | index length u64  | magic u64
//
// Integers in the footer are little-endian. A handle's length does not
// include the block's trailer.
const (
	footerSize  = 40
	trailerSize = 4
	magic       = uint64(0x6c736d6b76737374) // "lsmkvsst"

	// DefaultBlockSize is the size a data block grows to before it is cut.
	DefaultBlockSize = 4096
)

var crcTable = crc32.MakeTable(crc32.Castagnoli)

var (
	// ErrCorrupt means the file does not decode as a table.
	ErrCorrupt = errors.New("sstable: corrupt table")
	// ErrOutOfOrder means Add was called with a key not greater than the last.
	ErrOutOfOrder = errors.New("sstable: keys must be added in strictly increasing order")
)

// handle locates a block in the file.
type handle struct {
	offset uint64
	length uint64
}

type entry struct {
	kind  memtable.Kind
	key   []byte
	value []byte
}

type indexEntry struct {
	lastKey []byte
	h       handle
}

func appendEntry(dst []byte, kind memtable.Kind, key, value []byte) []byte {
	dst = append(dst, byte(kind))
	dst = binary.AppendUvarint(dst, uint64(len(key)))
	dst = append(dst, key...)
	dst = binary.AppendUvarint(dst, uint64(len(value)))
	return append(dst, value...)
}

// decodeBlock splits a data block into its entries. The slices alias b.
func decodeBlock(b []byte) ([]entry, error) {
	var out []entry
	for len(b) > 0 {
		e := entry{kind: memtable.Kind(b[0])}
		if e.kind != memtable.KindValue && e.kind != memtable.KindTombstone {
			return nil, ErrCorrupt
		}
		var ok bool
		if e.key, b, ok = readBytes(b[1:]); !ok {
			return nil, ErrCorrupt
		}
		if e.value, b, ok = readBytes(b); !ok {
			return nil, ErrCorrupt
		}
		if e.kind == memtable.KindTombstone {
			e.value = nil
		}
		out = append(out, e)
	}
	return out, nil
}

func appendIndexEntry(dst, lastKey []byte, h handle) []byte {
	dst = binary.AppendUvarint(dst, uint64(len(lastKey)))
	dst = append(dst, lastKey...)
	dst = binary.AppendUvarint(dst, h.offset)
	return binary.AppendUvarint(dst, h.length)
}

func decodeIndex(b []byte) ([]indexEntry, error) {
	var out []indexEntry
	for len(b) > 0 {
		var e indexEntry
		var ok bool
		if e.lastKey, b, ok = readBytes(b); !ok {
			return nil, ErrCorrupt
		}
		var w int
		if e.h.offset, w = binary.Uvarint(b); w <= 0 {
			return nil, ErrCorrupt
		}
		b = b[w:]
		if e.h.length, w = binary.Uvarint(b); w <= 0 {
			return nil, ErrCorrupt
		}
		b = b[w:]
		out = append(out, e)
	}
	return out, nil
}

func encodeFooter(filter, index handle) []byte {
	b := make([]byte, footerSize)
	binary.LittleEndian.PutUint64(b[0:], filter.offset)
	binary.LittleEndian.PutUint64(b[8:], filter.length)
	binary.LittleEndian.PutUint64(b[16:], index.offset)
	binary.LittleEndian.PutUint64(b[24:], index.length)
	binary.LittleEndian.PutUint64(b[32:], magic)
	return b
}

func decodeFooter(b []byte) (filter, index handle, err error) {
	if len(b) != footerSize || binary.LittleEndian.Uint64(b[32:]) != magic {
		return handle{}, handle{}, ErrCorrupt
	}
	filter = handle{binary.LittleEndian.Uint64(b[0:]), binary.LittleEndian.Uint64(b[8:])}
	index = handle{binary.LittleEndian.Uint64(b[16:]), binary.LittleEndian.Uint64(b[24:])}
	return filter, index, nil
}

func readBytes(p []byte) (field, rest []byte, ok bool) {
	n, w := binary.Uvarint(p)
	if w <= 0 || n > uint64(len(p)-w) {
		return nil, nil, false
	}
	p = p[w:]
	return p[:n], p[n:], true
}
