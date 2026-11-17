package pager

// Allocate returns a page number nobody else is using. It reuses a freed page
// when the freelist has one and otherwise grows the file by one page.
//
// A recycled page keeps whatever bytes it had; callers write it before they
// read it. A page that grows the file is written blank so it exists on disk.
func (p *Pager) Allocate() (PageNo, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	// TODO(1.3)
	panic("TODO(1.3)")
}

// Free puts page no on the freelist so a later Allocate can reuse it. The
// freed page becomes a free page that points at the old list head. Freeing a
// page twice corrupts the list; the layers above must not.
func (p *Pager) Free(no PageNo) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	// TODO(1.4)
	panic("TODO(1.4)")
}
