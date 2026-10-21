package pager

// Allocate returns a page number nobody else is using. It reuses a freed page
// when the freelist has one and otherwise grows the file by one page.
//
// A recycled page keeps whatever bytes it had; callers write it before they
// read it. A page that grows the file is written blank so it exists on disk.
func (p *Pager) Allocate() (PageNo, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	// TODO(1.3): If p.meta.FreeHead != 0, pop it: read that page into a PageSize
	// buffer, take the next pointer from decodeFreePage, set
	// p.meta.FreeHead to it, and return the popped page number. Do not write
	// to disk: the freelist head only reaches the header on Sync (or, with a
	// log, on replay).
	//
	// Otherwise return p.meta.PageCount, write a blank page there with
	// WritePage so the file really grows, and increment p.meta.PageCount.
	panic("TODO(1.3): Allocate")
}

// Free puts page no on the freelist so a later Allocate can reuse it. The
// freed page becomes a free page that points at the old list head. Freeing a
// page twice corrupts the list; the layers above must not.
func (p *Pager) Free(no PageNo) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	// TODO(1.4): Return an error wrapping ErrBadPage if no is 0 or >= p.meta.PageCount.
	// Build the page with EncodeFreePage(buf, p.meta.FreeHead) in a PageSize
	// buffer, WritePage it, and only then set p.meta.FreeHead = no. The page
	// is the new head; its next pointer is the old head.
	panic("TODO(1.4): Free")
}
