package wal

import (
	"os"
)

// SyncMode decides when an append is pushed from the OS page cache to disk.
type SyncMode uint8

const (
	// SyncAlways fsyncs after every append. An acknowledged write survives a
	// power cut. This is the default.
	SyncAlways SyncMode = iota
	// SyncNever leaves flushing to the OS. A process crash loses nothing (the
	// page cache survives it), but a power cut can lose the last few seconds.
	SyncNever
)

// Writer appends records to one log file.
type Writer struct {
	f    *os.File
	mode SyncMode
	buf  []byte
	size int64
}

// Create makes an empty log at path, replacing any file already there.
func Create(path string, mode SyncMode) (*Writer, error) {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, err
	}
	return &Writer{f: f, mode: mode}, nil
}

// OpenAppend opens the log at path for appending after its first good bytes,
// cutting off anything beyond them (a torn tail found by Replay). The file is
// created if it does not exist.
func OpenAppend(path string, good int64, mode SyncMode) (*Writer, error) {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, err
	}
	if err := f.Truncate(good); err != nil {
		f.Close()
		return nil, err
	}
	if _, err := f.Seek(good, 0); err != nil {
		f.Close()
		return nil, err
	}
	if err := f.Sync(); err != nil {
		f.Close()
		return nil, err
	}
	return &Writer{f: f, mode: mode, size: good}, nil
}

// Append writes r to the end of the log. When it returns nil under
// SyncAlways, the record is on disk.
func (w *Writer) Append(r Record) error {
	w.buf = encode(w.buf[:0], r)
	n, err := w.f.Write(w.buf)
	w.size += int64(n)
	if err != nil {
		return err
	}
	if w.mode == SyncAlways {
		return w.f.Sync()
	}
	return nil
}

// Size is the number of bytes in the log.
func (w *Writer) Size() int64 { return w.size }

// Close syncs and closes the file.
func (w *Writer) Close() error {
	if err := w.f.Sync(); err != nil {
		w.f.Close()
		return err
	}
	return w.f.Close()
}
