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
	// TODO(3.4): write the memtable to a table and make it live, in this order:
	//  1. sstable.Create(tmp, d.writerOptions()) and Add every entry from
	//     d.mem's iterator, tombstones included. On error, Abort.
	//  2. Finish, os.Rename(tmp, path), then syncDir(d.dir).
	//  3. sstable.Open(path) and hand it to d.addTable(table{num: num, t: t}),
	//     which makes it the newest table. Close it if addTable fails.
	//  4. Only now: close d.log, start a fresh one with wal.Create, and replace
	//     d.mem with an empty memtable.
	_, _ = path, tmp
	panic("TODO(3.4): flush")
}
