// Package db is the storage engine: the public Put / Delete / Get API over the
// write-ahead log, the memtable, and the SSTables on disk.
package db

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/devlabs/lsmkv/internal/memtable"
	"github.com/devlabs/lsmkv/internal/sstable"
	"github.com/devlabs/lsmkv/internal/wal"
)

const (
	walName  = "wal.log"
	tableExt = ".sst"
	tmpExt   = ".tmp"
)

// ErrClosed is returned by every call after Close.
var ErrClosed = errors.New("db: closed")

// Options tune a DB. The zero value is safe and uses the defaults.
type Options struct {
	Sync wal.SyncMode
	// MemtableSize is how big the memtable may grow (ApproximateSize) before
	// it is flushed to a table. Zero means 4 MiB.
	MemtableSize int
	// BlockSize is the data block size of new tables. Zero means
	// sstable.DefaultBlockSize.
	BlockSize int
}

func (o Options) withDefaults() Options {
	if o.MemtableSize <= 0 {
		o.MemtableSize = 4 << 20
	}
	if o.BlockSize <= 0 {
		o.BlockSize = sstable.DefaultBlockSize
	}
	return o
}

type table struct {
	num uint64
	t   *sstable.Table
}

// DB is an open store in one directory. It is safe for concurrent use.
type DB struct {
	mu   sync.Mutex
	dir  string
	opts Options
	mem  *memtable.Memtable
	log  *wal.Writer
	// tables are newest first: tables[0] holds the most recent flush.
	tables []table
	// nextFile is the number the next table file gets. Numbers only grow, so
	// a higher number always means newer data.
	nextFile uint64
}

func tablePath(dir string, num uint64) string {
	return filepath.Join(dir, fmt.Sprintf("%06d%s", num, tableExt))
}

// Open opens the store in dir, creating it if needed. It opens every table
// and replays the log into a fresh memtable.
func Open(dir string, opts Options) (*DB, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	d := &DB{dir: dir, opts: opts.withDefaults(), mem: memtable.New(), nextFile: 1}
	if err := d.openTables(); err != nil {
		d.closeTables()
		return nil, err
	}
	if err := d.recoverLog(); err != nil {
		d.closeTables()
		return nil, err
	}
	return d, nil
}

// openTables opens every NNNNNN.sst in the directory, newest first, and
// deletes leftover *.tmp files from a flush that crashed.
func (d *DB) openTables() error {
	names, err := os.ReadDir(d.dir)
	if err != nil {
		return err
	}
	var nums []uint64
	for _, e := range names {
		name := e.Name()
		if strings.HasSuffix(name, tmpExt) {
			os.Remove(filepath.Join(d.dir, name))
			continue
		}
		if num, err := strconv.ParseUint(strings.TrimSuffix(name, tableExt), 10, 64); err == nil && strings.HasSuffix(name, tableExt) {
			nums = append(nums, num)
		}
	}
	sort.Slice(nums, func(i, j int) bool { return nums[i] > nums[j] })
	for _, num := range nums {
		t, err := sstable.Open(tablePath(d.dir, num))
		if err != nil {
			return fmt.Errorf("open table %d: %w", num, err)
		}
		d.tables = append(d.tables, table{num: num, t: t})
		if num >= d.nextFile {
			d.nextFile = num + 1
		}
	}
	return nil
}

func (d *DB) closeTables() {
	for _, t := range d.tables {
		t.t.Close()
	}
	d.tables = nil
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

// write logs r, applies it, and flushes the memtable once it is full.
func (d *DB) write(r wal.Record) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.log == nil {
		return ErrClosed
	}
	if err := d.commit(r); err != nil {
		return err
	}
	if d.mem.ApproximateSize() >= d.opts.MemtableSize {
		return d.flush()
	}
	return nil
}

// Flush writes the memtable to a new table now, even if it is not full.
func (d *DB) Flush() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.log == nil {
		return ErrClosed
	}
	return d.flush()
}

// writerOptions are the options every new table is written with.
func (d *DB) writerOptions() sstable.WriterOptions {
	return sstable.WriterOptions{BlockSize: d.opts.BlockSize}
}

// addTable makes a freshly written table live as the newest one. The caller
// holds d.mu.
func (d *DB) addTable(tb table) error {
	d.tables = append([]table{tb}, d.tables...)
	return nil
}

// syncDir makes renames and new files in dir durable.
func syncDir(dir string) error {
	f, err := os.Open(dir)
	if err != nil {
		return err
	}
	err = f.Sync()
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	return err
}

// Get returns the value stored under key. ok is false when the key does not
// exist or was deleted.
//
// The memtable is newest, then tables from newest to oldest. The first one
// that knows the key decides: a value wins, and a tombstone means the key is
// gone even if an older table still holds a value.
func (d *DB) Get(key []byte) (value []byte, ok bool, err error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.log == nil {
		return nil, false, ErrClosed
	}
	switch v, res := d.mem.Get(key); res {
	case memtable.Found:
		return append([]byte(nil), v...), true, nil
	case memtable.Deleted:
		return nil, false, nil
	}
	for _, t := range d.tables {
		v, res, err := t.t.Get(key)
		if err != nil {
			return nil, false, err
		}
		switch res {
		case memtable.Found:
			return v, true, nil
		case memtable.Deleted:
			return nil, false, nil
		}
	}
	return nil, false, nil
}

// Stats describes the store for the REPL.
type Stats struct {
	MemtableEntries int
	MemtableBytes   int
	WALBytes        int64
	Tables          int
}

// Stats returns a snapshot of the store's size.
func (d *DB) Stats() Stats {
	d.mu.Lock()
	defer d.mu.Unlock()
	s := Stats{MemtableEntries: d.mem.Len(), MemtableBytes: d.mem.ApproximateSize(), Tables: len(d.tables)}
	if d.log != nil {
		s.WALBytes = d.log.Size()
	}
	return s
}

// Close closes the log and the tables. The memtable is not flushed: the log
// still holds it, and the next Open replays it.
func (d *DB) Close() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.log == nil {
		return ErrClosed
	}
	err := d.log.Close()
	d.log = nil
	d.closeTables()
	return err
}
