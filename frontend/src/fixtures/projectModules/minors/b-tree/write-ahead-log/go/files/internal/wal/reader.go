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
	// TODO(3.3)
	panic("TODO(3.3)")
}
