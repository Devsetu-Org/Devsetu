package wal

import (
	"encoding/binary"
	"errors"
	"hash/crc32"
	"io/fs"
	"os"
)

// Replay calls fn for every intact record in the log at path, oldest first.
//
// It stops at the first record that is cut short or fails its checksum.
// Everything from there on is a torn tail: an append the crash interrupted,
// which was never acknowledged. Replay returns good, the offset just past the
// last intact record, so the caller can cut the tail off before appending.
//
// A missing file is an empty log. The slices in a Record alias Replay's read
// buffer, so fn must copy anything it keeps (Memtable.Put already does).
func Replay(path string, fn func(Record) error) (good int64, err error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	for {
		rest := data[good:]
		if len(rest) < headerSize {
			return good, nil
		}
		sum := binary.LittleEndian.Uint32(rest[0:4])
		n := binary.LittleEndian.Uint32(rest[4:8])
		if n > maxRecordSize || int64(n) > int64(len(rest)-headerSize) {
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
		if err := fn(r); err != nil {
			return good, err
		}
		good += headerSize + int64(n)
	}
}
