package buffer

import "github.com/devlabs/btreekv/internal/pager"

// pin returns the frame for page no with its pin count raised, loading the
// page from the backing store if it is not cached. With load false the caller
// is about to overwrite the whole page, so nothing is read.
func (p *Pool) pin(no pager.PageNo, load bool) (*Frame, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if i, ok := p.table[no]; ok {
		f := &p.frames[i]
		f.pins++
		f.ref = true
		return f, nil
	}
	i, err := p.victim()
	if err != nil {
		return nil, err
	}
	f := &p.frames[i]
	if f.used {
		if err := p.flushFrame(f); err != nil {
			return nil, err
		}
		delete(p.table, f.No)
		f.used = false
	}
	if load {
		if err := p.b.ReadPage(no, f.Data[:]); err != nil {
			return nil, err
		}
	}
	f.No, f.used, f.ref, f.pins = no, true, true, 1
	f.dirty, f.lsn = false, 0
	p.table[no] = i
	return f, nil
}

// Unpin releases a frame returned by Fetch. Pass dirty true if the caller
// changed f.Data: the frame is then written back before it can be evicted.
func (p *Pool) Unpin(f *Frame, dirty bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if f.pins == 0 {
		panic("buffer: Unpin of a frame that is not pinned")
	}
	f.pins--
	if dirty {
		f.dirty = true
		f.lsn = p.logSize()
	}
}
