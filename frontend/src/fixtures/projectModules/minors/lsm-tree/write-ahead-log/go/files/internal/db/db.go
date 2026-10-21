// Package db is the storage engine: the public Put / Delete / Get API over the
// write-ahead log and the memtable. Later chapters add SSTables and compaction
// underneath without changing this API.
package db

import (
	"errors"
	"os"
	"sync"

	"github.com/devlabs/lsmkv/internal/memtable"
	"github.com/devlabs/lsmkv/internal/wal"
)

// walName is the log file inside the data directory.
const walName = "wal.log"

// ErrClosed is returned by every call after Close.
var ErrClosed = errors.New("db: closed")

// Options tune a DB. The zero value is safe: every write is fsynced.
type Options struct {
	Sync wal.SyncMode
}

// DB is an open store in one directory. It is safe for concurrent use.
type DB struct {
	mu   sync.Mutex
	dir  string
	opts Options
	mem  *memtable.Memtable
	log  *wal.Writer
}

// Open opens the store in dir, creating it if needed, and recovers every
// acknowledged write from the log.
func Open(dir string, opts Options) (*DB, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	d := &DB{dir: dir, opts: opts, mem: memtable.New()}
	if err := d.recoverLog(); err != nil {
		return nil, err
	}
	return d, nil
}

// apply makes one logged write visible in the memtable.
func apply(m *memtable.Memtable, r wal.Record) {
	if r.Kind == memtable.KindTombstone {
		m.Delete(r.Key)
	} else {
		m.Put(r.Key, r.Value)
	}
}

// Put stores value under key.
func (d *DB) Put(key, value []byte) error {
	return d.write(wal.Record{Kind: memtable.KindValue, Key: key, Value: value})
}

// Delete removes key.
func (d *DB) Delete(key []byte) error {
	return d.write(wal.Record{Kind: memtable.KindTombstone, Key: key})
}

// write commits one record under the lock.
func (d *DB) write(r wal.Record) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.log == nil {
		return ErrClosed
	}
	return d.commit(r)
}

// Get returns the value stored under key. ok is false when the key does not
// exist or was deleted.
func (d *DB) Get(key []byte) (value []byte, ok bool, err error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.log == nil {
		return nil, false, ErrClosed
	}
	v, res := d.mem.Get(key)
	if res != memtable.Found {
		return nil, false, nil
	}
	return append([]byte(nil), v...), true, nil
}

// Stats describes the store for the REPL.
type Stats struct {
	MemtableEntries int
	MemtableBytes   int
	WALBytes        int64
}

// Stats returns a snapshot of the store's size.
func (d *DB) Stats() Stats {
	d.mu.Lock()
	defer d.mu.Unlock()
	s := Stats{MemtableEntries: d.mem.Len(), MemtableBytes: d.mem.ApproximateSize()}
	if d.log != nil {
		s.WALBytes = d.log.Size()
	}
	return s
}

// Close flushes the log and releases the directory.
func (d *DB) Close() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.log == nil {
		return ErrClosed
	}
	err := d.log.Close()
	d.log = nil
	return err
}
