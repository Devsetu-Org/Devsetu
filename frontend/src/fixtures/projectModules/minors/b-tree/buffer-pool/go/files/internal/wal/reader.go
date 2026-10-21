package wal

import (
	"encoding/binary"
	"errors"
	"hash/crc32"
	"os"
)

// Replay reads the log at path from the start and calls fn for every intact
// record, along with the offset just past it. It stops at the first record
// that is not whole: that is the torn tail of a write the crash interrupted.
// It returns the offset where it stopped, the length of the good prefix.
//
// A missing file is an empty log. If fn returns an error, Replay stops and
// returns it with the offset before that record.
func Replay(path string, fn func(r Record, end int64) error) (good int64, err error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return scan(data, fn)
}

// scan walks the records in data, the whole log, in order.
func scan(data []byte, fn func(r Record, end int64) error) (good int64, err error) {
	for {
		rest := data[good:]
		if len(rest) < headerSize {
			return good, nil
		}
		sum := binary.LittleEndian.Uint32(rest[0:4])
		n := binary.LittleEndian.Uint32(rest[4:8])
		if n > maxRecordSize || uint64(headerSize)+uint64(n) > uint64(len(rest)) {
			return good, nil
		}
		payload := rest[headerSize : headerSize+int(n)]
		if crc32.Checksum(payload, crcTable) != sum {
			return good, nil
		}
		r, err := decodePayload(payload)
		if err != nil {
			return good, nil
		}
		end := good + headerSize + int64(n)
		if err := fn(r, end); err != nil {
			return good, err
		}
		good = end
	}
}
