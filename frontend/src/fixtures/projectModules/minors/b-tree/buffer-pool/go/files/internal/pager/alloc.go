package pager

import "fmt"

// Allocate returns a page number nobody else is using. It reuses a freed page
// when the freelist has one and otherwise grows the file by one page.
//
// A recycled page keeps whatever bytes it had; callers write it before they
// read it. A page that grows the file is written blank so it exists on disk.
func (p *Pager) Allocate() (PageNo, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if head := p.meta.FreeHead; head != 0 {
		buf := make([]byte, PageSize)
		if err := p.ReadPage(head, buf); err != nil {
			return 0, err
		}
		next, err := decodeFreePage(buf)
		if err != nil {
			return 0, err
		}
		p.meta.FreeHead = next
		return head, nil
	}
	no := p.meta.PageCount
	if err := p.WritePage(no, make([]byte, PageSize)); err != nil {
		return 0, err
	}
	p.meta.PageCount++
	return no, nil
}

// Free puts page no on the freelist so a later Allocate can reuse it. The
// freed page becomes a free page that points at the old list head. Freeing a
// page twice corrupts the list; the layers above must not.
func (p *Pager) Free(no PageNo) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if no == 0 || no >= p.meta.PageCount {
		return fmt.Errorf("%w: cannot free page %d", ErrBadPage, no)
	}
	buf := make([]byte, PageSize)
	EncodeFreePage(buf, p.meta.FreeHead)
	if err := p.WritePage(no, buf); err != nil {
		return err
	}
	p.meta.FreeHead = no
	return nil
}
