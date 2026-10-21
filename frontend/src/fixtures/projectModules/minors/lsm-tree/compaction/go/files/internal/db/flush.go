package db

import (
	"os"
	"path/filepath"

	"github.com/devlabs/lsmkv/internal/memtable"
	"github.com/devlabs/lsmkv/internal/sstable"
	"github.com/devlabs/lsmkv/internal/wal"
)

// flush writes the memtable to the next table file, makes the table live, and
// starts a fresh log. The caller holds d.mu.
func (d *DB) flush() error {
	if d.mem.Len() == 0 {
		return nil
	}
	num := d.nextFile
	d.nextFile++
	path := tablePath(d.dir, num)
	tmp := path + tmpExt

	w, err := sstable.Create(tmp, d.writerOptions())
	if err != nil {
		return err
	}
	it := d.mem.NewIterator()
	for it.SeekToFirst(); it.Valid(); it.Next() {
		if err := w.Add(it.Kind(), it.Key(), it.Value()); err != nil {
			w.Abort()
			return err
		}
	}
	if err := w.Finish(); err != nil {
		os.Remove(tmp)
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		os.Remove(tmp)
		return err
	}
	if err := syncDir(d.dir); err != nil {
		return err
	}
	t, err := sstable.Open(path)
	if err != nil {
		return err
	}
	if err := d.addTable(table{num: num, t: t}); err != nil {
		t.Close()
		return err
	}

	// The table now holds everything the log did, so the log can start over.
	if err := d.log.Close(); err != nil {
		d.log = nil
		return err
	}
	if d.log, err = wal.Create(filepath.Join(d.dir, walName), d.opts.Sync); err != nil {
		d.log = nil
		return err
	}
	d.mem = memtable.New()
	return nil
}
