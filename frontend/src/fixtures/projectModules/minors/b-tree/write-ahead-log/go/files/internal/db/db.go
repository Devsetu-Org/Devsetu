// Package db is the storage engine: the public Put / Get API over the B+
// tree, the page file, and the write-ahead log. A write is a transaction: the
// tree changes pages in memory, the log records the result, and only then do
// the pages change on disk.
package db

import (
	"errors"
	"os"
	"path/filepath"
	"sync"

	"github.com/devlabs/btreekv/internal/btree"
	"github.com/devlabs/btreekv/internal/pager"
	"github.com/devlabs/btreekv/internal/wal"
)

const (
	// dataName is the page file inside the data directory.
	dataName = "data.db"
	// walName is the log file inside the data directory.
	walName = "wal.log"
)

var (
	// ErrClosed is returned by every call after Close.
	ErrClosed = errors.New("db: closed")
	// ErrNotYet is returned by operations a later chapter builds.
	ErrNotYet = errors.New("db: not built yet (chapter 5)")
)

// Options tune a DB. The zero value is safe: every write is fsynced.
type Options struct {
	Sync wal.SyncMode
}

// DB is an open store in one directory. It is safe for concurrent use.
type DB struct {
	mu     sync.RWMutex
	dir    string
	opts   Options
	pg     *pager.Pager
	store  store
	log    *wal.Writer
	closed bool
}

// Open opens the store in dir, creating it if needed, and replays the log so
// every committed write is in the page file.
func Open(dir string, opts Options) (*DB, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	pg, err := pager.Open(filepath.Join(dir, dataName))
	if err != nil {
		return nil, err
	}
	d := &DB{dir: dir, opts: opts, pg: pg, store: pg}
	if err := d.recoverLog(); err != nil {
		pg.Close()
		return nil, err
	}
	return d, nil
}

// update runs one write as a transaction. fn changes the tree; if it fails
// nothing is logged and nothing changes.
func (d *DB) update(fn func(t *btree.Tree) error) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.closed {
		return ErrClosed
	}
	tx := newTxn(d.store)
	if err := fn(btree.New(tx)); err != nil {
		tx.abort()
		return err
	}
	if !tx.dirty() {
		return nil
	}
	if err := d.commit(tx); err != nil {
		tx.abort()
		return err
	}
	return nil
}

// Put stores value under key, overwriting any existing value.
func (d *DB) Put(key, value []byte) error {
	return d.update(func(t *btree.Tree) error { return t.Insert(key, value) })
}

// Get returns the value stored under key. ok is false when the key does not
// exist.
func (d *DB) Get(key []byte) (value []byte, ok bool, err error) {
	d.mu.RLock()
	defer d.mu.RUnlock()
	if d.closed {
		return nil, false, ErrClosed
	}
	return btree.New(d.store).Get(key)
}

// Delete removes key. It is built in chapter 5.
func (d *DB) Delete(key []byte) error { return ErrNotYet }

// Scan calls fn for every key in [start, end), in key order, until fn returns
// false. It is built in chapter 5.
func (d *DB) Scan(start, end []byte, fn func(key, value []byte) bool) error { return ErrNotYet }

// Stats describes the store for the REPL.
type Stats struct {
	Pages     int // pages in the file, header included
	FreePages int // pages on the freelist
	Height    int
	Leaves    int
	Internal  int
	Keys      int
	WALBytes  int64 // size of the log
	Resident  int   // pages cached in the buffer pool (chapter 4)
	Dirty     int   // cached pages not yet written back (chapter 4)
}

// Stats walks the tree and returns a snapshot of the store's shape.
func (d *DB) Stats() (Stats, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()
	if d.closed {
		return Stats{}, ErrClosed
	}
	ts, err := btree.New(d.store).Check()
	if err != nil {
		return Stats{}, err
	}
	pages := int(d.store.Meta().PageCount)
	return Stats{
		Pages:     pages,
		FreePages: pages - 1 - ts.Leaves - ts.Internal,
		Height:    ts.Height,
		Leaves:    ts.Leaves,
		Internal:  ts.Internal,
		Keys:      ts.Keys,
		WALBytes:  d.log.Size(),
	}, nil
}

// checkpoint makes the page file stand on its own: every page and the header
// reach the disk, and only then is the log emptied. Crash in between and the
// log is simply replayed again.
func (d *DB) checkpoint() error {
	if err := d.pg.Sync(); err != nil {
		return err
	}
	return d.log.Reset()
}

// Close checkpoints and releases the directory.
func (d *DB) Close() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.closed {
		return ErrClosed
	}
	d.closed = true
	err := d.checkpoint()
	if e := d.log.Close(); err == nil {
		err = e
	}
	if e := d.pg.Close(); err == nil {
		err = e
	}
	return err
}
