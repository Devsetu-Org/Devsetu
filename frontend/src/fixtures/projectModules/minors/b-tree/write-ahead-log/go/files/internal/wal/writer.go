package wal

import (
	"os"
)

// SyncMode decides when an append is pushed from the OS page cache to disk.
type SyncMode uint8

const (
	// SyncAlways fsyncs after every Append. A committed write survives a power
	// cut. This is the default.
	SyncAlways SyncMode = iota
	// SyncNever leaves flushing to the OS. A process crash loses nothing (the
	// page cache survives it), but a power cut can lose the last few seconds.
	SyncNever
)

// Writer appends records to one log file.
type Writer struct {
	f      *os.File
	mode   SyncMode
	buf    []byte
	size   int64
	synced int64
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
// cutting off anything beyond them. The file is created if it does not exist.
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
	return &Writer{f: f, mode: mode, size: good, synced: good}, nil
}

// Append writes recs to the end of the log as one batch. When it returns nil
// under SyncAlways, every record is on disk.
func (w *Writer) Append(recs ...Record) error {
	// TODO(3.2): Reuse w.buf: start from w.buf[:0] and encode every record into it with
	// w.buf = encode(w.buf, r). Then write the whole batch with ONE w.f.Write
	// call, add the bytes written to w.size even if the write failed, and
	// return the error if there was one.
	// With SyncAlways, finish with return w.Sync(). (Sync, given below, also
	// records how much of the log is durable.)
	panic("TODO(3.2): Append")
}

// Sync fsyncs the log and remembers that everything written so far is durable.
func (w *Writer) Sync() error {
	if err := w.f.Sync(); err != nil {
		return err
	}
	w.synced = w.size
	return nil
}

// Size is the number of bytes in the log.
func (w *Writer) Size() int64 { return w.size }

// Durable is how many bytes of the log are known to be on disk.
func (w *Writer) Durable() int64 { return w.synced }

// Rewind cuts the log back to its first to bytes. The engine uses it to take
// back a batch whose append failed.
func (w *Writer) Rewind(to int64) error {
	if err := w.f.Truncate(to); err != nil {
		return err
	}
	if _, err := w.f.Seek(to, 0); err != nil {
		return err
	}
	w.size = to
	w.synced = min(w.synced, to)
	return nil
}

// Reset empties the log. The engine calls it after a checkpoint, once every
// page the log described is safely in the page file.
func (w *Writer) Reset() error {
	if err := w.Rewind(0); err != nil {
		return err
	}
	return w.f.Sync()
}

// Close syncs and closes the file.
func (w *Writer) Close() error {
	if err := w.f.Sync(); err != nil {
		w.f.Close()
		return err
	}
	return w.f.Close()
}
