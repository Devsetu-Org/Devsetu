package db

import (
	"os"

	"github.com/devlabs/lsmkv/internal/compaction"
	"github.com/devlabs/lsmkv/internal/iterator"
	"github.com/devlabs/lsmkv/internal/sstable"
)

// compactRange merges d.tables[lo:hi] (a run of adjacent tables, newest
// first) into one new table that takes their place. The caller holds d.mu.
func (d *DB) compactRange(lo, hi int) error {
	inputs := d.tables[lo:hi]
	num := d.nextFile
	d.nextFile++
	path := tablePath(d.dir, num)
	tmp := path + tmpExt

	children := make([]iterator.Iterator, len(inputs))
	iters := make([]*sstable.Iterator, len(inputs))
	for i, in := range inputs {
		iters[i] = in.t.NewIterator()
		children[i] = iters[i]
	}
	w, err := sstable.Create(tmp, d.writerOptions())
	if err != nil {
		return err
	}
	// Tombstones can go only if nothing older than the inputs exists.
	if _, err := compaction.Merge(children, w, hi == len(d.tables)); err != nil {
		w.Abort()
		return err
	}
	for _, it := range iters {
		if err := it.Err(); err != nil {
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
	out := table{num: num, t: t, size: fileSize(path)}

	tables := append(append(append([]table{}, d.tables[:lo]...), out), d.tables[hi:]...)
	if err := d.saveManifest(tables); err != nil {
		t.Close()
		return err
	}
	old := append([]table(nil), inputs...)
	d.tables = tables
	for _, in := range old {
		in.t.Close()
		os.Remove(tablePath(d.dir, in.num))
	}
	d.compactions++
	d.compactedBytes += out.size
	return nil
}
