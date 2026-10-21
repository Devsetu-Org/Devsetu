package buffer

// flushFrame writes frame f back to the backing store if it is dirty. The
// caller holds p.mu.
//
// This is the write-ahead rule at the cache: the log records that describe a
// page must be durable before the page itself is written. f.lsn is how big the
// log was when the page was dirtied, so the log must be durable up to there.
func (p *Pool) flushFrame(f *Frame) error {
	if !f.dirty {
		return nil
	}
	if p.log != nil && f.lsn > p.log.Durable() {
		if err := p.log.Sync(); err != nil {
			return err
		}
	}
	if err := p.b.WritePage(f.No, f.Data[:]); err != nil {
		return err
	}
	f.dirty = false
	return nil
}
