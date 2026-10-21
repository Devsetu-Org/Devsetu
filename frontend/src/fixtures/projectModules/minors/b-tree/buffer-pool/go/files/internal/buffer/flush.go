package buffer

// flushFrame writes frame f back to the backing store if it is dirty. The
// caller holds p.mu.
//
// This is the write-ahead rule at the cache: the log records that describe a
// page must be durable before the page itself is written. f.lsn is how big the
// log was when the page was dirtied, so the log must be durable up to there.
func (p *Pool) flushFrame(f *Frame) error {
	// TODO(4.3): Nothing to do unless f.dirty. If p.log != nil and f.lsn >
	// p.log.Durable(), call p.log.Sync() first and return its error: the
	// page must not get ahead of its log records. Then p.b.WritePage(f.No,
	// f.Data[:]); only if that succeeded clear f.dirty. A log that is already
	// durable far enough must not be synced again.
	panic("TODO(4.3): flushFrame")
}
