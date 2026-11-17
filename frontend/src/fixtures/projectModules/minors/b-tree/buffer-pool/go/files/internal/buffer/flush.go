package buffer

// flushFrame writes frame f back to the backing store if it is dirty. The
// caller holds p.mu.
//
// This is the write-ahead rule at the cache: the log records that describe a
// page must be durable before the page itself is written. f.lsn is how big the
// log was when the page was dirtied, so the log must be durable up to there.
func (p *Pool) flushFrame(f *Frame) error {
	// TODO(4.3)
	panic("TODO(4.3)")
}
