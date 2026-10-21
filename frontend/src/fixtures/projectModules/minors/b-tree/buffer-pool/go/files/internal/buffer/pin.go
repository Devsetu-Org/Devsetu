package buffer

import "github.com/devlabs/btreekv/internal/pager"

// pin returns the frame for page no with its pin count raised, loading the
// page from the backing store if it is not cached. With load false the caller
// is about to overwrite the whole page, so nothing is read.
func (p *Pool) pin(no pager.PageNo, load bool) (*Frame, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	// TODO(4.1): Hit: if i, ok := p.table[no], take f := &p.frames[i], f.pins++, set
	// f.ref = true, and return it.
	// Miss: i, err := p.victim() (task 4.2) picks a frame. If it is in use
	// (f.used), write it back with p.flushFrame(f) (task 4.3), then
	// delete(p.table, f.No) and set f.used = false.
	// If load, p.b.ReadPage(no, f.Data[:]); on an error return it and leave
	// the frame unused.
	// Finally claim the frame: f.No = no, used, ref, pins = 1, not dirty,
	// lsn 0, and p.table[no] = i.
	panic("TODO(4.1): pin")
}

// Unpin releases a frame returned by Fetch. Pass dirty true if the caller
// changed f.Data: the frame is then written back before it can be evicted.
func (p *Pool) Unpin(f *Frame, dirty bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	// TODO(4.1): Panic if f.pins is already 0: that is a double unpin and a bug in the
	// caller. Otherwise f.pins--. If dirty, set f.dirty = true and f.lsn =
	// p.logSize(): the page must not reach the file before the log has at
	// least that many bytes durable.
	panic("TODO(4.1): Unpin")
}
