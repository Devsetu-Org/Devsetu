// Package wal is the write-ahead log. Every write is appended here, and made
// durable, before it touches the memtable. On startup the log is replayed to
// rebuild the memtable the crash took away.
package wal

import (
	"encoding/binary"
	"errors"
	"hash/crc32"

	"github.com/devlabs/lsmkv/internal/memtable"
)

// One record on disk:
//
//	+-----------+-----------+-------------------+
//	| crc32 u32 | len u32   | payload (len)     |
//	+-----------+-----------+-------------------+
//
//	payload = kind u8 | uvarint keyLen | key | uvarint valueLen | value
//
// Integers are little-endian. The checksum (CRC-32C) covers the payload only;
// a wrong length shows up as a payload that fails its checksum.
const (
	headerSize = 8
	// maxRecordSize rejects absurd lengths read from a damaged header before
	// they turn into a huge allocation.
	maxRecordSize = 64 << 20
)

var crcTable = crc32.MakeTable(crc32.Castagnoli)

// ErrCorrupt means a record's bytes do not decode to a record.
var ErrCorrupt = errors.New("wal: corrupt record")

// Record is one logged write.
type Record struct {
	Kind  memtable.Kind
	Key   []byte
	Value []byte // nil for tombstones
}

// appendPayload appends the payload encoding of r to dst.
func appendPayload(dst []byte, r Record) []byte {
	dst = append(dst, byte(r.Kind))
	dst = binary.AppendUvarint(dst, uint64(len(r.Key)))
	dst = append(dst, r.Key...)
	dst = binary.AppendUvarint(dst, uint64(len(r.Value)))
	return append(dst, r.Value...)
}

// decodePayload is the inverse of appendPayload. The returned slices alias p.
func decodePayload(p []byte) (Record, error) {
	if len(p) < 1 {
		return Record{}, ErrCorrupt
	}
	r := Record{Kind: memtable.Kind(p[0])}
	if r.Kind != memtable.KindValue && r.Kind != memtable.KindTombstone {
		return Record{}, ErrCorrupt
	}
	p = p[1:]
	var ok bool
	if r.Key, p, ok = readBytes(p); !ok {
		return Record{}, ErrCorrupt
	}
	if r.Value, p, ok = readBytes(p); !ok || len(p) != 0 {
		return Record{}, ErrCorrupt
	}
	if r.Kind == memtable.KindTombstone {
		r.Value = nil
	}
	return r, nil
}

func readBytes(p []byte) (field, rest []byte, ok bool) {
	n, w := binary.Uvarint(p)
	if w <= 0 || n > uint64(len(p)-w) {
		return nil, nil, false
	}
	p = p[w:]
	return p[:n], p[n:], true
}

// encode appends the full on-disk form of r (header and payload) to dst.
func encode(dst []byte, r Record) []byte {
	start := len(dst)
	dst = append(dst, make([]byte, headerSize)...)
	dst = appendPayload(dst, r)
	payload := dst[start+headerSize:]
	binary.LittleEndian.PutUint32(dst[start:], crc32.Checksum(payload, crcTable))
	binary.LittleEndian.PutUint32(dst[start+4:], uint32(len(payload)))
	return dst
}
