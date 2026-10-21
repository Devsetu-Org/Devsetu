// Package db is the storage engine: the public Put / Delete / Get / Scan API
// over the write-ahead log, the memtable, and the SSTables on disk.
package db

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/devlabs/lsmkv/internal/manifest"
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
	// BloomBitsPerKey sizes the Bloom filter in each new table. Zero means
	// 10 (about 1% false positives); a negative value writes no filter.
	BloomBitsPerKey int
	// CompactionTrigger is the table count at which a flush also compacts
	// every table into one. Zero means 4; a negative value turns automatic
	// compaction off (Compact still works).
	CompactionTrigger int
}

func (o Options) withDefaults() Options {
	if o.MemtableSize <= 0 {
		o.MemtableSize = 4 << 20
	}
	if o.BlockSize <= 0 {
		o.BlockSize = sstable.DefaultBlockSize
	}
	if o.BloomBitsPerKey == 0 {
		o.BloomBitsPerKey = 10
	}
	if o.CompactionTrigger == 0 {
		o.CompactionTrigger = 4
	}
	return o
}

type table struct {
	num  uint64
	t    *sstable.Table
	size int64
}

// DB is an open store in one directory. It is safe for concurrent use.
type DB struct {
	mu   sync.Mutex
	dir  string
	opts Options
	mem  *memtable.Memtable
	log  *wal.Writer
	// tables are newest data first, in manifest order.
	tables   []table
	nextFile uint64

	compactions    int
	flushedBytes   int64
	compactedBytes int64
}

func tablePath(dir string, num uint64) string {
	return filepath.Join(dir, fmt.Sprintf("%06d%s", num, tableExt))
}

// Open opens the store in dir, creating it if needed. It opens the tables the
// manifest names, deletes any other table files, and replays the log.
func Open(dir string, opts Options) (*DB, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	d := &DB{dir: dir, opts: opts.withDefaults(), mem: memtable.New()}
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

// openTables opens every table in the manifest, in manifest order, then
// removes files a crash left behind: temp files, and tables the manifest does
// not name (a flush or compaction output that was never committed, or inputs
// a compaction had already replaced).
func (d *DB) openTables() error {
	st, err := manifest.Load(d.dir)
	if err != nil {
		return err
	}
	d.nextFile = st.NextFile
	live := map[uint64]bool{}
	for _, num := range st.Tables {
		path := tablePath(d.dir, num)
		t, err := sstable.Open(path)
		if err != nil {
			return fmt.Errorf("open table %d: %w", num, err)
		}
		d.tables = append(d.tables, table{num: num, t: t, size: fileSize(path)})
		live[num] = true
	}
	names, err := os.ReadDir(d.dir)
	if err != nil {
		return err
	}
	for _, e := range names {
		name := e.Name()
		num, err := strconv.ParseUint(strings.TrimSuffix(name, tableExt), 10, 64)
		orphan := strings.HasSuffix(name, tableExt) && err == nil && !live[num]
		if orphan || strings.HasSuffix(name, tmpExt) {
			os.Remove(filepath.Join(d.dir, name))
		}
	}
	return nil
}

func fileSize(path string) int64 {
	st, err := os.Stat(path)
	if err != nil {
		return 0
	}
	return st.Size()
}

func (d *DB) closeTables() {
	for _, t := range d.tables {
		t.t.Close()
	}
	d.tables = nil
}

// saveManifest commits tables (newest first) as the store's live set.
func (d *DB) saveManifest(tables []table) error {
	st := manifest.State{NextFile: d.nextFile}
	for _, t := range tables {
		st.Tables = append(st.Tables, t.num)
	}
	return manifest.Save(d.dir, st)
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

// write logs r, applies it, flushes the memtable once it is full, and
// compacts once enough tables pile up.
func (d *DB) write(r wal.Record) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.log == nil {
		return ErrClosed
	}
	if err := d.commit(r); err != nil {
		return err
	}
	if d.mem.ApproximateSize() < d.opts.MemtableSize {
		return nil
	}
	if err := d.flush(); err != nil {
		return err
	}
	if t := d.opts.CompactionTrigger; t > 0 && len(d.tables) >= t {
		return d.compactRange(0, len(d.tables))
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
	return sstable.WriterOptions{
		BlockSize:       d.opts.BlockSize,
		BloomBitsPerKey: max(d.opts.BloomBitsPerKey, 0),
	}
}

// addTable commits a freshly flushed table in the manifest as the newest one,
// then makes it live. The caller holds d.mu.
func (d *DB) addTable(tb table) error {
	tb.size = fileSize(tablePath(d.dir, tb.num))
	tables := append([]table{tb}, d.tables...)
	if err := d.saveManifest(tables); err != nil {
		return err
	}
	d.tables = tables
	d.flushedBytes += tb.size
	return nil
}

// Compact merges every table into one.
func (d *DB) Compact() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.log == nil {
		return ErrClosed
	}
	if len(d.tables) == 0 {
		return nil
	}
	return d.compactRange(0, len(d.tables))
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
// The memtable is newest, then tables in manifest order. The first one that
// knows the key decides: a value wins, and a tombstone means the key is gone
// even if an older table still holds a value.
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
	TableBytes      int64
	Compactions     int
	// FlushedBytes and CompactedBytes are table bytes written since Open by
	// flushes and by compactions.
	FlushedBytes   int64
	CompactedBytes int64
}

// Stats returns a snapshot of the store's size.
func (d *DB) Stats() Stats {
	d.mu.Lock()
	defer d.mu.Unlock()
	s := Stats{
		MemtableEntries: d.mem.Len(),
		MemtableBytes:   d.mem.ApproximateSize(),
		Tables:          len(d.tables),
		Compactions:     d.compactions,
		FlushedBytes:    d.flushedBytes,
		CompactedBytes:  d.compactedBytes,
	}
	for _, t := range d.tables {
		s.TableBytes += t.size
	}
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
