package buffer

import "github.com/devlabs/btreekv/internal/pager"

// pin returns the frame for page no with its pin count raised, loading the
// page from the backing store if it is not cached. With load false the caller
// is about to overwrite the whole page, so nothing is read.
func (p *Pool) pin(no pager.PageNo, load bool) (*Frame, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	// TODO(4.1)
	panic("TODO(4.1)")
}

// Unpin releases a frame returned by Fetch. Pass dirty true if the caller
// changed f.Data: the frame is then written back before it can be evicted.
func (p *Pool) Unpin(f *Frame, dirty bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	// TODO(4.1)
	panic("TODO(4.1)")
}
