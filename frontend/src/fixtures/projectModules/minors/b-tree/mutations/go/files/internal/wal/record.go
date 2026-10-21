// Package wal is the write-ahead log: an append-only file of checksummed
// records. The engine logs the full after-image of every page a write changes,
// then a commit record, before it touches the page file. Replay hands those
// records back after a crash.
package wal

import (
	"encoding/binary"
	"errors"
	"hash/crc32"
)

// Kind says what a record means.
type Kind uint8

const (
	// KindPage is the full contents (Usable bytes) of page Page.
	KindPage Kind = iota + 1
	// KindMeta carries the header state after the write; see MetaRecord.
	KindMeta
	// KindCommit ends a batch. A batch without one never happened.
	KindCommit
)

// Record is one log entry.
type Record struct {
	Kind Kind
	Page uint32 // KindPage only
	Data []byte // KindPage: page contents; KindMeta: 12 bytes
}

const (
	// headerSize is the frame in front of every payload: CRC-32C (4) + length (4).
	headerSize = 8
	// maxRecordSize bounds a payload, so a garbled length cannot ask for gigabytes.
	maxRecordSize = 1 << 20
)

var crcTable = crc32.MakeTable(crc32.Castagnoli)

var errBadPayload = errors.New("wal: malformed record payload")

// appendPayload appends r's payload to dst: kind (1), page (4, little
// endian), data length (uvarint), data.
func appendPayload(dst []byte, r Record) []byte {
	dst = append(dst, byte(r.Kind))
	dst = binary.LittleEndian.AppendUint32(dst, r.Page)
	dst = binary.AppendUvarint(dst, uint64(len(r.Data)))
	return append(dst, r.Data...)
}

// decodePayload parses a payload back into a Record, copying its data.
func decodePayload(p []byte) (Record, error) {
	if len(p) < 6 {
		return Record{}, errBadPayload
	}
	r := Record{Kind: Kind(p[0]), Page: binary.LittleEndian.Uint32(p[1:5])}
	if r.Kind < KindPage || r.Kind > KindCommit {
		return Record{}, errBadPayload
	}
	n, used := binary.Uvarint(p[5:])
	if used <= 0 || uint64(len(p)-5-used) != n {
		return Record{}, errBadPayload
	}
	r.Data = append([]byte(nil), p[5+used:]...)
	return r, nil
}

// encode appends the framed record to dst and returns the extended slice.
// Bytes already in dst are kept: the writer reuses one buffer for a whole
// batch.
//
//	┌──────────────┬──────────────┬───────────────────────────┐
//	│ crc32c  (4)  │ length  (4)  │ payload (length bytes)    │
//	└──────────────┴──────────────┴───────────────────────────┘
func encode(dst []byte, r Record) []byte {
	start := len(dst)
	dst = append(dst, make([]byte, headerSize)...)
	dst = appendPayload(dst, r)
	payload := dst[start+headerSize:]
	binary.LittleEndian.PutUint32(dst[start:], crc32.Checksum(payload, crcTable))
	binary.LittleEndian.PutUint32(dst[start+4:], uint32(len(payload)))
	return dst
}
