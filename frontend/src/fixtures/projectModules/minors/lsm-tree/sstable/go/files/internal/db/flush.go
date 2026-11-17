package db

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
	// TODO(3.4)
	_, _ = path, tmp
	panic("TODO(3.4)")
}
