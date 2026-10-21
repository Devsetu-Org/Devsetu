package wal

import (
	"errors"
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
	// TODO(3.3): Loop forever over data. rest := data[good:]. If len(rest) < headerSize,
	// return good, nil.
	// Read sum from rest[0:4] and n from rest[4:8] (binary.LittleEndian.Uint32).
	// If n > maxRecordSize, or headerSize+n runs past the end of rest, stop.
	// payload := rest[headerSize:headerSize+n]. If crc32.Checksum(payload,
	// crcTable) != sum, stop. r, err := decodePayload(payload); if it fails,
	// stop. "Stop" always means return good, nil.
	// Call fn(r, end) with end := good + headerSize + n; if it errors, return
	// good, err. Then good = end.
	//
	// You will need to import encoding/binary and hash/crc32.
	panic("TODO(3.3): scan")
}
