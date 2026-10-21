package wal

import (
	"errors"
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
	// TODO(2.3): walk data one record at a time from offset good. Stop and
	// return (good, nil) when fewer than headerSize bytes remain, the length
	// is over maxRecordSize or runs past the end, the checksum does not match,
	// or decodePayload fails. Otherwise call fn (return its error if any) and
	// advance good past the record.
	_ = data
	panic("TODO(2.3): Replay")
}
