package db

// compactRange merges d.tables[lo:hi] (a run of adjacent tables, newest
// first) into one new table that takes their place. The caller holds d.mu.
func (d *DB) compactRange(lo, hi int) error {
	inputs := d.tables[lo:hi]
	num := d.nextFile
	d.nextFile++
	path := tablePath(d.dir, num)
	tmp := path + tmpExt
	// TODO(5.3): replace inputs with one merged table, in this order:
	//  1. A table iterator per input (keep them to check Err), sstable.Create
	//     at tmp with d.writerOptions(), and compaction.Merge. Tombstones may
	//     be dropped only when the inputs reach the oldest table
	//     (hi == len(d.tables)). On any error, including an input's Err,
	//     Abort the writer.
	//  2. Finish, rename tmp to path, syncDir, sstable.Open: the output table,
	//     table{num: num, t: t, size: fileSize(path)}.
	//  3. Build the new list: d.tables[:lo], the output, d.tables[hi:]. Commit
	//     it with d.saveManifest. Until this succeeds the inputs stay live.
	//  4. Only then: set d.tables, close and delete every input file, and
	//     update d.compactions and d.compactedBytes (the output's size).
	_, _ = inputs, tmp
	panic("TODO(5.3): compactRange")
}
