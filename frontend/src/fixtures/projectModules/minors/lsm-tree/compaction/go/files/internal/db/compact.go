package db

// compactRange merges d.tables[lo:hi] (a run of adjacent tables, newest
// first) into one new table that takes their place. The caller holds d.mu.
func (d *DB) compactRange(lo, hi int) error {
	inputs := d.tables[lo:hi]
	num := d.nextFile
	d.nextFile++
	path := tablePath(d.dir, num)
	tmp := path + tmpExt
	// TODO(5.3)
	_, _ = inputs, tmp
	panic("TODO(5.3)")
}
