// Package db is the storage engine: the public Put / Get API over the B+
// tree and its page file. Later chapters put a write-ahead log and a buffer
// pool underneath, and finish Delete and Scan, without changing this API.
package db

import (
	"errors"
	"os"
	"path/filepath"
	"sync"

	"github.com/devlabs/btreekv/internal/btree"
	"github.com/devlabs/btreekv/internal/pager"
)

// dataName is the page file inside the data directory.
const dataName = "data.db"

var (
	// ErrClosed is returned by every call after Close.
	ErrClosed = errors.New("db: closed")
	// ErrNotYet is returned by operations a later chapter builds.
	ErrNotYet = errors.New("db: not built yet (chapter 5)")
)

// Options tune a DB. The zero value is safe.
type Options struct{}

// DB is an open store in one directory. It is safe for concurrent use.
type DB struct {
	mu     sync.RWMutex
	dir    string
	opts   Options
	pg     *pager.Pager
	tree   *btree.Tree
	closed bool
}

// Open opens the store in dir, creating it if needed.
func Open(dir string, opts Options) (*DB, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	pg, err := pager.Open(filepath.Join(dir, dataName))
	if err != nil {
		return nil, err
	}
	return &DB{dir: dir, opts: opts, pg: pg, tree: btree.New(pg)}, nil
}

// Put stores value under key, overwriting any existing value.
func (d *DB) Put(key, value []byte) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.closed {
		return ErrClosed
	}
	return d.tree.Insert(key, value)
}

// Get returns the value stored under key. ok is false when the key does not
// exist.
func (d *DB) Get(key []byte) (value []byte, ok bool, err error) {
	d.mu.RLock()
	defer d.mu.RUnlock()
	if d.closed {
		return nil, false, ErrClosed
	}
	return d.tree.Get(key)
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
	WALBytes  int64 // size of the log (chapter 3)
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
	ts, err := d.tree.Check()
	if err != nil {
		return Stats{}, err
	}
	pages := int(d.pg.Meta().PageCount)
	return Stats{
		Pages:     pages,
		FreePages: pages - 1 - ts.Leaves - ts.Internal,
		Height:    ts.Height,
		Leaves:    ts.Leaves,
		Internal:  ts.Internal,
		Keys:      ts.Keys,
	}, nil
}

// Close writes the header and releases the directory.
func (d *DB) Close() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.closed {
		return ErrClosed
	}
	d.closed = true
	return d.pg.Close()
}
